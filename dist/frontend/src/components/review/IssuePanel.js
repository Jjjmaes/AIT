"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const icons_2 = require("@ant-design/icons");
const { Text, Paragraph } = antd_1.Typography;
const IssuePanel = ({ segment, onApplyFix, }) => {
    const issues = segment.issues || [];
    // Map issue types to friendly names
    const getIssueTypeLabel = (type) => {
        const issueTypeMap = {
            'terminology': '术语错误',
            'mistranslation': '误译',
            'omission': '漏译',
            'addition': '过度翻译',
            'grammar': '语法错误',
            'style': '风格问题',
            'punctuation': '标点问题',
            'consistency': '一致性问题',
        };
        return issueTypeMap[type] || type;
    };
    // Get severity color
    const getSeverityColor = (severity) => {
        const colorMap = {
            'high': 'error',
            'medium': 'warning',
            'low': 'default',
        };
        return colorMap[severity] || 'default';
    };
    // Get severity label
    const getSeverityLabel = (severity) => {
        const labelMap = {
            'high': '严重',
            'medium': '中等',
            'low': '轻微',
        };
        return labelMap[severity] || '未知';
    };
    // Render issue diff if available
    const renderIssueDiff = (issue) => {
        if (!issue.originalText || !issue.modifiedText) {
            return null;
        }
        return ((0, jsx_runtime_1.jsxs)(antd_1.Card, { size: "small", style: { marginTop: 8, background: '#f5f5f5' }, children: [(0, jsx_runtime_1.jsx)("div", { style: { marginBottom: 8 }, children: (0, jsx_runtime_1.jsxs)(Text, { type: "secondary", style: { fontSize: '12px' }, children: [(0, jsx_runtime_1.jsx)(icons_1.HighlightOutlined, {}), " \u4FEE\u6539\u5BF9\u6BD4:"] }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(Text, { delete: true, style: { background: '#ffccc7', padding: '0 4px' }, children: issue.originalText }), (0, jsx_runtime_1.jsx)("br", {}), (0, jsx_runtime_1.jsx)(Text, { style: { background: '#d9f7be', padding: '0 4px' }, children: issue.modifiedText })] })] }));
    };
    if (issues.length === 0) {
        return ((0, jsx_runtime_1.jsx)("div", { style: { padding: '40px 0', textAlign: 'center' }, children: (0, jsx_runtime_1.jsx)(antd_1.Empty, { image: (0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, { style: { fontSize: 48, color: '#52c41a' } }), description: (0, jsx_runtime_1.jsx)(Text, { children: "\u8BE5\u6BB5\u843D\u6CA1\u6709\u5BA1\u6821\u95EE\u9898\uFF0C\u8BD1\u6587\u8D28\u91CF\u826F\u597D" }) }) }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "issue-panel", children: [(0, jsx_runtime_1.jsx)(antd_1.Alert, { message: `发现 ${issues.length} 个问题`, description: "\u4EE5\u4E0B\u662FAI\u5BA1\u6821\u8FC7\u7A0B\u4E2D\u53D1\u73B0\u7684\u95EE\u9898\uFF0C\u8BF7\u6839\u636E\u5EFA\u8BAE\u8FDB\u884C\u4FEE\u6539\u6216\u786E\u8BA4", type: "warning", showIcon: true, style: { marginBottom: 16 } }), (0, jsx_runtime_1.jsx)(antd_1.List, { itemLayout: "vertical", dataSource: issues, renderItem: (issue, index) => ((0, jsx_runtime_1.jsx)(antd_1.List.Item, { children: (0, jsx_runtime_1.jsx)(antd_1.Card, { title: (0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsx)(icons_1.WarningOutlined, {}), (0, jsx_runtime_1.jsx)(Text, { strong: true, children: getIssueTypeLabel(issue.type) }), (0, jsx_runtime_1.jsx)(antd_1.Tag, { color: getSeverityColor(issue.severity), children: getSeverityLabel(issue.severity) })] }), style: {
                            borderLeft: `3px solid ${issue.severity === 'high' ? '#ff4d4f' :
                                issue.severity === 'medium' ? '#faad14' :
                                    '#d9d9d9'}`
                        }, children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)(Paragraph, { children: [(0, jsx_runtime_1.jsx)(icons_1.InfoCircleOutlined, { style: { marginRight: 8 } }), issue.description] }), issue.suggestion && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(antd_1.Divider, { style: { margin: '12px 0' } }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)(Text, { strong: true, style: { display: 'block', marginBottom: 8 }, children: [(0, jsx_runtime_1.jsx)(icons_2.DiffOutlined, {}), " \u5EFA\u8BAE\u4FEE\u6539:"] }), (0, jsx_runtime_1.jsx)(Paragraph, { children: issue.suggestion }), (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", size: "small", onClick: () => onApplyFix(issue.suggestion || ''), children: "\u5E94\u7528\u6B64\u4FEE\u6539" })] })] })), renderIssueDiff(issue)] }) }) }, index)) })] }));
};
exports.default = IssuePanel;
