import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    CircularProgress,
    Alert,
    FormControlLabel,
    Switch,
    Chip,
    Box,
    FormHelperText,
    Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { AIConfigPayload, createAIConfig, updateAIConfig, getAIConfigById } from '../../api/aiConfigService';

interface AIConfigFormModalProps {
    open: boolean;
    onClose: () => void;
    onSaved: () => void; // Callback after successful save
    configIdToEdit?: string | null; // Pass ID to fetch config for editing
}

// Initial empty state for the form
const initialFormData: AIConfigPayload = {
    providerName: '',
    apiKey: '',
    baseURL: '',
    models: [],
    defaultModel: '',
    defaultParams: {},
    isActive: true,
    notes: '',
};

const AIConfigFormModal: React.FC<AIConfigFormModalProps> = ({
    open,
    onClose,
    onSaved,
    configIdToEdit,
}) => {
    const [formData, setFormData] = useState<AIConfigPayload>(initialFormData);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isFetchingEditData, setIsFetchingEditData] = useState<boolean>(false);

    // State for handling models array input
    const [currentModelInput, setCurrentModelInput] = useState<string>('');
    // State for handling key-value pairs for defaultParams
    const [currentParamKey, setCurrentParamKey] = useState<string>('');
    const [currentParamValue, setCurrentParamValue] = useState<string>('');

    const isEditMode = useMemo(() => !!configIdToEdit, [configIdToEdit]);

    useEffect(() => {
        // Reset form and fetch data if editing
        if (open) {
            setError(null);
            setFormData(initialFormData); // Reset on open
             setCurrentModelInput('');
             setCurrentParamKey('');
             setCurrentParamValue('');
            if (isEditMode && configIdToEdit) {
                setIsFetchingEditData(true);
                getAIConfigById(configIdToEdit)
                    .then(response => {
                        if (response.success && response.data?.config) {
                             const { _id, createdAt, updatedAt, ...configData } = response.data.config;
                            setFormData({
                                ...initialFormData, // Ensure all fields are present
                                ...configData, // Overwrite with fetched data
                                defaultParams: configData.defaultParams || {}, // Ensure defaultParams is an object
                            });
                        } else {
                            setError(response.message || 'Failed to fetch config details for editing.');
                        }
                    })
                    .catch(err => {
                        console.error("Error fetching config for edit:", err);
                        setError(err.message || 'An error occurred while fetching config details.');
                    })
                    .finally(() => setIsFetchingEditData(false));
            } else {
                 setIsFetchingEditData(false); // Not edit mode
            }
        }
    }, [open, isEditMode, configIdToEdit]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = event.target;

        // Handle checkboxes/switches with type assertion
        if (type === 'checkbox' && event.target instanceof HTMLInputElement) {
             setFormData(prev => ({ ...prev, [name]: (event.target as HTMLInputElement).checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleAddModel = () => {
        if (currentModelInput && !formData.models.includes(currentModelInput.trim())) {
            setFormData(prev => ({ ...prev, models: [...prev.models, currentModelInput.trim()] }));
            setCurrentModelInput('');
        }
    };

    const handleRemoveModel = (modelToRemove: string) => {
        setFormData(prev => ({
            ...prev,
            models: prev.models.filter(model => model !== modelToRemove),
        }));
    };

     const handleAddParam = () => {
        if (currentParamKey.trim() && currentParamValue.trim()) {
            setFormData(prev => ({
                ...prev,
                defaultParams: {
                    ...prev.defaultParams,
                    [currentParamKey.trim()]: currentParamValue.trim(),
                },
            }));
            setCurrentParamKey('');
            setCurrentParamValue('');
        }
    };

    const handleRemoveParam = (keyToRemove: string) => {
         setFormData(prev => {
            const newParams = { ...prev.defaultParams };
            delete newParams[keyToRemove];
            return { ...prev, defaultParams: newParams };
        });
    };


    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        // Basic validation
        if (!formData.providerName || !formData.apiKey || formData.models.length === 0) {
             setError('Provider Name, API Key, and at least one Model are required.');
             setLoading(false);
             return;
        }

        // Prepare payload
         const payload: AIConfigPayload = {
            ...formData,
            baseURL: formData.baseURL?.trim() || undefined,
            defaultModel: formData.defaultModel?.trim() || undefined,
            notes: formData.notes?.trim() || undefined,
            // Ensure defaultParams is an object before checking keys
            defaultParams: Object.keys(formData.defaultParams || {}).length > 0 ? formData.defaultParams : undefined,
        };

        try {
            let response;
            if (isEditMode && configIdToEdit) {
                response = await updateAIConfig(configIdToEdit, payload);
            } else {
                response = await createAIConfig(payload);
            }

            if (response.success) {
                onSaved();
                onClose();
            } else {
                setError(response.message || `Failed to ${isEditMode ? 'update' : 'create'} configuration.`);
            }
        } catch (err: any) {
            console.error(`Error ${isEditMode ? 'updating' : 'creating'} config:`, err);
            setError(err.message || `An unexpected error occurred while ${isEditMode ? 'updating' : 'creating'} the configuration.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{isEditMode ? 'Edit AI Configuration' : 'Add New AI Configuration'}</DialogTitle>
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    {isFetchingEditData ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress />
                        </Box>
                    ): (
                    <>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                                <TextField
                                    required
                                    fullWidth
                                    label="Provider Name"
                                    name="providerName"
                                    value={formData.providerName}
                                    onChange={handleChange}
                                    disabled={loading || isFetchingEditData}
                                    margin="dense"
                                    sx={{ flexBasis: { sm: '50%' } }}
                                />
                                <TextField
                                    required
                                    fullWidth
                                    label="API Key"
                                    name="apiKey"
                                    type="password"
                                    value={formData.apiKey}
                                    onChange={handleChange}
                                    disabled={loading || isFetchingEditData}
                                    margin="dense"
                                    helperText={isEditMode ? "Leave unchanged if you don't want to update the key." : ""}
                                     sx={{ flexBasis: { sm: '50%' } }}
                                />
                            </Box>

                             {/* Row 2: Base URL & Default Model */}
                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                                <TextField
                                    fullWidth
                                    label="Base URL (Optional)"
                                    name="baseURL"
                                    value={formData.baseURL}
                                    onChange={handleChange}
                                    disabled={loading || isFetchingEditData}
                                    margin="dense"
                                     sx={{ flexBasis: { sm: '50%' } }}
                                />
                                <TextField
                                    fullWidth
                                    label="Default Model (Optional)"
                                    name="defaultModel"
                                    value={formData.defaultModel}
                                    onChange={handleChange}
                                    disabled={loading || isFetchingEditData}
                                    margin="dense"
                                    helperText="Must be one of the models listed below."
                                     sx={{ flexBasis: { sm: '50%' } }}
                                />
                            </Box>

                            {/* Models Section */}
                            <Box sx={{ border: '1px solid lightgray', p: 1.5, borderRadius: 1, mt: 1 }}>
                                 <Typography variant="subtitle2" gutterBottom>Models *</Typography>
                                 <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                                    {formData.models.map(model => ( <Chip key={model} label={model} onDelete={() => handleRemoveModel(model)} disabled={loading || isFetchingEditData} /> ))}
                                 </Box>
                                  <Box sx={{ display: 'flex', gap: 1 }}>
                                    <TextField size="small" label="Add Model" value={currentModelInput} onChange={(e) => setCurrentModelInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddModel(); } }} disabled={loading || isFetchingEditData} sx={{ flexGrow: 1 }} />
                                    <Button variant="outlined" onClick={handleAddModel} disabled={loading || isFetchingEditData || !currentModelInput.trim()} startIcon={<AddIcon />}>Add</Button>
                                 </Box>
                                  {formData.models.length === 0 && error?.includes("Model") && ( <FormHelperText error>At least one model is required.</FormHelperText> )}
                            </Box>

                             {/* Default Params Section */}
                            <Box sx={{ border: '1px solid lightgray', p: 1.5, borderRadius: 1, mt: 1 }}>
                                 <Typography variant="subtitle2" gutterBottom>Default Parameters (Optional Key-Value Pairs)</Typography>
                                 <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                                     {Object.entries(formData.defaultParams || {}).map(([key, value]) => ( <Chip key={key} label={`${key}: ${String(value)}`} onDelete={() => handleRemoveParam(key)} disabled={loading || isFetchingEditData}/> ))}
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                     <TextField size="small" label="Param Key" value={currentParamKey} onChange={(e) => setCurrentParamKey(e.target.value)} disabled={loading || isFetchingEditData}/>
                                     <TextField size="small" label="Param Value" value={currentParamValue} onChange={(e) => setCurrentParamValue(e.target.value)} disabled={loading || isFetchingEditData} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddParam(); } }} sx={{ flexGrow: 1 }}/>
                                     <Button variant="outlined" onClick={handleAddParam} disabled={loading || isFetchingEditData || !currentParamKey.trim() || !currentParamValue.trim()} startIcon={<AddIcon />}>Add</Button>
                                  </Box>
                            </Box>

                            {/* Notes */}
                            <TextField
                                fullWidth
                                label="Notes (Optional)"
                                name="notes"
                                multiline
                                rows={3}
                                value={formData.notes}
                                onChange={handleChange}
                                disabled={loading || isFetchingEditData}
                                margin="dense"
                            />

                             {/* Is Active */}
                            <FormControlLabel
                                control={ <Switch checked={formData.isActive} onChange={handleChange} name="isActive" disabled={loading || isFetchingEditData}/> }
                                label="Active"
                                sx={{ alignSelf: 'flex-start' }}
                            />
                        </Box>
                    </>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: '16px 24px'}}>
                    <Button onClick={onClose} disabled={loading || isFetchingEditData} color="inherit">Cancel</Button>
                    <Button type="submit" variant="contained" disabled={loading || isFetchingEditData}>
                        {loading ? <CircularProgress size={24} /> : (isEditMode ? 'Save Changes' : 'Create Configuration')}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default AIConfigFormModal; 