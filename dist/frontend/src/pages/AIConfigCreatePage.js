"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_router_dom_1 = require("react-router-dom");
const aiConfigService_1 = require("../api/aiConfigService");
const AI_PROVIDERS = [
    'OpenAI',
    'Anthropic',
    'Gemini',
    'Azure OpenAI',
    'Cohere',
    'Ollama',
    'Custom'
];
// Common models for different providers
const DEFAULT_MODELS = {
    'OpenAI': ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    'Anthropic': ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-2'],
    'Gemini': ['gemini-pro', 'gemini-pro-vision', 'gemini-ultra'],
    'Azure OpenAI': ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    'Cohere': ['command', 'command-light', 'command-plus', 'command-nightly'],
    'Ollama': ['llama3', 'llama2', 'mixtral'],
    'Custom': []
};
// Default base URLs for providers
const DEFAULT_BASE_URLS = {
    'OpenAI': 'https://api.openai.com/v1',
    'Anthropic': 'https://api.anthropic.com/v1',
    'Gemini': 'https://generativelanguage.googleapis.com/v1',
    'Azure OpenAI': '', // Depends on specific Azure deployment
    'Cohere': 'https://api.cohere.ai/v1',
    'Ollama': 'http://localhost:11434/api', // Default for local Ollama
    'Custom': ''
};
const AIConfigCreatePage = () => {
    const navigate = (0, react_router_dom_1.useNavigate)();
    const [providerName, setProviderName] = (0, react_1.useState)('');
    const [apiKey, setApiKey] = (0, react_1.useState)('');
    const [baseURL, setBaseURL] = (0, react_1.useState)('');
    const [models, setModels] = (0, react_1.useState)([]);
    const [defaultModel, setDefaultModel] = (0, react_1.useState)('');
    const [isActive, setIsActive] = (0, react_1.useState)(true);
    const [notes, setNotes] = (0, react_1.useState)('');
    const [newModel, setNewModel] = (0, react_1.useState)('');
    const [defaultParams, setDefaultParams] = (0, react_1.useState)('{\n  "temperature": 0.7,\n  "top_p": 1\n}');
    const [isCreating, setIsCreating] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    // Handle provider change
    const handleProviderChange = (e) => {
        const selectedProvider = e.target.value;
        setProviderName(selectedProvider);
        setModels(DEFAULT_MODELS[selectedProvider] || []);
        setBaseURL(DEFAULT_BASE_URLS[selectedProvider] || '');
        setDefaultModel('');
    };
    // Handle adding a new model
    const handleAddModel = () => {
        if (newModel.trim() && !models.includes(newModel.trim())) {
            setModels([...models, newModel.trim()]);
            setNewModel('');
        }
    };
    // Handle removing a model
    const handleRemoveModel = (model) => {
        setModels(models.filter(m => m !== model));
        if (defaultModel === model) {
            setDefaultModel('');
        }
    };
    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setIsCreating(true);
        // Basic validation
        if (!providerName.trim()) {
            setError('提供商名称不能为空');
            setIsCreating(false);
            return;
        }
        if (!apiKey.trim()) {
            setError('API密钥不能为空');
            setIsCreating(false);
            return;
        }
        if (models.length === 0) {
            setError('至少需要一个有效的模型');
            setIsCreating(false);
            return;
        }
        let parsedParams = {};
        try {
            parsedParams = defaultParams.trim() ? JSON.parse(defaultParams) : {};
        }
        catch (err) {
            setError('默认参数JSON格式无效');
            setIsCreating(false);
            return;
        }
        const payload = {
            providerName: providerName.trim(),
            apiKey: apiKey.trim(),
            baseURL: baseURL.trim() || undefined,
            models,
            defaultModel: defaultModel || undefined,
            defaultParams: Object.keys(parsedParams).length > 0 ? parsedParams : undefined,
            isActive,
            notes: notes.trim() || undefined
        };
        try {
            const response = await (0, aiConfigService_1.createAIConfig)(payload);
            if (response.success && response.data?.config) {
                navigate('/ai-configs');
            }
            else {
                setError(response.message || '创建AI配置失败');
            }
        }
        catch (err) {
            console.error('Create AI config error:', err);
            let errorMessage = '创建AI配置时出错';
            if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            }
            setError(errorMessage);
        }
        finally {
            setIsCreating(false);
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "create-ai-config-page", style: { maxWidth: '900px', margin: '0 auto', padding: '1rem' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem',
                    borderBottom: '1px solid #e0e0e0',
                    paddingBottom: '0.75rem'
                }, children: [(0, jsx_runtime_1.jsx)("h1", { style: { margin: 0, color: '#333' }, children: "\u521B\u5EFA\u65B0 AI \u914D\u7F6E" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => navigate('/ai-configs'), style: {
                            padding: '0.5rem 1rem',
                            backgroundColor: 'white',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }, children: "\u8FD4\u56DE\u914D\u7F6E\u5217\u8868" })] }), error && ((0, jsx_runtime_1.jsx)("div", { style: {
                    padding: '1rem',
                    backgroundColor: '#ffebee',
                    color: '#c62828',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }, children: (0, jsx_runtime_1.jsx)("p", { style: { margin: 0 }, children: error }) })), (0, jsx_runtime_1.jsxs)("form", { onSubmit: handleSubmit, children: [(0, jsx_runtime_1.jsxs)("div", { className: "form-card", style: {
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            marginBottom: '1.5rem',
                            overflow: 'hidden'
                        }, children: [(0, jsx_runtime_1.jsx)("div", { className: "card-header", style: {
                                    padding: '1rem',
                                    backgroundColor: '#f5f5f5',
                                    borderBottom: '1px solid #eee',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    color: '#333'
                                }, children: "\u57FA\u672C\u4FE1\u606F" }), (0, jsx_runtime_1.jsxs)("div", { className: "card-content", style: { padding: '1.5rem' }, children: [(0, jsx_runtime_1.jsxs)("div", { className: "form-group", style: { marginBottom: '1.25rem' }, children: [(0, jsx_runtime_1.jsxs)("label", { htmlFor: "providerName", style: {
                                                    display: 'block',
                                                    marginBottom: '0.5rem',
                                                    fontWeight: 'bold',
                                                    color: '#333'
                                                }, children: ["\u63D0\u4F9B\u5546: ", (0, jsx_runtime_1.jsx)("span", { style: { color: '#e53935' }, children: "*" })] }), (0, jsx_runtime_1.jsxs)("select", { id: "providerName", value: providerName, onChange: handleProviderChange, required: true, disabled: isCreating, style: {
                                                    width: '100%',
                                                    padding: '0.75rem',
                                                    borderRadius: '4px',
                                                    border: '1px solid #ccc',
                                                    fontSize: '1rem'
                                                }, children: [(0, jsx_runtime_1.jsx)("option", { value: "", disabled: true, children: "\u9009\u62E9 AI \u63D0\u4F9B\u5546" }), AI_PROVIDERS.map(provider => ((0, jsx_runtime_1.jsx)("option", { value: provider, children: provider }, provider)))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-group", style: { marginBottom: '1.25rem' }, children: [(0, jsx_runtime_1.jsxs)("label", { htmlFor: "apiKey", style: {
                                                    display: 'block',
                                                    marginBottom: '0.5rem',
                                                    fontWeight: 'bold',
                                                    color: '#333'
                                                }, children: ["API \u5BC6\u94A5: ", (0, jsx_runtime_1.jsx)("span", { style: { color: '#e53935' }, children: "*" })] }), (0, jsx_runtime_1.jsx)("input", { type: "password", id: "apiKey", value: apiKey, onChange: (e) => setApiKey(e.target.value), required: true, disabled: isCreating, placeholder: "\u8F93\u5165 API \u5BC6\u94A5", style: {
                                                    width: '100%',
                                                    padding: '0.75rem',
                                                    borderRadius: '4px',
                                                    border: '1px solid #ccc',
                                                    fontSize: '1rem'
                                                } }), (0, jsx_runtime_1.jsx)("p", { style: { color: '#666', margin: '0.5rem 0 0', fontSize: '0.9rem' }, children: "API \u5BC6\u94A5\u5C06\u88AB\u5B89\u5168\u52A0\u5BC6\u5B58\u50A8" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-group", style: { marginBottom: '1.25rem' }, children: [(0, jsx_runtime_1.jsxs)("label", { htmlFor: "baseURL", style: {
                                                    display: 'block',
                                                    marginBottom: '0.5rem',
                                                    fontWeight: 'bold',
                                                    color: '#333'
                                                }, children: ["Base URL: ", providerName === 'Azure OpenAI' && (0, jsx_runtime_1.jsx)("span", { style: { color: '#e53935' }, children: "*" })] }), (0, jsx_runtime_1.jsx)("input", { type: "text", id: "baseURL", value: baseURL, onChange: (e) => setBaseURL(e.target.value), required: providerName === 'Azure OpenAI', disabled: isCreating, placeholder: providerName === 'Azure OpenAI'
                                                    ? "例如: https://your-resource.openai.azure.com/openai/deployments/your-deployment-name"
                                                    : "默认值将被使用，如需修改请输入", style: {
                                                    width: '100%',
                                                    padding: '0.75rem',
                                                    borderRadius: '4px',
                                                    border: '1px solid #ccc',
                                                    fontSize: '1rem'
                                                } })] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-group", style: { marginBottom: '1.25rem' }, children: [(0, jsx_runtime_1.jsx)("label", { style: {
                                                    display: 'block',
                                                    marginBottom: '0.5rem',
                                                    fontWeight: 'bold',
                                                    color: '#333'
                                                }, children: "\u6FC0\u6D3B\u72B6\u6001:" }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', gap: '1rem' }, children: [(0, jsx_runtime_1.jsxs)("label", { style: { display: 'flex', alignItems: 'center', cursor: 'pointer' }, children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", name: "isActive", checked: isActive, onChange: () => setIsActive(true), disabled: isCreating, style: { marginRight: '0.5rem' } }), "\u6FC0\u6D3B"] }), (0, jsx_runtime_1.jsxs)("label", { style: { display: 'flex', alignItems: 'center', cursor: 'pointer' }, children: [(0, jsx_runtime_1.jsx)("input", { type: "radio", name: "isActive", checked: !isActive, onChange: () => setIsActive(false), disabled: isCreating, style: { marginRight: '0.5rem' } }), "\u7981\u7528"] })] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-card", style: {
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            marginBottom: '1.5rem',
                            overflow: 'hidden'
                        }, children: [(0, jsx_runtime_1.jsxs)("div", { className: "card-header", style: {
                                    padding: '1rem',
                                    backgroundColor: '#f5f5f5',
                                    borderBottom: '1px solid #eee',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    color: '#333'
                                }, children: ["\u6A21\u578B\u914D\u7F6E ", (0, jsx_runtime_1.jsx)("span", { style: { color: '#e53935' }, children: "*" })] }), (0, jsx_runtime_1.jsx)("div", { className: "card-content", style: { padding: '1.5rem' }, children: (0, jsx_runtime_1.jsxs)("div", { className: "form-group", style: { marginBottom: '1.25rem' }, children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "models", style: {
                                                display: 'block',
                                                marginBottom: '0.5rem',
                                                fontWeight: 'bold',
                                                color: '#333'
                                            }, children: "\u53EF\u7528\u6A21\u578B:" }), models.length > 0 ? ((0, jsx_runtime_1.jsx)("div", { style: { marginBottom: '1rem' }, children: (0, jsx_runtime_1.jsx)("div", { style: {
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    gap: '0.5rem',
                                                    marginBottom: '1rem'
                                                }, children: models.map(model => ((0, jsx_runtime_1.jsxs)("div", { style: {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        backgroundColor: '#f1f8e9',
                                                        border: '1px solid #c5e1a5',
                                                        borderRadius: '4px',
                                                        padding: '0.5rem 0.75rem',
                                                        fontSize: '0.9rem',
                                                        gap: '0.5rem'
                                                    }, children: [(0, jsx_runtime_1.jsx)("span", { children: model }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleRemoveModel(model), disabled: isCreating, "aria-label": `删除模型 ${model}`, style: {
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                color: '#7cb342',
                                                                fontWeight: 'bold',
                                                                fontSize: '1rem',
                                                                padding: '0',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                width: '20px',
                                                                height: '20px'
                                                            }, children: "\u00D7" })] }, model))) }) })) : ((0, jsx_runtime_1.jsx)("p", { style: { color: '#f57c00', marginTop: 0 }, children: "\u8BF7\u81F3\u5C11\u6DFB\u52A0\u4E00\u4E2A\u6A21\u578B" })), (0, jsx_runtime_1.jsxs)("div", { style: {
                                                display: 'flex',
                                                gap: '0.5rem',
                                                marginBottom: '1rem'
                                            }, children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: newModel, onChange: (e) => setNewModel(e.target.value), disabled: isCreating, placeholder: "\u8F93\u5165\u6A21\u578B\u540D\u79F0", style: {
                                                        flex: '1',
                                                        padding: '0.75rem',
                                                        borderRadius: '4px',
                                                        border: '1px solid #ccc',
                                                        fontSize: '1rem'
                                                    } }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleAddModel, disabled: isCreating || !newModel.trim(), style: {
                                                        padding: '0.75rem 1rem',
                                                        backgroundColor: '#e3f2fd',
                                                        color: '#1976d2',
                                                        border: '1px solid #bbdefb',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap'
                                                    }, children: "\u6DFB\u52A0\u6A21\u578B" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-group", style: { marginBottom: '1.25rem' }, children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "defaultModel", style: {
                                                        display: 'block',
                                                        marginBottom: '0.5rem',
                                                        fontWeight: 'bold',
                                                        color: '#333'
                                                    }, children: "\u9ED8\u8BA4\u6A21\u578B:" }), (0, jsx_runtime_1.jsxs)("select", { id: "defaultModel", value: defaultModel, onChange: (e) => setDefaultModel(e.target.value), disabled: isCreating || models.length === 0, style: {
                                                        width: '100%',
                                                        padding: '0.75rem',
                                                        borderRadius: '4px',
                                                        border: '1px solid #ccc',
                                                        fontSize: '1rem'
                                                    }, children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "\u9009\u62E9\u9ED8\u8BA4\u6A21\u578B (\u53EF\u9009)" }), models.map(model => ((0, jsx_runtime_1.jsx)("option", { value: model, children: model }, model)))] })] })] }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-card", style: {
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                            marginBottom: '1.5rem',
                            overflow: 'hidden'
                        }, children: [(0, jsx_runtime_1.jsx)("div", { className: "card-header", style: {
                                    padding: '1rem',
                                    backgroundColor: '#f5f5f5',
                                    borderBottom: '1px solid #eee',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    color: '#333'
                                }, children: "\u9AD8\u7EA7\u8BBE\u7F6E" }), (0, jsx_runtime_1.jsxs)("div", { className: "card-content", style: { padding: '1.5rem' }, children: [(0, jsx_runtime_1.jsxs)("div", { className: "form-group", style: { marginBottom: '1.25rem' }, children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "defaultParams", style: {
                                                    display: 'block',
                                                    marginBottom: '0.5rem',
                                                    fontWeight: 'bold',
                                                    color: '#333'
                                                }, children: "\u9ED8\u8BA4\u53C2\u6570 (JSON \u683C\u5F0F):" }), (0, jsx_runtime_1.jsx)("textarea", { id: "defaultParams", value: defaultParams, onChange: (e) => setDefaultParams(e.target.value), disabled: isCreating, rows: 6, placeholder: '\u4F8B\u5982: { "temperature": 0.7, "top_p": 1 }', style: {
                                                    width: '100%',
                                                    padding: '0.75rem',
                                                    borderRadius: '4px',
                                                    border: '1px solid #ccc',
                                                    fontSize: '1rem',
                                                    fontFamily: 'monospace',
                                                    resize: 'vertical'
                                                } }), (0, jsx_runtime_1.jsx)("p", { style: { color: '#666', margin: '0.5rem 0 0', fontSize: '0.9rem' }, children: "\u8FD9\u4E9B\u53C2\u6570\u5C06\u4F5C\u4E3A\u8C03\u7528 API \u65F6\u7684\u9ED8\u8BA4\u503C\uFF0C\u786E\u4FDD\u4F7F\u7528\u6709\u6548\u7684 JSON \u683C\u5F0F" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "form-group", style: { marginBottom: '1.25rem' }, children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "notes", style: {
                                                    display: 'block',
                                                    marginBottom: '0.5rem',
                                                    fontWeight: 'bold',
                                                    color: '#333'
                                                }, children: "\u5907\u6CE8:" }), (0, jsx_runtime_1.jsx)("textarea", { id: "notes", value: notes, onChange: (e) => setNotes(e.target.value), disabled: isCreating, rows: 3, placeholder: "\u8F93\u5165\u5173\u4E8E\u6B64 AI \u914D\u7F6E\u7684\u9644\u52A0\u4FE1\u606F", style: {
                                                    width: '100%',
                                                    padding: '0.75rem',
                                                    borderRadius: '4px',
                                                    border: '1px solid #ccc',
                                                    fontSize: '1rem',
                                                    resize: 'vertical'
                                                } })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: '1.5rem',
                            marginBottom: '2rem'
                        }, children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => navigate('/ai-configs'), disabled: isCreating, style: {
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: 'white',
                                    color: '#555',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: 'bold'
                                }, children: "\u53D6\u6D88" }), (0, jsx_runtime_1.jsx)("button", { type: "submit", disabled: isCreating, style: {
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: '#1976d2',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    minWidth: '120px'
                                }, children: isCreating ? '创建中...' : '创建配置' })] })] })] }));
};
exports.default = AIConfigCreatePage;
