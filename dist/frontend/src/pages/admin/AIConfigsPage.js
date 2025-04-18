"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const material_1 = require("@mui/material"); // Assuming MUI is used
const AddCircleOutline_1 = __importDefault(require("@mui/icons-material/AddCircleOutline"));
const Edit_1 = __importDefault(require("@mui/icons-material/Edit"));
const Delete_1 = __importDefault(require("@mui/icons-material/Delete"));
const CheckCircle_1 = __importDefault(require("@mui/icons-material/CheckCircle"));
const Cancel_1 = __importDefault(require("@mui/icons-material/Cancel"));
const InfoOutlined_1 = __importDefault(require("@mui/icons-material/InfoOutlined"));
const aiConfigService_1 = require("../../api/aiConfigService");
// Import the modal component
const AIConfigFormModal_1 = __importDefault(require("../../components/admin/AIConfigFormModal"));
// Import the confirmation dialog
const ConfirmationDialog_1 = __importDefault(require("../../components/common/ConfirmationDialog"));
// Helper function to format parameters for tooltip
const formatParams = (params) => {
    if (!params || Object.keys(params).length === 0) {
        return 'No default parameters set.';
    }
    return ((0, jsx_runtime_1.jsx)(material_1.Box, { component: "ul", sx: { m: 0, p: 0, pl: 2 }, children: Object.entries(params).map(([key, value]) => ((0, jsx_runtime_1.jsx)("li", { children: `${key}: ${String(value)}` }, key))) }));
};
const AIConfigsPage = () => {
    const [configs, setConfigs] = (0, react_1.useState)([]);
    const [listLoading, setListLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [deleteLoading, setDeleteLoading] = (0, react_1.useState)(false); // Separate loading for delete
    // State for modals/dialogs
    const [showFormModal, setShowFormModal] = (0, react_1.useState)(false);
    const [editingConfigId, setEditingConfigId] = (0, react_1.useState)(null);
    // Delete dialog state
    const [showDeleteDialog, setShowDeleteDialog] = (0, react_1.useState)(false);
    const [selectedConfig, setSelectedConfig] = (0, react_1.useState)(null);
    const fetchConfigs = (0, react_1.useCallback)(async () => {
        setListLoading(true);
        setError(null);
        try {
            const response = await (0, aiConfigService_1.getAllAIConfigs)();
            if (response.success && response.data) {
                setConfigs(response.data.configs);
            }
            else {
                setError(response.message || 'Failed to fetch AI configurations.');
            }
        }
        catch (err) {
            console.error("Error fetching AI configs:", err);
            setError(err.message || 'An unexpected error occurred while fetching configurations.');
        }
        finally {
            setListLoading(false);
        }
    }, []);
    (0, react_1.useEffect)(() => {
        fetchConfigs();
    }, [fetchConfigs]);
    const handleCreateOpen = () => {
        setEditingConfigId(null); // Ensure not in edit mode
        setShowFormModal(true);
    };
    const handleEditOpen = (config) => {
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
    const handleDelete = (configId) => {
        const configToDelete = configs.find(c => c._id === configId) || null;
        setSelectedConfig(configToDelete);
        setShowDeleteDialog(true);
    };
    const handleCloseDeleteDialog = () => {
        setShowDeleteDialog(false);
        setSelectedConfig(null);
    };
    const confirmDelete = async () => {
        if (!selectedConfig)
            return;
        setDeleteLoading(true);
        setError(null);
        try {
            const response = await (0, aiConfigService_1.deleteAIConfig)(selectedConfig._id);
            if (response.success) {
                fetchConfigs(); // Refresh list
                handleCloseDeleteDialog(); // Close dialog on success
                // TODO: Add success notification/toast? e.g., using Snackbar
            }
            else {
                setError(response.message || 'Failed to delete configuration.');
                handleCloseDeleteDialog(); // Close dialog even on error, error is shown above table
            }
        }
        catch (err) {
            console.error("Error deleting config:", err);
            setError(err.message || 'An error occurred during deletion.');
            handleCloseDeleteDialog(); // Close dialog on error
        }
        finally {
            setDeleteLoading(false);
        }
    };
    return ((0, jsx_runtime_1.jsxs)(material_1.Box, { sx: { p: 3 }, children: [(0, jsx_runtime_1.jsx)(material_1.Typography, { variant: "h4", gutterBottom: true, children: "AI Provider Configurations" }), (0, jsx_runtime_1.jsx)(material_1.Box, { sx: { mb: 2, display: 'flex', justifyContent: 'flex-end' }, children: (0, jsx_runtime_1.jsx)(material_1.Button, { variant: "contained", startIcon: (0, jsx_runtime_1.jsx)(AddCircleOutline_1.default, {}), onClick: handleCreateOpen, disabled: listLoading, children: "Add New Configuration" }) }), listLoading && (0, jsx_runtime_1.jsx)(material_1.CircularProgress, {}), error && (0, jsx_runtime_1.jsx)(material_1.Alert, { severity: "error", sx: { mb: 2 }, onClose: () => setError(null), children: error }), !listLoading && !error && ((0, jsx_runtime_1.jsx)(material_1.TableContainer, { component: material_1.Paper, children: (0, jsx_runtime_1.jsxs)(material_1.Table, { sx: { minWidth: 700 }, "aria-label": "ai configurations table", children: [(0, jsx_runtime_1.jsx)(material_1.TableHead, { children: (0, jsx_runtime_1.jsxs)(material_1.TableRow, { children: [(0, jsx_runtime_1.jsx)(material_1.TableCell, { children: "Provider Name" }), (0, jsx_runtime_1.jsx)(material_1.TableCell, { children: "Models" }), (0, jsx_runtime_1.jsx)(material_1.TableCell, { children: "Default Model" }), (0, jsx_runtime_1.jsx)(material_1.TableCell, { children: "Base URL" }), (0, jsx_runtime_1.jsx)(material_1.TableCell, { children: "Params" }), (0, jsx_runtime_1.jsx)(material_1.TableCell, { children: "Active" }), (0, jsx_runtime_1.jsx)(material_1.TableCell, { children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)(material_1.TableBody, { children: configs.length === 0 ? ((0, jsx_runtime_1.jsx)(material_1.TableRow, { children: (0, jsx_runtime_1.jsx)(material_1.TableCell, { colSpan: 7, align: "center", children: "No configurations found." }) })) : (configs.map((config) => ((0, jsx_runtime_1.jsxs)(material_1.TableRow, { sx: { '&:last-child td, &:last-child th': { border: 0 } }, children: [(0, jsx_runtime_1.jsx)(material_1.TableCell, { component: "th", scope: "row", children: config.providerName }), (0, jsx_runtime_1.jsx)(material_1.TableCell, { children: config.models.join(', ') }), (0, jsx_runtime_1.jsx)(material_1.TableCell, { children: config.defaultModel || '-' }), (0, jsx_runtime_1.jsx)(material_1.TableCell, { children: config.baseURL || '-' }), (0, jsx_runtime_1.jsx)(material_1.TableCell, { align: "center", children: config.defaultParams && Object.keys(config.defaultParams).length > 0 ? ((0, jsx_runtime_1.jsx)(material_1.Tooltip, { title: formatParams(config.defaultParams), placement: "top", children: (0, jsx_runtime_1.jsx)(material_1.IconButton, { size: "small", children: (0, jsx_runtime_1.jsx)(InfoOutlined_1.default, { fontSize: "small" }) }) })) : ('-') }), (0, jsx_runtime_1.jsx)(material_1.TableCell, { children: (0, jsx_runtime_1.jsx)(material_1.Chip, { icon: config.isActive ? (0, jsx_runtime_1.jsx)(CheckCircle_1.default, {}) : (0, jsx_runtime_1.jsx)(Cancel_1.default, {}), label: config.isActive ? 'Yes' : 'No', color: config.isActive ? 'success' : 'default', size: "small" }) }), (0, jsx_runtime_1.jsxs)(material_1.TableCell, { children: [(0, jsx_runtime_1.jsx)(material_1.Tooltip, { title: "Edit", children: (0, jsx_runtime_1.jsx)(material_1.IconButton, { onClick: () => handleEditOpen(config), size: "small", disabled: deleteLoading, children: (0, jsx_runtime_1.jsx)(Edit_1.default, { fontSize: "small" }) }) }), (0, jsx_runtime_1.jsx)(material_1.Tooltip, { title: "Delete", children: (0, jsx_runtime_1.jsx)(material_1.IconButton, { onClick: () => handleDelete(config._id), size: "small", color: "error", disabled: deleteLoading, children: (0, jsx_runtime_1.jsx)(Delete_1.default, { fontSize: "small" }) }) })] })] }, config._id)))) })] }) })), (0, jsx_runtime_1.jsx)(AIConfigFormModal_1.default, { open: showFormModal, onClose: handleModalClose, onSaved: handleModalSaved, configIdToEdit: editingConfigId }), (0, jsx_runtime_1.jsx)(ConfirmationDialog_1.default, { open: showDeleteDialog, onClose: handleCloseDeleteDialog, onConfirm: confirmDelete, title: "Confirm Deletion", message: `Are you sure you want to delete the configuration for "${selectedConfig?.providerName}"? This action cannot be undone.`, confirmText: "Delete", loading: deleteLoading })] }));
};
exports.default = AIConfigsPage;
