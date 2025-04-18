"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const { Option } = antd_1.Select;
const { Text } = antd_1.Typography;
// We'll use the same enum as defined in the parent component
var SegmentStatus;
(function (SegmentStatus) {
    SegmentStatus["ALL"] = "all";
    SegmentStatus["PENDING"] = "pending";
    SegmentStatus["CONFIRMED"] = "confirmed";
    SegmentStatus["WITH_ISSUES"] = "with_issues";
})(SegmentStatus || (SegmentStatus = {}));
// Common issue types in translation
const ISSUE_TYPES = [
    { value: 'terminology', label: '术语错误' },
    { value: 'mistranslation', label: '误译' },
    { value: 'omission', label: '漏译' },
    { value: 'addition', label: '过度翻译' },
    { value: 'grammar', label: '语法错误' },
    { value: 'style', label: '风格问题' },
    { value: 'punctuation', label: '标点问题' },
    { value: 'consistency', label: '一致性问题' },
];
const ReviewFilter = ({ status, issueType, onChange, }) => {
    // Handle status change
    const handleStatusChange = (e) => {
        onChange(e.target.value, issueType);
    };
    // Handle issue type change
    const handleIssueTypeChange = (value) => {
        onChange(status, value);
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: "review-filter", children: (0, jsx_runtime_1.jsxs)(antd_1.Space, { size: "large", align: "center", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(Text, { type: "secondary", style: { marginRight: 8 }, children: "\u72B6\u6001:" }), (0, jsx_runtime_1.jsxs)(antd_1.Radio.Group, { value: status, onChange: handleStatusChange, buttonStyle: "solid", optionType: "button", children: [(0, jsx_runtime_1.jsxs)(antd_1.Radio.Button, { value: SegmentStatus.ALL, children: [(0, jsx_runtime_1.jsx)(icons_1.AppstoreOutlined, {}), " \u5168\u90E8"] }), (0, jsx_runtime_1.jsxs)(antd_1.Radio.Button, { value: SegmentStatus.PENDING, children: [(0, jsx_runtime_1.jsx)(icons_1.ClockCircleOutlined, {}), " \u5F85\u786E\u8BA4"] }), (0, jsx_runtime_1.jsxs)(antd_1.Radio.Button, { value: SegmentStatus.CONFIRMED, children: [(0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, {}), " \u5DF2\u786E\u8BA4"] }), (0, jsx_runtime_1.jsxs)(antd_1.Radio.Button, { value: SegmentStatus.WITH_ISSUES, children: [(0, jsx_runtime_1.jsx)(icons_1.WarningOutlined, {}), " \u6709\u95EE\u9898"] })] })] }), status === SegmentStatus.WITH_ISSUES && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(Text, { type: "secondary", style: { marginRight: 8 }, children: "\u95EE\u9898\u7C7B\u578B:" }), (0, jsx_runtime_1.jsx)(antd_1.Select, { allowClear: true, placeholder: "\u9009\u62E9\u95EE\u9898\u7C7B\u578B", style: { width: 150 }, value: issueType, onChange: handleIssueTypeChange, children: ISSUE_TYPES.map(type => ((0, jsx_runtime_1.jsx)(Option, { value: type.value, children: type.label }, type.value))) })] }))] }) }));
};
exports.default = ReviewFilter;
