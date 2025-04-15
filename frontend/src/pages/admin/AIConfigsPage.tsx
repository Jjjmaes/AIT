import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Button,
    Typography,
    CircularProgress,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Chip,
    Tooltip
} from '@mui/material'; // Assuming MUI is used
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import InfoOutlined from '@mui/icons-material/InfoOutlined';

import { getAllAIConfigs, deleteAIConfig, AIConfig } from '../../api/aiConfigService';
// Import the modal component
import AIConfigFormModal from '../../components/admin/AIConfigFormModal';
// Import the confirmation dialog
import ConfirmationDialog from '../../components/common/ConfirmationDialog';

// Helper function to format parameters for tooltip
const formatParams = (params?: Record<string, any>): React.ReactNode => {
    if (!params || Object.keys(params).length === 0) {
        return 'No default parameters set.';
    }
    return (
        <Box component="ul" sx={{ m: 0, p: 0, pl: 2 }}>
            {Object.entries(params).map(([key, value]) => (
                <li key={key}>{`${key}: ${String(value)}`}</li>
            ))}
        </Box>
    );
};

const AIConfigsPage: React.FC = () => {
    const [configs, setConfigs] = useState<AIConfig[]>([]);
    const [listLoading, setListLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState<boolean>(false); // Separate loading for delete

    // State for modals/dialogs
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingConfigId, setEditingConfigId] = useState<string | null>(null);

    // Delete dialog state
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedConfig, setSelectedConfig] = useState<AIConfig | null>(null);

    const fetchConfigs = useCallback(async () => {
        setListLoading(true);
        setError(null);
        try {
            const response = await getAllAIConfigs();
            if (response.success && response.data) {
                setConfigs(response.data.configs);
            } else {
                setError(response.message || 'Failed to fetch AI configurations.');
            }
        } catch (err: any) {
            console.error("Error fetching AI configs:", err);
            setError(err.message || 'An unexpected error occurred while fetching configurations.');
        } finally {
            setListLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs]);

    const handleCreateOpen = () => {
        setEditingConfigId(null); // Ensure not in edit mode
        setShowFormModal(true);
    };

    const handleEditOpen = (config: AIConfig) => {
        setEditingConfigId(config._id);
        setShowFormModal(true);
    };

    const handleModalClose = () => {
        setShowFormModal(false);
        setEditingConfigId(null); // Clear editing ID on close
    };

    const handleModalSaved = () => {
        handleModalClose();
        fetchConfigs(); // Refresh the list after saving
    };

    const handleDelete = (configId: string) => {
        const configToDelete = configs.find(c => c._id === configId) || null;
        setSelectedConfig(configToDelete);
        setShowDeleteDialog(true);
    };

    const handleCloseDeleteDialog = () => {
        setShowDeleteDialog(false);
        setSelectedConfig(null);
    };

    const confirmDelete = async () => {
         if (!selectedConfig) return;

         setDeleteLoading(true);
         setError(null);
         try {
             const response = await deleteAIConfig(selectedConfig._id);
             if (response.success) {
                fetchConfigs(); // Refresh list
                handleCloseDeleteDialog(); // Close dialog on success
                // TODO: Add success notification/toast? e.g., using Snackbar
             } else {
                 setError(response.message || 'Failed to delete configuration.');
                 handleCloseDeleteDialog(); // Close dialog even on error, error is shown above table
             }
         } catch (err: any) {
             console.error("Error deleting config:", err);
             setError(err.message || 'An error occurred during deletion.');
             handleCloseDeleteDialog(); // Close dialog on error
         } finally {
            setDeleteLoading(false);
         }
    };


    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                AI Provider Configurations
            </Typography>

            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    variant="contained"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={handleCreateOpen}
                    disabled={listLoading} // Disable if list is loading
                >
                    Add New Configuration
                </Button>
            </Box>

            {listLoading && <CircularProgress />}
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

            {!listLoading && !error && (
                <TableContainer component={Paper}>
                    <Table sx={{ minWidth: 700 }} aria-label="ai configurations table">
                        <TableHead>
                            <TableRow>
                                <TableCell>Provider Name</TableCell>
                                <TableCell>Models</TableCell>
                                <TableCell>Default Model</TableCell>
                                <TableCell>Base URL</TableCell>
                                <TableCell>Params</TableCell>
                                <TableCell>Active</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {configs.length === 0 ? (
                                <TableRow>
                                     <TableCell colSpan={7} align="center">No configurations found.</TableCell>
                                </TableRow>
                            ) : (
                                configs.map((config) => (
                                    <TableRow
                                        key={config._id}
                                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                    >
                                        <TableCell component="th" scope="row">
                                            {config.providerName}
                                        </TableCell>
                                        <TableCell>{config.models.join(', ')}</TableCell>
                                        <TableCell>{config.defaultModel || '-'}</TableCell>
                                        <TableCell>{config.baseURL || '-'}</TableCell>
                                        <TableCell align="center">
                                            {config.defaultParams && Object.keys(config.defaultParams).length > 0 ? (
                                                <Tooltip title={formatParams(config.defaultParams)} placement="top">
                                                    <IconButton size="small">
                                                        <InfoOutlined fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            ) : (
                                                '-'
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                icon={config.isActive ? <CheckCircleIcon /> : <CancelIcon />}
                                                label={config.isActive ? 'Yes' : 'No'}
                                                color={config.isActive ? 'success' : 'default'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title="Edit">
                                                <IconButton onClick={() => handleEditOpen(config)} size="small" disabled={deleteLoading}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                             <Tooltip title="Delete">
                                                <IconButton onClick={() => handleDelete(config._id)} size="small" color="error" disabled={deleteLoading}>
                                                    <DeleteIcon fontSize="small"/>
                                                </IconButton>
                                             </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Render the form modal */}
            <AIConfigFormModal
                open={showFormModal}
                onClose={handleModalClose}
                onSaved={handleModalSaved}
                configIdToEdit={editingConfigId}
            />

            {/* Render the delete confirmation dialog */}
            <ConfirmationDialog
                open={showDeleteDialog}
                onClose={handleCloseDeleteDialog}
                onConfirm={confirmDelete}
                title="Confirm Deletion"
                message={`Are you sure you want to delete the configuration for "${selectedConfig?.providerName}"? This action cannot be undone.`}
                confirmText="Delete"
                loading={deleteLoading}
             />

        </Box>
    );
};

export default AIConfigsPage; 