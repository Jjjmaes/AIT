"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const base_1 = require("../../api/base");
const { TextArea } = antd_1.Input;
const { Title, Text } = antd_1.Typography;
const { Option } = antd_1.Select;
const PromptForm = ({ initialValues, onSubmit, isEditing = false, submitting = false, }) => {
    const [form] = antd_1.Form.useForm();
    const [models, setModels] = (0, react_1.useState)([]);
    const [showHelpText, setShowHelpText] = (0, react_1.useState)(false);
    const [detectedVariables, setDetectedVariables] = (0, react_1.useState)([]);
    // 获取AI模型列表
    (0, react_1.useEffect)(() => {
        const fetchModels = async () => {
            try {
                const response = await base_1.axiosInstance.get('/ai-configs/ai-models');
                // Correct access path: response.data contains { success: true, data: { models: [...] } }
                const modelsData = response?.data?.data?.models;
                if (modelsData && Array.isArray(modelsData)) {
                    setModels(modelsData);
                }
                else {
                    console.error('API response for AI models is missing or not an array:', response?.data);
                    antd_1.message.error('获取AI模型数据格式不正确');
                    setModels([]); // Set to empty array to prevent render error
                }
            }
            catch (error) { // Catch network errors or non-2xx status codes
                console.error('获取AI模型失败', error);
                antd_1.message.error('获取AI模型列表失败');
                setModels([]); // Also set to empty array on error
            }
        };
        fetchModels();
        // Cleanup function (optional but good practice)
        return () => {
            // Cancel any pending requests if needed
        };
    }, []);
    // 当编辑时，设置初始值
    (0, react_1.useEffect)(() => {
        if (initialValues && isEditing) {
            form.setFieldsValue(initialValues);
            // 检测变量
            if (initialValues.content) {
                detectVariables(initialValues.content);
            }
        }
    }, [initialValues, form, isEditing]);
    // 检测提示词中的变量
    const detectVariables = (content) => {
        const variableRegex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
        const variables = [];
        let match;
        while ((match = variableRegex.exec(content)) !== null) {
            if (!variables.includes(match[1])) {
                variables.push(match[1]);
            }
        }
        setDetectedVariables(variables);
        // 如果是新建表单，自动填充变量字段
        if (!isEditing) {
            form.setFieldValue('variables', variables);
        }
    };
    // 处理提交
    const handleSubmit = async (values) => {
        try {
            await onSubmit(values);
            if (!isEditing) {
                form.resetFields();
            }
        }
        catch (error) {
            console.error(`${isEditing ? '更新' : '创建'}提示词模板失败`, error);
        }
    };
    // 提示词示例
    const getHelpText = () => {
        const type = form.getFieldValue('type');
        if (type === 'translation') {
            return `示例提示词：
您是一位专业的翻译专家，精通{{sourceLang}}和{{targetLang}}。
请将以下{{sourceLang}}文本翻译成{{targetLang}}：

{{sourceText}}

要求：
1. 保持原文的意思和风格
2. 翻译要自然流畅
3. 专业术语使用规范译法
4. 保留原文格式`;
        }
        else {
            return `示例提示词：
您是一位专业的翻译质量审校专家，精通{{sourceLang}}和{{targetLang}}。
请审校以下翻译，指出任何问题并提供修改建议：

原文({{sourceLang}})：
{{sourceText}}

译文({{targetLang}})：
{{translatedText}}

请按以下格式回答：
1. 修改后的译文：(提供完整修改后的译文)
2. 问题列表：(列出发现的问题，每个问题包括：位置、类型、严重程度、描述)`;
        }
    };
    return ((0, jsx_runtime_1.jsx)(antd_1.Card, { children: (0, jsx_runtime_1.jsxs)(antd_1.Form, { form: form, layout: "vertical", initialValues: {
                isActive: true,
                type: 'translation',
                ...initialValues,
            }, onFinish: handleSubmit, requiredMark: "optional", children: [(0, jsx_runtime_1.jsx)(Title, { level: 4, children: isEditing ? '编辑提示词模板' : '创建提示词模板' }), (0, jsx_runtime_1.jsx)(antd_1.Divider, {}), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "name", label: "\u6A21\u677F\u540D\u79F0", rules: [{ required: true, message: '请输入模板名称' }], children: (0, jsx_runtime_1.jsx)(antd_1.Input, { placeholder: "\u4F8B\u5982\uFF1A\u6280\u672F\u6587\u6863\u7FFB\u8BD1\u63D0\u793A\u8BCD" }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "description", label: "\u63CF\u8FF0", rules: [{ required: true, message: '请输入模板描述' }], children: (0, jsx_runtime_1.jsx)(TextArea, { placeholder: "\u7B80\u8981\u63CF\u8FF0\u6B64\u63D0\u793A\u8BCD\u6A21\u677F\u7684\u7528\u9014\u548C\u9002\u7528\u573A\u666F", rows: 2 }) }), (0, jsx_runtime_1.jsx)(antd_1.Space, { style: { width: '100%' }, direction: "vertical", size: "large", children: (0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "type", label: "\u6A21\u677F\u7C7B\u578B", rules: [{ required: true }], style: { width: 200 }, children: (0, jsx_runtime_1.jsxs)(antd_1.Select, { onChange: () => setShowHelpText(false), children: [(0, jsx_runtime_1.jsx)(Option, { value: "translation", children: "\u7FFB\u8BD1\u63D0\u793A\u8BCD" }), (0, jsx_runtime_1.jsx)(Option, { value: "review", children: "\u5BA1\u6821\u63D0\u793A\u8BCD" })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "modelIdentifier", label: "AI\u6A21\u578B", rules: [{ required: true, message: '请选择AI模型' }], style: { width: 200 }, children: (0, jsx_runtime_1.jsx)(antd_1.Select, { placeholder: "\u9009\u62E9AI\u6A21\u578B", children: models.map(model => ((0, jsx_runtime_1.jsxs)(Option, { value: model.id, children: [model.name, " (", model.provider, ")"] }, model.id))) }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "isActive", label: "\u72B6\u6001", valuePropName: "checked", children: (0, jsx_runtime_1.jsx)(antd_1.Switch, { checkedChildren: "\u5DF2\u542F\u7528", unCheckedChildren: "\u5DF2\u7981\u7528" }) })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "content", label: (0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u63D0\u793A\u8BCD\u5185\u5BB9" }), (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "link", icon: (0, jsx_runtime_1.jsx)(icons_1.InfoCircleOutlined, {}), onClick: () => setShowHelpText(!showHelpText), children: "\u67E5\u770B\u793A\u4F8B" })] }), rules: [{ required: true, message: '请输入提示词内容' }], extra: (0, jsx_runtime_1.jsx)("div", { children: detectedVariables.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { style: { marginTop: 8 }, children: [(0, jsx_runtime_1.jsx)(Text, { strong: true, children: "\u68C0\u6D4B\u5230\u7684\u53D8\u91CF\uFF1A" }), (0, jsx_runtime_1.jsx)("div", { style: { marginTop: 4 }, children: detectedVariables.map(variable => ((0, jsx_runtime_1.jsx)(antd_1.Tag, { color: "blue", children: `{{${variable}}}` }, variable))) })] })) }), children: (0, jsx_runtime_1.jsx)(TextArea, { rows: 10, placeholder: "\u8F93\u5165\u63D0\u793A\u8BCD\u5185\u5BB9\uFF0C\u4F7F\u7528{{\u53D8\u91CF\u540D}}\u8868\u793A\u53D8\u91CF", onChange: (e) => detectVariables(e.target.value) }) }), showHelpText && ((0, jsx_runtime_1.jsx)(antd_1.Card, { size: "small", style: { marginBottom: 16, backgroundColor: '#f5f5f5' }, children: (0, jsx_runtime_1.jsx)("pre", { style: { whiteSpace: 'pre-wrap', margin: 0 }, children: getHelpText() }) })), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "outputFormat", label: "\u8F93\u51FA\u683C\u5F0F", rules: [{ required: true, message: '请输入期望的输出格式' }], children: (0, jsx_runtime_1.jsx)(TextArea, { rows: 4, placeholder: "\u63CF\u8FF0AI\u5E94\u8BE5\u8FD4\u56DE\u7684\u8F93\u51FA\u683C\u5F0F\uFF0C\u5982JSON\u683C\u5F0F\u6216\u7279\u5B9A\u7ED3\u6784" }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "variables", label: "\u53D8\u91CF\u5217\u8868", tooltip: "\u63D0\u793A\u8BCD\u4E2D\u4F7F\u7528\u7684\u53D8\u91CF\uFF0C\u683C\u5F0F\u4E3A{{\u53D8\u91CF\u540D}}", children: (0, jsx_runtime_1.jsx)(antd_1.Select, { mode: "tags", placeholder: "\u8F93\u5165\u53D8\u91CF\u540D\u540E\u6309Enter\u6DFB\u52A0" }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { children: (0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", htmlType: "submit", loading: submitting, disabled: submitting, children: isEditing ? '更新模板' : '创建模板' }), (0, jsx_runtime_1.jsx)(antd_1.Button, { onClick: () => form.resetFields(), children: "\u91CD\u7F6E" })] }) })] }) }));
};
exports.default = PromptForm;
