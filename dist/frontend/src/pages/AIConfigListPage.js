"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_router_dom_1 = require("react-router-dom");
const aiConfigService_1 = require("../api/aiConfigService");
const AIConfigListPage = () => {
    const navigate = (0, react_router_dom_1.useNavigate)();
    const [configs, setConfigs] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [isDeleting, setIsDeleting] = (0, react_1.useState)(false);
    const [confirmDeleteId, setConfirmDeleteId] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        fetchConfigs();
    }, []);
    const fetchConfigs = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await (0, aiConfigService_1.getAllAIConfigs)();
            if (response.success && response.data?.configs) {
                setConfigs(response.data.configs);
            }
            else {
                setError(response.message || '无法加载 AI 配置列表');
            }
        }
        catch (err) {
            console.error('Error fetching AI configs:', err);
            setError('加载 AI 配置列表时出错');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleDeleteClick = (configId) => {
        setConfirmDeleteId(configId);
    };
    const handleConfirmDelete = async () => {
        if (!confirmDeleteId)
            return;
        setIsDeleting(true);
        try {
            const response = await (0, aiConfigService_1.deleteAIConfig)(confirmDeleteId);
            if (response.success) {
                setConfigs(configs.filter(config => config._id !== confirmDeleteId));
                setConfirmDeleteId(null);
            }
            else {
                setError(response.message || '删除 AI 配置失败');
            }
        }
        catch (err) {
            console.error('Error deleting AI config:', err);
            setError('删除 AI 配置时出错');
        }
        finally {
            setIsDeleting(false);
        }
    };
    const handleCancelDelete = () => {
        setConfirmDeleteId(null);
    };
    if (isLoading) {
        return ((0, jsx_runtime_1.jsx)("div", { style: {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '200px',
                color: '#666'
            }, children: (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)("p", { style: { fontSize: '1.1rem' }, children: "\u6B63\u5728\u52A0\u8F7D AI \u914D\u7F6E\u5217\u8868..." }) }) }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "ai-config-list-page", style: { maxWidth: '1200px', margin: '0 auto', padding: '1rem' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem',
                    borderBottom: '1px solid #e0e0e0',
                    paddingBottom: '0.75rem'
                }, children: [(0, jsx_runtime_1.jsx)("h1", { style: { margin: 0, color: '#333' }, children: "AI \u914D\u7F6E\u7BA1\u7406" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => navigate('/ai-configs/create'), style: {
                            padding: '0.5rem 1rem',
                            backgroundColor: '#1976d2',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 'bold'
                        }, children: "\u6DFB\u52A0\u65B0\u914D\u7F6E" })] }), error && ((0, jsx_runtime_1.jsx)("div", { style: {
                    padding: '1rem',
                    backgroundColor: '#ffebee',
                    color: '#c62828',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }, children: (0, jsx_runtime_1.jsx)("p", { style: { margin: 0 }, children: error }) })), confirmDeleteId && ((0, jsx_runtime_1.jsxs)("div", { style: {
                    padding: '1rem',
                    backgroundColor: '#fff3e0',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }, children: [(0, jsx_runtime_1.jsx)("p", { style: { marginTop: 0 }, children: "\u786E\u5B9A\u8981\u5220\u9664\u6B64 AI \u914D\u7F6E\u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002" }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', gap: '0.75rem' }, children: [(0, jsx_runtime_1.jsx)("button", { onClick: handleConfirmDelete, disabled: isDeleting, style: {
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#f44336',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }, children: isDeleting ? '删除中...' : '确认删除' }), (0, jsx_runtime_1.jsx)("button", { onClick: handleCancelDelete, disabled: isDeleting, style: {
                                    padding: '0.5rem 1rem',
                                    backgroundColor: 'white',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }, children: "\u53D6\u6D88" })] })] })), configs.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", { style: {
                    padding: '2rem',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    textAlign: 'center',
                    color: '#666'
                }, children: [(0, jsx_runtime_1.jsx)("p", { style: { fontSize: '1.1rem' }, children: "\u5C1A\u672A\u521B\u5EFA\u4EFB\u4F55 AI \u914D\u7F6E" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => navigate('/ai-configs/create'), style: {
                            padding: '0.5rem 1rem',
                            backgroundColor: '#1976d2',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginTop: '1rem'
                        }, children: "\u6DFB\u52A0\u7B2C\u4E00\u4E2A AI \u914D\u7F6E" })] })) : ((0, jsx_runtime_1.jsx)("div", { style: {
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    overflow: 'hidden'
                }, children: (0, jsx_runtime_1.jsx)("div", { style: { overflowX: 'auto' }, children: (0, jsx_runtime_1.jsxs)("table", { style: {
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.95rem'
                        }, children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { style: { backgroundColor: '#f5f5f5' }, children: [(0, jsx_runtime_1.jsx)("th", { style: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }, children: "\u63D0\u4F9B\u5546" }), (0, jsx_runtime_1.jsx)("th", { style: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }, children: "Base URL" }), (0, jsx_runtime_1.jsx)("th", { style: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }, children: "\u9ED8\u8BA4\u6A21\u578B" }), (0, jsx_runtime_1.jsx)("th", { style: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }, children: "\u72B6\u6001" }), (0, jsx_runtime_1.jsx)("th", { style: { padding: '1rem', textAlign: 'left', borderBottom: '1px solid #eee' }, children: "\u521B\u5EFA\u65E5\u671F" }), (0, jsx_runtime_1.jsx)("th", { style: { padding: '1rem', textAlign: 'center', borderBottom: '1px solid #eee' }, children: "\u64CD\u4F5C" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: configs.map(config => ((0, jsx_runtime_1.jsxs)("tr", { style: { borderBottom: '1px solid #eee' }, children: [(0, jsx_runtime_1.jsxs)("td", { style: { padding: '1rem' }, children: [(0, jsx_runtime_1.jsx)("div", { style: { fontWeight: 'bold' }, children: config.providerName }), (0, jsx_runtime_1.jsx)("div", { style: { color: '#666', fontSize: '0.85rem' }, children: config.notes && config.notes.length > 50
                                                        ? `${config.notes.substring(0, 50)}...`
                                                        : config.notes })] }), (0, jsx_runtime_1.jsx)("td", { style: { padding: '1rem' }, children: config.baseURL || '-' }), (0, jsx_runtime_1.jsx)("td", { style: { padding: '1rem' }, children: config.defaultModel || '-' }), (0, jsx_runtime_1.jsx)("td", { style: { padding: '1rem' }, children: (0, jsx_runtime_1.jsx)("span", { style: {
                                                    display: 'inline-block',
                                                    padding: '0.35rem 0.75rem',
                                                    borderRadius: '50px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 'bold',
                                                    backgroundColor: config.isActive ? '#e8f5e9' : '#ffebee',
                                                    color: config.isActive ? '#2e7d32' : '#c62828'
                                                }, children: config.isActive ? '活跃' : '禁用' }) }), (0, jsx_runtime_1.jsx)("td", { style: { padding: '1rem' }, children: new Date(config.createdAt).toLocaleDateString() }), (0, jsx_runtime_1.jsx)("td", { style: { padding: '1rem', textAlign: 'center' }, children: (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'center', gap: '0.5rem' }, children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => navigate(`/ai-configs/${config._id}/edit`), style: {
                                                            padding: '0.4rem 0.75rem',
                                                            backgroundColor: '#e3f2fd',
                                                            color: '#1976d2',
                                                            border: '1px solid #bbdefb',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.85rem'
                                                        }, children: "\u7F16\u8F91" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => handleDeleteClick(config._id), disabled: Boolean(confirmDeleteId), style: {
                                                            padding: '0.4rem 0.75rem',
                                                            backgroundColor: '#ffebee',
                                                            color: '#c62828',
                                                            border: '1px solid #ef9a9a',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.85rem'
                                                        }, children: "\u5220\u9664" })] }) })] }, config._id))) })] }) }) }))] }));
};
exports.default = AIConfigListPage;
