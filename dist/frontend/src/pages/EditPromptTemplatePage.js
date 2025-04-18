"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const antd_1 = require("antd");
const react_router_dom_1 = require("react-router-dom");
const PromptForm_1 = __importDefault(require("../components/promptTemplate/PromptForm"));
const base_1 = require("../api/base");
const { Title } = antd_1.Typography;
const EditPromptTemplatePage = () => {
    const { promptId } = (0, react_router_dom_1.useParams)();
    const navigate = (0, react_router_dom_1.useNavigate)();
    const [template, setTemplate] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [submitting, setSubmitting] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    // Fetch template data on mount using useCallback
    const fetchTemplate = (0, react_1.useCallback)(async () => {
        if (!promptId) {
            setError('模板ID缺失');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await base_1.axiosInstance.get(`/prompts/${promptId}`);
            if ((response.data?.success || response.status === 200) && response.data?.data?.template) {
                setTemplate(response.data.data.template);
            }
            else {
                throw new Error(response.data?.message || '无法加载模板数据');
            }
        }
        catch (err) {
            console.error('Error fetching prompt template:', err);
            setError(err.message || '加载模板数据失败');
        }
        finally {
            setLoading(false);
        }
    }, [promptId]);
    (0, react_1.useEffect)(() => {
        fetchTemplate();
    }, [fetchTemplate]);
    // Function to handle form submission (update logic)
    const handleUpdate = async (values) => {
        if (!promptId)
            return;
        setSubmitting(true);
        antd_1.message.loading({ content: '正在更新模板...', key: 'updatePrompt' });
        try {
            const response = await base_1.axiosInstance.put(`/prompts/${promptId}`, values);
            if ((response.data?.success || response.status === 200) && response.data) {
                antd_1.message.success({ content: '模板更新成功!', key: 'updatePrompt' });
                navigate('/prompts'); // Navigate back to list on success
            }
            else {
                const errorMsg = response.data?.message || '更新模板失败';
                antd_1.message.error({ content: errorMsg, key: 'updatePrompt' });
                throw new Error(errorMsg); // Throw for PromptForm to potentially catch
            }
        }
        catch (err) {
            console.error('Error updating prompt template:', err);
            const errorMsg = err.response?.data?.message || err.message || '更新模板时发生网络错误';
            antd_1.message.error({ content: errorMsg, key: 'updatePrompt' });
            // Re-throw error so PromptForm can display message or handle it
            throw err;
        }
        finally {
            setSubmitting(false);
        }
    };
    if (loading) {
        return (0, jsx_runtime_1.jsx)("div", { style: { textAlign: 'center', padding: '50px' }, children: (0, jsx_runtime_1.jsx)(antd_1.Spin, { size: "large" }) });
    }
    if (error) {
        return (0, jsx_runtime_1.jsx)(antd_1.Alert, { message: "Error Loading Template", description: error, type: "error", showIcon: true });
    }
    if (!template) {
        return (0, jsx_runtime_1.jsx)(antd_1.Alert, { message: "Template Not Found", description: "Could not find the requested template.", type: "warning", showIcon: true });
    }
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)(antd_1.Breadcrumb, { style: { marginBottom: '16px' }, children: [(0, jsx_runtime_1.jsx)(antd_1.Breadcrumb.Item, { children: (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/dashboard", children: "\u4EEA\u8868\u76D8" }) }), (0, jsx_runtime_1.jsx)(antd_1.Breadcrumb.Item, { children: (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/prompts", children: "\u63D0\u793A\u8BCD\u6A21\u677F" }) }), (0, jsx_runtime_1.jsxs)(antd_1.Breadcrumb.Item, { children: ["\u7F16\u8F91\u6A21\u677F (", template.name, ")"] })] }), (0, jsx_runtime_1.jsx)(Title, { level: 2, style: { marginBottom: '24px' }, children: "\u7F16\u8F91\u63D0\u793A\u8BCD\u6A21\u677F" }), (0, jsx_runtime_1.jsx)(PromptForm_1.default, { onSubmit: handleUpdate, isEditing: true, initialValues: template, submitting: submitting })] }));
};
exports.default = EditPromptTemplatePage;
