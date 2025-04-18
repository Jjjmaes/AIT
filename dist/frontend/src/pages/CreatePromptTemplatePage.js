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
const CreatePromptTemplatePage = () => {
    const [submitting, setSubmitting] = (0, react_1.useState)(false);
    // Function to handle form submission (create logic)
    const handleCreate = async (values) => {
        setSubmitting(true);
        antd_1.message.loading({ content: '正在创建模板...', key: 'createPrompt' });
        try {
            // Replace with actual API call using api client or a service function
            const response = await base_1.axiosInstance.post('/prompts', values);
            // Check for success, including common success statuses like 201
            if ((response.data?.success || response.status === 201) && response.data) {
                antd_1.message.success({ content: '模板创建成功!', key: 'createPrompt' });
                // Force a full page reload to ensure the list page fetches fresh data
                window.location.href = '/prompts';
            }
            else {
                // Handle API error messages if needed
                const errorMsg = response.data?.message || '创建模板失败';
                console.error('Failed to create prompt template:', errorMsg);
                antd_1.message.error({ content: errorMsg, key: 'createPrompt' });
                // Don't throw error here, let the form handle its state
            }
        }
        catch (error) {
            console.error('Error creating prompt template:', error);
            const errorMsg = error.response?.data?.message || error.message || '创建模板时发生网络错误';
            antd_1.message.error({ content: errorMsg, key: 'createPrompt' });
            // Re-throw error so PromptForm can potentially display a general error if needed
            // Consider if the form component needs this re-throw or handles errors internally
            // throw error;
        }
        finally {
            setSubmitting(false);
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)(antd_1.Breadcrumb, { style: { marginBottom: '16px' }, children: [(0, jsx_runtime_1.jsx)(antd_1.Breadcrumb.Item, { children: (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/dashboard", children: "\u4EEA\u8868\u76D8" }) }), (0, jsx_runtime_1.jsx)(antd_1.Breadcrumb.Item, { children: (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: "/prompts", children: "\u63D0\u793A\u8BCD\u6A21\u677F" }) }), (0, jsx_runtime_1.jsx)(antd_1.Breadcrumb.Item, { children: "\u521B\u5EFA\u6A21\u677F" })] }), (0, jsx_runtime_1.jsx)(Title, { level: 2, style: { marginBottom: '24px' }, children: "\u521B\u5EFA\u65B0\u7684\u63D0\u793A\u8BCD\u6A21\u677F" }), (0, jsx_runtime_1.jsx)(PromptForm_1.default, { onSubmit: handleCreate, isEditing: false, submitting: submitting })] }));
};
exports.default = CreatePromptTemplatePage;
