"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const antd_1 = require("antd");
const { Text, Paragraph } = antd_1.Typography;
const SegmentList = ({ segments, currentSegmentId, onSelectSegment, }) => {
    // Function to get status badge
    const getStatusBadge = (segment) => {
        if (segment.status === 'confirmed') {
            return (0, jsx_runtime_1.jsx)(antd_1.Badge, { status: "success", text: "\u5DF2\u786E\u8BA4" });
        }
        if (segment.issues && segment.issues.length > 0) {
            return ((0, jsx_runtime_1.jsx)(antd_1.Badge, { status: "warning", text: (0, jsx_runtime_1.jsxs)("span", { children: ["\u6709\u95EE\u9898 ", (0, jsx_runtime_1.jsx)(antd_1.Tag, { color: "warning", children: segment.issues.length })] }) }));
        }
        return (0, jsx_runtime_1.jsx)(antd_1.Badge, { status: "default", text: "\u5F85\u786E\u8BA4" });
    };
    // Function to truncate text
    const truncateText = (text, maxLength = 40) => {
        if (text.length <= maxLength)
            return text;
        return text.substring(0, maxLength) + '...';
    };
    // Function to render item
    const renderListItem = (segment) => {
        const hasIssues = segment.issues && segment.issues.length > 0;
        return ((0, jsx_runtime_1.jsx)(antd_1.List.Item, { onClick: () => onSelectSegment(segment.id), className: `segment-list-item ${currentSegmentId === segment.id ? 'segment-list-item-active' : ''}`, style: {
                padding: '12px 16px',
                cursor: 'pointer',
                background: currentSegmentId === segment.id ? '#e6f7ff' : 'white',
                borderLeft: currentSegmentId === segment.id ? '3px solid #1890ff' : '3px solid transparent',
            }, children: (0, jsx_runtime_1.jsxs)("div", { style: { width: '100%' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 8 }, children: [(0, jsx_runtime_1.jsxs)(Text, { strong: true, children: ["#", segment.segmentNumber] }), getStatusBadge(segment)] }), (0, jsx_runtime_1.jsxs)(Paragraph, { style: {
                            margin: 0,
                            fontSize: '13px',
                            color: '#666',
                            marginBottom: 4
                        }, children: [(0, jsx_runtime_1.jsx)(Text, { type: "secondary", children: "\u539F\u6587: " }), truncateText(segment.source)] }), (0, jsx_runtime_1.jsxs)(Paragraph, { style: {
                            margin: 0,
                            fontSize: '13px',
                            borderLeft: hasIssues ? '2px solid #faad14' : 'none',
                            paddingLeft: hasIssues ? 8 : 0,
                        }, children: [(0, jsx_runtime_1.jsx)(Text, { type: "secondary", children: "\u8BD1\u6587: " }), truncateText(segment.target)] }), hasIssues && segment.issues && ((0, jsx_runtime_1.jsx)("div", { style: { marginTop: 4 }, children: segment.issues.map((issue, index) => ((0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: issue.description, children: (0, jsx_runtime_1.jsx)(antd_1.Tag, { color: issue.severity === 'high' ? 'error' :
                                    issue.severity === 'medium' ? 'warning' :
                                        'default', style: { margin: '2px 4px 2px 0' }, children: issue.type }) }, index))) }))] }) }, segment.id));
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "segment-list", children: [(0, jsx_runtime_1.jsxs)("div", { className: "segment-list-header", style: { padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }, children: [(0, jsx_runtime_1.jsx)(Text, { strong: true, children: "\u6BB5\u843D\u5217\u8868" }), (0, jsx_runtime_1.jsxs)(Text, { type: "secondary", style: { marginLeft: 8 }, children: ["\u5171 ", segments.length, " \u4E2A\u6BB5\u843D"] })] }), (0, jsx_runtime_1.jsx)(antd_1.List, { dataSource: segments, renderItem: renderListItem, style: {
                    maxHeight: 'calc(100vh - 300px)',
                    overflowY: 'auto',
                    border: '1px solid #f0f0f0',
                    borderRadius: 4,
                } })] }));
};
exports.default = SegmentList;
