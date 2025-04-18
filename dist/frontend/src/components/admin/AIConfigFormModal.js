"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const material_1 = require("@mui/material");
const Add_1 = __importDefault(require("@mui/icons-material/Add"));
const aiConfigService_1 = require("../../api/aiConfigService");
// Initial empty state for the form
const initialFormData = {
    providerName: '',
    apiKey: '',
    baseURL: '',
    models: [],
    defaultModel: '',
    defaultParams: {},
    isActive: true,
    notes: '',
};
const AIConfigFormModal = ({ open, onClose, onSaved, configIdToEdit, }) => {
    const [formData, setFormData] = (0, react_1.useState)(initialFormData);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [isFetchingEditData, setIsFetchingEditData] = (0, react_1.useState)(false);
    // State for handling models array input
    const [currentModelInput, setCurrentModelInput] = (0, react_1.useState)('');
    // State for handling key-value pairs for defaultParams
    const [currentParamKey, setCurrentParamKey] = (0, react_1.useState)('');
    const [currentParamValue, setCurrentParamValue] = (0, react_1.useState)('');
    const isEditMode = (0, react_1.useMemo)(() => !!configIdToEdit, [configIdToEdit]);
    (0, react_1.useEffect)(() => {
        // Reset form and fetch data if editing
        if (open) {
            setError(null);
            setFormData(initialFormData); // Reset on open
            setCurrentModelInput('');
            setCurrentParamKey('');
            setCurrentParamValue('');
            if (isEditMode && configIdToEdit) {
                setIsFetchingEditData(true);
                (0, aiConfigService_1.getAIConfigById)(configIdToEdit)
                    .then(response => {
                    if (response.success && response.data?.config) {
                        const { _id, createdAt, updatedAt, ...configData } = response.data.config;
                        setFormData({
                            ...initialFormData, // Ensure all fields are present
                            ...configData, // Overwrite with fetched data
                            defaultParams: configData.defaultParams || {}, // Ensure defaultParams is an object
                        });
                    }
                    else {
                        setError(response.message || 'Failed to fetch config details for editing.');
                    }
                })
                    .catch(err => {
                    console.error("Error fetching config for edit:", err);
                    setError(err.message || 'An error occurred while fetching config details.');
                })
                    .finally(() => setIsFetchingEditData(false));
            }
            else {
                setIsFetchingEditData(false); // Not edit mode
            }
        }
    }, [open, isEditMode, configIdToEdit]);
    const handleChange = (event) => {
        const { name, value, type } = event.target;
        // Handle checkboxes/switches with type assertion
        if (type === 'checkbox' && event.target instanceof HTMLInputElement) {
            setFormData(prev => ({ ...prev, [name]: event.target.checked }));
        }
        else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    const handleAddModel = () => {
        if (currentModelInput && !formData.models.includes(currentModelInput.trim())) {
            setFormData(prev => ({ ...prev, models: [...prev.models, currentModelInput.trim()] }));
            setCurrentModelInput('');
        }
    };
    const handleRemoveModel = (modelToRemove) => {
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
    const handleRemoveParam = (keyToRemove) => {
        setFormData(prev => {
            const newParams = { ...prev.defaultParams };
            delete newParams[keyToRemove];
            return { ...prev, defaultParams: newParams };
        });
    };
    const handleSubmit = async (event) => {
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
        const payload = {
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
                response = await (0, aiConfigService_1.updateAIConfig)(configIdToEdit, payload);
            }
            else {
                response = await (0, aiConfigService_1.createAIConfig)(payload);
            }
            if (response.success) {
                onSaved();
                onClose();
            }
            else {
                setError(response.message || `Failed to ${isEditMode ? 'update' : 'create'} configuration.`);
            }
        }
        catch (err) {
            console.error(`Error ${isEditMode ? 'updating' : 'creating'} config:`, err);
            setError(err.message || `An unexpected error occurred while ${isEditMode ? 'updating' : 'creating'} the configuration.`);
        }
        finally {
            setLoading(false);
        }
    };
    return ((0, jsx_runtime_1.jsxs)(material_1.Dialog, { open: open, onClose: onClose, maxWidth: "md", fullWidth: true, children: [(0, jsx_runtime_1.jsx)(material_1.DialogTitle, { children: isEditMode ? 'Edit AI Configuration' : 'Add New AI Configuration' }), (0, jsx_runtime_1.jsxs)("form", { onSubmit: handleSubmit, children: [(0, jsx_runtime_1.jsx)(material_1.DialogContent, { children: isFetchingEditData ? ((0, jsx_runtime_1.jsx)(material_1.Box, { sx: { display: 'flex', justifyContent: 'center', p: 3 }, children: (0, jsx_runtime_1.jsx)(material_1.CircularProgress, {}) })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [error && (0, jsx_runtime_1.jsx)(material_1.Alert, { severity: "error", sx: { mb: 2 }, children: error }), (0, jsx_runtime_1.jsxs)(material_1.Box, { sx: { display: 'flex', flexDirection: 'column', gap: 2 }, children: [(0, jsx_runtime_1.jsxs)(material_1.Box, { sx: { display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }, children: [(0, jsx_runtime_1.jsx)(material_1.TextField, { required: true, fullWidth: true, label: "Provider Name", name: "providerName", value: formData.providerName, onChange: handleChange, disabled: loading || isFetchingEditData, margin: "dense", sx: { flexBasis: { sm: '50%' } } }), (0, jsx_runtime_1.jsx)(material_1.TextField, { required: true, fullWidth: true, label: "API Key", name: "apiKey", type: "password", value: formData.apiKey, onChange: handleChange, disabled: loading || isFetchingEditData, margin: "dense", helperText: isEditMode ? "Leave unchanged if you don't want to update the key." : "", sx: { flexBasis: { sm: '50%' } } })] }), (0, jsx_runtime_1.jsxs)(material_1.Box, { sx: { display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }, children: [(0, jsx_runtime_1.jsx)(material_1.TextField, { fullWidth: true, label: "Base URL (Optional)", name: "baseURL", value: formData.baseURL, onChange: handleChange, disabled: loading || isFetchingEditData, margin: "dense", sx: { flexBasis: { sm: '50%' } } }), (0, jsx_runtime_1.jsx)(material_1.TextField, { fullWidth: true, label: "Default Model (Optional)", name: "defaultModel", value: formData.defaultModel, onChange: handleChange, disabled: loading || isFetchingEditData, margin: "dense", helperText: "Must be one of the models listed below.", sx: { flexBasis: { sm: '50%' } } })] }), (0, jsx_runtime_1.jsxs)(material_1.Box, { sx: { border: '1px solid lightgray', p: 1.5, borderRadius: 1, mt: 1 }, children: [(0, jsx_runtime_1.jsx)(material_1.Typography, { variant: "subtitle2", gutterBottom: true, children: "Models *" }), (0, jsx_runtime_1.jsx)(material_1.Box, { sx: { display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }, children: formData.models.map(model => ((0, jsx_runtime_1.jsx)(material_1.Chip, { label: model, onDelete: () => handleRemoveModel(model), disabled: loading || isFetchingEditData }, model))) }), (0, jsx_runtime_1.jsxs)(material_1.Box, { sx: { display: 'flex', gap: 1 }, children: [(0, jsx_runtime_1.jsx)(material_1.TextField, { size: "small", label: "Add Model", value: currentModelInput, onChange: (e) => setCurrentModelInput(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddModel();
                                                            } }, disabled: loading || isFetchingEditData, sx: { flexGrow: 1 } }), (0, jsx_runtime_1.jsx)(material_1.Button, { variant: "outlined", onClick: handleAddModel, disabled: loading || isFetchingEditData || !currentModelInput.trim(), startIcon: (0, jsx_runtime_1.jsx)(Add_1.default, {}), children: "Add" })] }), formData.models.length === 0 && error?.includes("Model") && ((0, jsx_runtime_1.jsx)(material_1.FormHelperText, { error: true, children: "At least one model is required." }))] }), (0, jsx_runtime_1.jsxs)(material_1.Box, { sx: { border: '1px solid lightgray', p: 1.5, borderRadius: 1, mt: 1 }, children: [(0, jsx_runtime_1.jsx)(material_1.Typography, { variant: "subtitle2", gutterBottom: true, children: "Default Parameters (Optional Key-Value Pairs)" }), (0, jsx_runtime_1.jsx)(material_1.Box, { sx: { display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }, children: Object.entries(formData.defaultParams || {}).map(([key, value]) => ((0, jsx_runtime_1.jsx)(material_1.Chip, { label: `${key}: ${String(value)}`, onDelete: () => handleRemoveParam(key), disabled: loading || isFetchingEditData }, key))) }), (0, jsx_runtime_1.jsxs)(material_1.Box, { sx: { display: 'flex', gap: 1, alignItems: 'center' }, children: [(0, jsx_runtime_1.jsx)(material_1.TextField, { size: "small", label: "Param Key", value: currentParamKey, onChange: (e) => setCurrentParamKey(e.target.value), disabled: loading || isFetchingEditData }), (0, jsx_runtime_1.jsx)(material_1.TextField, { size: "small", label: "Param Value", value: currentParamValue, onChange: (e) => setCurrentParamValue(e.target.value), disabled: loading || isFetchingEditData, onKeyDown: (e) => { if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddParam();
                                                            } }, sx: { flexGrow: 1 } }), (0, jsx_runtime_1.jsx)(material_1.Button, { variant: "outlined", onClick: handleAddParam, disabled: loading || isFetchingEditData || !currentParamKey.trim() || !currentParamValue.trim(), startIcon: (0, jsx_runtime_1.jsx)(Add_1.default, {}), children: "Add" })] })] }), (0, jsx_runtime_1.jsx)(material_1.TextField, { fullWidth: true, label: "Notes (Optional)", name: "notes", multiline: true, rows: 3, value: formData.notes, onChange: handleChange, disabled: loading || isFetchingEditData, margin: "dense" }), (0, jsx_runtime_1.jsx)(material_1.FormControlLabel, { control: (0, jsx_runtime_1.jsx)(material_1.Switch, { checked: formData.isActive, onChange: handleChange, name: "isActive", disabled: loading || isFetchingEditData }), label: "Active", sx: { alignSelf: 'flex-start' } })] })] })) }), (0, jsx_runtime_1.jsxs)(material_1.DialogActions, { sx: { p: '16px 24px' }, children: [(0, jsx_runtime_1.jsx)(material_1.Button, { onClick: onClose, disabled: loading || isFetchingEditData, color: "inherit", children: "Cancel" }), (0, jsx_runtime_1.jsx)(material_1.Button, { type: "submit", variant: "contained", disabled: loading || isFetchingEditData, children: loading ? (0, jsx_runtime_1.jsx)(material_1.CircularProgress, { size: 24 }) : (isEditMode ? 'Save Changes' : 'Create Configuration') })] })] })] }));
};
exports.default = AIConfigFormModal;
