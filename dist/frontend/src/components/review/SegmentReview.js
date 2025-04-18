"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const markupUtils_1 = require("../../utils/markupUtils");
const fileService_1 = require("../../api/fileService");
const { Title, Text, Paragraph } = antd_1.Typography;
const { TextArea } = antd_1.Input;
const SegmentReview = ({ segmentId, sourceText, aiTranslation, aiReviewedTranslation, status, issues, onSave, onNext, terminology = {}, isSaving = false, saveError = null }) => {
    const [editMode, setEditMode] = (0, react_1.useState)(false);
    const [editedTranslation, setEditedTranslation] = (0, react_1.useState)(aiReviewedTranslation);
    const [highlightedTerms, setHighlightedTerms] = (0, react_1.useState)([]);
    (0, react_1.useEffect)(() => {
        setEditedTranslation(aiReviewedTranslation);
        if (status === fileService_1.SegmentStatus.COMPLETED) {
            setEditMode(false);
        }
    }, [aiReviewedTranslation, status]);
    (0, react_1.useEffect)(() => {
        const terms = Object.keys(terminology);
        const found = terms.filter(term => sourceText.toLowerCase().includes(term.toLowerCase()));
        setHighlightedTerms(found);
    }, [sourceText, terminology]);
    const handleSave = async (completeReview = false) => {
        try {
            const newStatus = completeReview ? fileService_1.SegmentStatus.COMPLETED : fileService_1.SegmentStatus.EDITED;
            await onSave(segmentId, editedTranslation, newStatus);
            if (completeReview) {
                onNext();
            }
        }
        catch (error) {
            console.error('Error saving segment review (handled by parent):', error);
        }
    };
    const renderIssueTag = (issue) => {
        let color = '';
        let icon = null;
        switch (issue.severity) {
            case 'high':
                color = 'error';
                icon = (0, jsx_runtime_1.jsx)(icons_1.WarningOutlined, {});
                break;
            case 'medium':
                color = 'warning';
                break;
            case 'low':
                color = 'default';
                break;
        }
        return ((0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: issue.description, children: (0, jsx_runtime_1.jsx)(antd_1.Tag, { color: color, icon: icon, style: { marginBottom: 8 }, children: issue.type }) }, issue.id));
    };
    const renderSourceText = () => {
        let result = sourceText;
        highlightedTerms.forEach(term => {
            const regex = new RegExp(`(${term})`, 'gi');
            result = result.replace(regex, `<term>$1</term>`);
        });
        return (0, markupUtils_1.markupToReact)(result, {
            term: (content) => ((0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: `术语: ${terminology[content.toLowerCase()]}`, children: (0, jsx_runtime_1.jsx)(Text, { mark: true, children: content }) }))
        });
    };
    return ((0, jsx_runtime_1.jsx)(antd_1.Card, { bordered: true, style: { marginBottom: 16, border: saveError ? '1px solid red' : undefined }, className: `segment-card ${status === fileService_1.SegmentStatus.COMPLETED ? 'segment-completed' : ''}`, children: (0, jsx_runtime_1.jsxs)(antd_1.Row, { gutter: [16, 16], children: [(0, jsx_runtime_1.jsx)(antd_1.Col, { span: 24, children: (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [(0, jsx_runtime_1.jsxs)(Text, { type: "secondary", children: ["\u6BB5\u843DID: ", segmentId] }), (0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [status === fileService_1.SegmentStatus.COMPLETED && ((0, jsx_runtime_1.jsx)(antd_1.Tag, { color: "success", icon: (0, jsx_runtime_1.jsx)(icons_1.CheckOutlined, {}), children: "\u5DF2\u786E\u8BA4" })), status === fileService_1.SegmentStatus.EDITED && ((0, jsx_runtime_1.jsx)(antd_1.Tag, { color: "processing", children: "\u5BA1\u6821\u4E2D" })), status === fileService_1.SegmentStatus.REVIEWING && ((0, jsx_runtime_1.jsx)(antd_1.Tag, { color: "blue", children: "\u8FDB\u884C\u4E2D" })), issues.length > 0 && ((0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: issues.map(iss => `${iss.type}: ${iss.description}`).join(' | '), children: (0, jsx_runtime_1.jsxs)(antd_1.Tag, { color: "warning", icon: (0, jsx_runtime_1.jsx)(icons_1.WarningOutlined, {}), children: [issues.length, " \u4E2A\u95EE\u9898"] }) }))] })] }) }), (0, jsx_runtime_1.jsxs)(antd_1.Col, { span: 24, children: [(0, jsx_runtime_1.jsx)(Title, { level: 5, children: "\u539F\u6587" }), (0, jsx_runtime_1.jsx)(Paragraph, { style: {
                                padding: 12,
                                background: '#f9f9f9',
                                borderRadius: 4,
                                marginBottom: 8
                            }, children: renderSourceText() })] }), (0, jsx_runtime_1.jsxs)(antd_1.Col, { span: 24, children: [(0, jsx_runtime_1.jsx)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: (0, jsx_runtime_1.jsx)(Title, { level: 5, children: "AI\u7FFB\u8BD1" }) }), (0, jsx_runtime_1.jsx)(Paragraph, { style: {
                                padding: 12,
                                background: '#f5f5f5',
                                borderRadius: 4,
                                marginBottom: 8
                            }, children: aiTranslation })] }), (0, jsx_runtime_1.jsxs)(antd_1.Col, { span: 24, children: [(0, jsx_runtime_1.jsx)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: (0, jsx_runtime_1.jsx)(Title, { level: 5, children: "AI\u5BA1\u6821\u7ED3\u679C" }) }), editMode ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(TextArea, { value: editedTranslation, onChange: (e) => setEditedTranslation(e.target.value), autoSize: { minRows: 3, maxRows: 6 }, style: { marginBottom: 16 }, disabled: isSaving }), saveError && (0, jsx_runtime_1.jsx)(antd_1.Alert, { message: saveError, type: "error", showIcon: true, style: { marginBottom: '8px' } }), (0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsx)(antd_1.Button, { onClick: () => setEditMode(false), disabled: isSaving, children: "\u53D6\u6D88" }), (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "default", onClick: () => handleSave(false), loading: isSaving && status !== fileService_1.SegmentStatus.COMPLETED, disabled: isSaving, children: "\u4FDD\u5B58\u4FEE\u6539" }), (0, jsx_runtime_1.jsx)(antd_1.Popconfirm, { title: "\u786E\u8BA4\u6B64\u6BB5\u843D\u7FFB\u8BD1?", description: "\u786E\u8BA4\u540E\u5C06\u6807\u8BB0\u4E3A\u5DF2\u5B8C\u6210", onConfirm: () => handleSave(true), okText: "\u786E\u8BA4", cancelText: "\u53D6\u6D88", icon: (0, jsx_runtime_1.jsx)(icons_1.QuestionCircleOutlined, { style: { color: 'green' } }), disabled: isSaving, children: (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", style: { background: '#52c41a', borderColor: '#52c41a' }, icon: (0, jsx_runtime_1.jsx)(icons_1.CheckOutlined, {}), loading: isSaving && status === fileService_1.SegmentStatus.COMPLETED, disabled: isSaving, children: "\u786E\u8BA4\u901A\u8FC7" }) }), (0, jsx_runtime_1.jsx)(antd_1.Button, { onClick: onNext, disabled: isSaving, children: "\u4E0B\u4E00\u6BB5 \u2192" })] })] })) : ((0, jsx_runtime_1.jsx)(Paragraph, { style: {
                                padding: 12,
                                background: status === fileService_1.SegmentStatus.COMPLETED ? '#f6ffed' : '#f0f7ff',
                                borderRadius: 4,
                                border: `1px solid ${status === fileService_1.SegmentStatus.COMPLETED ? '#b7eb8f' : '#d6e4ff'}`,
                                marginBottom: '8px',
                                cursor: 'pointer'
                            }, onClick: () => setEditMode(true), children: editedTranslation || aiReviewedTranslation }))] }), issues.length > 0 && ((0, jsx_runtime_1.jsxs)(antd_1.Col, { span: 24, children: [(0, jsx_runtime_1.jsx)(antd_1.Divider, { orientation: "left", children: "\u95EE\u9898 & \u4FEE\u6539\u5EFA\u8BAE" }), (0, jsx_runtime_1.jsx)(antd_1.Space, { wrap: true, children: issues.map(renderIssueTag) })] }))] }) }));
};
exports.default = SegmentReview;
