"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const { TextArea } = antd_1.Input;
const { Title, Text, Paragraph } = antd_1.Typography;
const SegmentEditor = ({ segment, onUpdate, isUpdating, }) => {
    const [form] = antd_1.Form.useForm();
    const [editedTranslation, setEditedTranslation] = (0, react_1.useState)(segment.target);
    const [hasChanges, setHasChanges] = (0, react_1.useState)(false);
    // Reset form and state when segment changes
    (0, react_1.useEffect)(() => {
        form.setFieldsValue({ translation: segment.target });
        setEditedTranslation(segment.target);
        setHasChanges(false);
    }, [segment, form]);
    // Handle translation change
    const handleTranslationChange = (e) => {
        const newTranslation = e.target.value;
        setEditedTranslation(newTranslation);
        setHasChanges(newTranslation !== segment.target);
    };
    // Handle reset
    const handleReset = () => {
        form.setFieldsValue({ translation: segment.target });
        setEditedTranslation(segment.target);
        setHasChanges(false);
    };
    // Handle confirm
    const handleConfirm = () => {
        onUpdate(segment.id, editedTranslation, true);
    };
    // Handle save without confirming
    const handleSave = () => {
        onUpdate(segment.id, editedTranslation, false);
    };
    // Determine if there are issues
    const hasIssues = segment.issues && segment.issues.length > 0;
    return ((0, jsx_runtime_1.jsx)("div", { className: "segment-editor", children: (0, jsx_runtime_1.jsxs)(antd_1.Card, { bordered: false, children: [(0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [(0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsxs)(Title, { level: 5, style: { margin: 0 }, children: ["\u6BB5\u843D #", segment.segmentNumber] }), segment.status === 'confirmed' ? ((0, jsx_runtime_1.jsx)(antd_1.Badge, { status: "success", text: "\u5DF2\u786E\u8BA4" })) : hasIssues ? ((0, jsx_runtime_1.jsx)(antd_1.Badge, { status: "warning", text: "\u6709\u95EE\u9898" })) : ((0, jsx_runtime_1.jsx)(antd_1.Badge, { status: "default", text: "\u5F85\u786E\u8BA4" }))] }), (0, jsx_runtime_1.jsx)(antd_1.Space, { children: hasChanges && ((0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.UndoOutlined, {}), onClick: handleReset, size: "small", children: "\u91CD\u7F6E" })) })] }), (0, jsx_runtime_1.jsx)(antd_1.Card, { title: (0, jsx_runtime_1.jsx)(Text, { strong: true, children: "\u539F\u6587" }), type: "inner", style: { marginBottom: 16 }, children: (0, jsx_runtime_1.jsx)(Paragraph, { children: segment.source }) }), (0, jsx_runtime_1.jsx)(antd_1.Card, { title: (0, jsx_runtime_1.jsx)(Text, { strong: true, children: "\u8BD1\u6587" }), type: "inner", extra: (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u7F16\u8F91\u8BD1\u6587", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "text", icon: (0, jsx_runtime_1.jsx)(icons_1.EditOutlined, {}), onClick: () => {
                                // Focus the textarea
                                const textarea = document.getElementById(`translation-${segment.id}`);
                                if (textarea) {
                                    textarea.focus();
                                }
                            } }) }), children: (0, jsx_runtime_1.jsx)(antd_1.Form, { form: form, layout: "vertical", initialValues: { translation: segment.target }, children: (0, jsx_runtime_1.jsx)(antd_1.Form.Item, { name: "translation", children: (0, jsx_runtime_1.jsx)(TextArea, { id: `translation-${segment.id}`, rows: 4, onChange: handleTranslationChange, status: hasIssues ? 'warning' : '' }) }) }) }), segment.aiSuggestion && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(antd_1.Divider, { dashed: true, style: { margin: '16px 0' } }), (0, jsx_runtime_1.jsxs)(antd_1.Card, { title: (0, jsx_runtime_1.jsx)(Text, { strong: true, children: "AI\u5BA1\u6821\u5EFA\u8BAE" }), type: "inner", style: { marginBottom: 16, borderColor: '#1890ff' }, children: [(0, jsx_runtime_1.jsx)(Paragraph, { children: segment.aiSuggestion }), (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "link", onClick: () => {
                                        form.setFieldsValue({ translation: segment.aiSuggestion });
                                        setEditedTranslation(segment.aiSuggestion || '');
                                        setHasChanges(segment.aiSuggestion !== segment.target);
                                    }, style: { padding: 0 }, children: "\u5E94\u7528\u5EFA\u8BAE" })] })] })), (0, jsx_runtime_1.jsx)("div", { style: { marginTop: 16, display: 'flex', justifyContent: 'flex-end' }, children: (0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [hasChanges && ((0, jsx_runtime_1.jsx)(antd_1.Button, { onClick: handleSave, loading: isUpdating, children: "\u4FDD\u5B58" })), (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", icon: (0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, {}), onClick: handleConfirm, loading: isUpdating, disabled: segment.status === 'confirmed' && !hasChanges, children: segment.status === 'confirmed' ? '已确认' : '确认' })] }) })] }) }));
};
exports.default = SegmentEditor;
