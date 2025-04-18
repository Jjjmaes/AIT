"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const { Title, Text, Paragraph } = antd_1.Typography;
const { Option } = antd_1.Select;
const TranslationSettings = ({ project, promptTemplates, reviewPromptTemplates, // <-- ADDED: Receive prop
aiConfigs, terminologyBases, // <-- Receive new prop
translationMemories, // <-- Receive new prop
settings, onSettingsChange, }) => {
    const [form] = antd_1.Form.useForm();
    // Initialize form with default/current values
    (0, react_1.useEffect)(() => {
        if (project) {
            const initialFormValues = {
                promptTemplateId: settings.promptTemplateId || project.defaultTranslationPromptTemplate || '',
                reviewPromptTemplateId: settings.reviewPromptTemplateId || project.defaultReviewPromptTemplate || '',
                aiModelId: settings.aiModelId || (aiConfigs?.[0]?.id || ''),
                useTerminology: settings.useTerminology || false,
                terminologyBaseId: settings.terminologyBaseId || null,
                useTranslationMemory: settings.useTranslationMemory || false,
                translationMemoryId: settings.translationMemoryId || null,
                retranslateTM: settings.retranslateTM || false, // <-- Initialize form value
            };
            form.setFieldsValue(initialFormValues);
        }
    }, [project, aiConfigs, settings, form]);
    const handleValuesChange = (_changedValues, allValues) => {
        const updatedValues = { ...allValues };
        if (!allValues.useTerminology) {
            updatedValues.terminologyBaseId = null;
        }
        if (!allValues.useTranslationMemory) {
            updatedValues.translationMemoryId = null;
        }
        onSettingsChange(updatedValues);
    };
    // Prepare initialValues for the Form component itself
    const formInitialValues = {
        promptTemplateId: settings.promptTemplateId || project?.defaultTranslationPromptTemplate || '',
        reviewPromptTemplateId: settings.reviewPromptTemplateId || project?.defaultReviewPromptTemplate || '',
        aiModelId: settings.aiModelId || (aiConfigs?.[0]?.id || ''),
        useTerminology: settings.useTerminology || false,
        terminologyBaseId: settings.terminologyBaseId || null,
        useTranslationMemory: settings.useTranslationMemory || false,
        translationMemoryId: settings.translationMemoryId || null,
        retranslateTM: settings.retranslateTM || false, // <-- Initialize form value
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "translation-settings", children: [(0, jsx_runtime_1.jsx)(Title, { level: 4, children: "\u7FFB\u8BD1\u8BBE\u7F6E" }), (0, jsx_runtime_1.jsx)(Paragraph, { children: "\u914D\u7F6E\u4EE5\u4E0B\u53C2\u6570\u6765\u63A7\u5236AI\u7FFB\u8BD1\u7684\u884C\u4E3A\u548C\u7ED3\u679C\u8D28\u91CF\u3002\u9009\u62E9\u9002\u5408\u60A8\u9879\u76EE\u7684\u63D0\u793A\u8BCD\u6A21\u677F\u548CAI\u6A21\u578B\u3002" }), (0, jsx_runtime_1.jsxs)(antd_1.Form, { form: form, layout: "vertical", onValuesChange: handleValuesChange, initialValues: formInitialValues, children: [(0, jsx_runtime_1.jsxs)(antd_1.Card, { title: "\u57FA\u672C\u8BBE\u7F6E", bordered: false, style: { marginBottom: '24px' }, children: [(0, jsx_runtime_1.jsx)(antd_1.Form.Item, { label: (0, jsx_runtime_1.jsxs)("span", { children: ["\u7FFB\u8BD1\u63D0\u793A\u8BCD\u6A21\u677F", (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u7FFB\u8BD1\u63D0\u793A\u8BCD\u6A21\u677F\u51B3\u5B9A\u4E86AI\u5982\u4F55\u7406\u89E3\u548C\u6267\u884C\u7FFB\u8BD1\u4EFB\u52A1", children: (0, jsx_runtime_1.jsx)(icons_1.InfoCircleOutlined, { style: { marginLeft: 8 } }) })] }), name: "promptTemplateId", rules: [{ required: true, message: '请选择翻译提示词模板' }], children: (0, jsx_runtime_1.jsxs)(antd_1.Select, { placeholder: "\u9009\u62E9\u7FFB\u8BD1\u63D0\u793A\u8BCD\u6A21\u677F", children: [promptTemplates.map(template => ((0, jsx_runtime_1.jsxs)(Option, { value: template._id, children: [template.name, template._id === project?.defaultTranslationPromptTemplate && ' (项目默认)'] }, template._id))), promptTemplates.length === 0 && (0, jsx_runtime_1.jsx)(Option, { value: "", disabled: true, children: "\u65E0\u53EF\u7528\u7FFB\u8BD1\u6A21\u677F" })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { label: (0, jsx_runtime_1.jsxs)("span", { children: ["\u5BA1\u6821\u63D0\u793A\u8BCD\u6A21\u677F", (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u5BA1\u6821\u63D0\u793A\u8BCD\u6A21\u677F\u7528\u4E8EAI\u8F85\u52A9\u5BA1\u6821\u6216\u751F\u6210\u5BA1\u6821\u5EFA\u8BAE", children: (0, jsx_runtime_1.jsx)(icons_1.InfoCircleOutlined, { style: { marginLeft: 8 } }) })] }), name: "reviewPromptTemplateId", rules: [{ required: true, message: '请选择审校提示词模板' }], children: (0, jsx_runtime_1.jsxs)(antd_1.Select, { placeholder: "\u9009\u62E9\u5BA1\u6821\u63D0\u793A\u8BCD\u6A21\u677F", children: [reviewPromptTemplates.map(template => ((0, jsx_runtime_1.jsxs)(Option, { value: template._id, children: [template.name, template._id === project?.defaultReviewPromptTemplate && ' (项目默认)'] }, template._id))), reviewPromptTemplates.length === 0 && (0, jsx_runtime_1.jsx)(Option, { value: "", disabled: true, children: "\u65E0\u53EF\u7528\u5BA1\u6821\u6A21\u677F" })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { label: (0, jsx_runtime_1.jsxs)("span", { children: ["AI\u5F15\u64CE", (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u4E0D\u540C\u7684AI\u5F15\u64CE\u6709\u4E0D\u540C\u7684\u80FD\u529B\u548C\u6210\u672C", children: (0, jsx_runtime_1.jsx)(icons_1.InfoCircleOutlined, { style: { marginLeft: 8 } }) })] }), name: "aiModelId", rules: [{ required: true, message: '请选择AI引擎' }], children: (0, jsx_runtime_1.jsx)(antd_1.Radio.Group, { children: (0, jsx_runtime_1.jsxs)(antd_1.Space, { direction: "vertical", children: [aiConfigs?.map(config => ((0, jsx_runtime_1.jsx)(antd_1.Radio, { value: config._id, children: (0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsx)(icons_1.ExperimentOutlined, {}), (0, jsx_runtime_1.jsx)("span", { children: config.providerName }), (0, jsx_runtime_1.jsx)(Text, { type: "secondary", children: config.notes })] }) }, config._id))), !aiConfigs || aiConfigs.length === 0 && (0, jsx_runtime_1.jsx)(Text, { type: "secondary", children: "\u65E0\u53EF\u7528AI\u5F15\u64CE" })] }) }) })] }), (0, jsx_runtime_1.jsxs)(antd_1.Card, { title: "\u9AD8\u7EA7\u9009\u9879", bordered: false, children: [(0, jsx_runtime_1.jsx)(antd_1.Form.Item, { label: (0, jsx_runtime_1.jsxs)("span", { children: ["\u4F7F\u7528\u672F\u8BED\u5E93", (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u542F\u7528\u540E\uFF0C\u7FFB\u8BD1\u5C06\u4F7F\u7528\u9879\u76EE\u672F\u8BED\u5E93\u786E\u4FDD\u672F\u8BED\u4E00\u81F4\u6027", children: (0, jsx_runtime_1.jsx)(icons_1.InfoCircleOutlined, { style: { marginLeft: 8 } }) })] }), name: "useTerminology", valuePropName: "checked", children: (0, jsx_runtime_1.jsx)(antd_1.Switch, {}) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { noStyle: true, shouldUpdate: (prevValues, currentValues) => prevValues.useTerminology !== currentValues.useTerminology, children: ({ getFieldValue }) => getFieldValue('useTerminology') ? ((0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "terminologyBaseId", label: "\u9009\u62E9\u672F\u8BED\u5E93", rules: [{ required: true, message: '请选择要使用的术语库' }], style: { marginLeft: '24px', marginBottom: '16px' }, children: (0, jsx_runtime_1.jsxs)(antd_1.Select, { placeholder: "\u9009\u62E9\u672F\u8BED\u5E93", children: [terminologyBases?.map(tb => ((0, jsx_runtime_1.jsx)(Option, { value: tb.id, children: tb.name }, tb.id))), !terminologyBases || terminologyBases.length === 0 && ((0, jsx_runtime_1.jsx)(Option, { value: "", disabled: true, children: "\u65E0\u53EF\u7528\u672F\u8BED\u5E93" }))] }) })) : null }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { label: (0, jsx_runtime_1.jsxs)("span", { children: ["\u4F7F\u7528\u7FFB\u8BD1\u8BB0\u5FC6\u5E93", (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u542F\u7528\u540E\uFF0C\u7FFB\u8BD1\u5C06\u67E5\u8BE2\u8BB0\u5FC6\u5E93\u63D0\u9AD8\u4E00\u81F4\u6027", children: (0, jsx_runtime_1.jsx)(icons_1.BookOutlined, { style: { marginLeft: 8 } }) })] }), name: "useTranslationMemory", valuePropName: "checked", children: (0, jsx_runtime_1.jsx)(antd_1.Switch, {}) }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { noStyle: true, shouldUpdate: (prevValues, currentValues) => prevValues.useTranslationMemory !== currentValues.useTranslationMemory, children: ({ getFieldValue }) => getFieldValue('useTranslationMemory') ? ((0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "translationMemoryId", label: "\u9009\u62E9\u7FFB\u8BD1\u8BB0\u5FC6\u5E93", rules: [{ required: true, message: '请选择要使用的翻译记忆库' }], style: { marginLeft: '24px', marginBottom: '16px' }, children: (0, jsx_runtime_1.jsxs)(antd_1.Select, { placeholder: "\u9009\u62E9\u7FFB\u8BD1\u8BB0\u5FC6\u5E93", children: [translationMemories?.map(tm => ((0, jsx_runtime_1.jsx)(Option, { value: tm.id, children: tm.name }, tm.id))), !translationMemories || translationMemories.length === 0 && ((0, jsx_runtime_1.jsx)(Option, { value: "", disabled: true, children: "\u6CA1\u6709\u53EF\u7528\u7684\u7FFB\u8BD1\u8BB0\u5FC6\u5E93" }))] }) })) : null }), (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { label: (0, jsx_runtime_1.jsxs)("span", { children: ["\u91CD\u65B0\u7FFB\u8BD1TM\u5339\u914D\u7247\u6BB5", (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u542F\u7528\u540E\uFF0C\u5373\u4F7F\u7247\u6BB5\u5DF2\u901A\u8FC7\u7FFB\u8BD1\u8BB0\u5FC6\u5E93\u5339\u914D (TRANSLATED_TM)\uFF0C\u4E5F\u4F1A\u5C06\u5176\u5305\u542B\u5728\u7FFB\u8BD1\u4EFB\u52A1\u4E2D\uFF08\u662F\u5426\u5B9E\u9645\u91CD\u65B0\u7FFB\u8BD1\u53D6\u51B3\u4E8E\u670D\u52A1\u903B\u8F91\uFF09", children: (0, jsx_runtime_1.jsx)(icons_1.InfoCircleOutlined, { style: { marginLeft: 8 } }) })] }), name: "retranslateTM", valuePropName: "checked", children: (0, jsx_runtime_1.jsx)(antd_1.Switch, {}) })] })] })] }));
};
exports.default = TranslationSettings;
