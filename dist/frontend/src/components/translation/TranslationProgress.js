"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const { Title, Text, Paragraph } = antd_1.Typography;
const TranslationProgress = ({ jobId, status, isLoading, onViewReview, }) => {
    // --- Add Log --- 
    console.log('[TranslationProgress] Rendering with props:', { jobId, status, isLoading });
    // --- End Log ---
    if (!jobId) {
        return ((0, jsx_runtime_1.jsx)(antd_1.Empty, { description: "\u6682\u65E0\u7FFB\u8BD1\u4EFB\u52A1" }));
    }
    if (isLoading && !status) {
        return ((0, jsx_runtime_1.jsxs)("div", { style: { textAlign: 'center', padding: '40px 0' }, children: [(0, jsx_runtime_1.jsx)(antd_1.Spin, { size: "large" }), (0, jsx_runtime_1.jsx)("div", { style: { marginTop: 16 }, children: (0, jsx_runtime_1.jsx)(Text, { children: "\u6B63\u5728\u83B7\u53D6\u7FFB\u8BD1\u72B6\u6001..." }) })] }));
    }
    // Determine overall progress
    const overallProgress = status?.progress || 0;
    const isCompleted = status?.status === 'completed';
    const hasErrors = status?.errors && status.errors.length > 0;
    // Determine status text and color
    let statusText = '进行中';
    let statusIcon = (0, jsx_runtime_1.jsx)(icons_1.SyncOutlined, { spin: true });
    if (isCompleted) {
        statusText = '已完成';
        statusIcon = (0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, {});
    }
    else if (hasErrors) {
        statusText = '有错误';
        statusIcon = (0, jsx_runtime_1.jsx)(icons_1.WarningOutlined, {});
    }
    return ((0, jsx_runtime_1.jsx)("div", { className: "translation-progress", children: (0, jsx_runtime_1.jsxs)(antd_1.Card, { bordered: false, children: [(0, jsx_runtime_1.jsx)(Title, { level: 4, children: "\u7FFB\u8BD1\u8FDB\u5EA6" }), (0, jsx_runtime_1.jsxs)(antd_1.Row, { gutter: 24, style: { marginBottom: 24 }, children: [(0, jsx_runtime_1.jsxs)(antd_1.Col, { span: 8, children: [(0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u603B\u4F53\u8FDB\u5EA6", value: overallProgress, suffix: "%", precision: 1, valueStyle: { color: isCompleted ? '#3f8600' : '#1890ff' } }), (0, jsx_runtime_1.jsx)(antd_1.Progress, { percent: overallProgress, status: isCompleted ? "success" : "active", style: { marginTop: 8 } })] }), (0, jsx_runtime_1.jsx)(antd_1.Col, { span: 8, children: (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u72B6\u6001", value: statusText, valueStyle: { color: isCompleted ? '#3f8600' : '#1890ff' }, prefix: statusIcon }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { span: 8, children: (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u5DF2\u5904\u7406\u6587\u4EF6", value: status?.completedFiles || 0, suffix: `/ ${status?.totalFiles || 0}` }) })] }), hasErrors && ((0, jsx_runtime_1.jsx)(antd_1.Alert, { message: "\u7FFB\u8BD1\u8FC7\u7A0B\u4E2D\u9047\u5230\u95EE\u9898", description: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(Paragraph, { children: "\u90E8\u5206\u6587\u4EF6\u53EF\u80FD\u672A\u80FD\u6210\u529F\u7FFB\u8BD1\u3002\u8BF7\u67E5\u770B\u4E0B\u65B9\u8BE6\u60C5\u3002" }), (0, jsx_runtime_1.jsx)("ul", { children: status?.errors?.map((error, index) => ((0, jsx_runtime_1.jsx)("li", { children: error.message }, index))) })] }), type: "warning", showIcon: true, style: { marginBottom: 24 } })), (0, jsx_runtime_1.jsx)(Title, { level: 5, children: "\u6587\u4EF6\u5904\u7406\u8BE6\u60C5" }), (0, jsx_runtime_1.jsx)(antd_1.List, { itemLayout: "horizontal", dataSource: status?.files || [], renderItem: (file) => {
                        // --- Add Log ---
                        console.log('[TranslationProgress] Rendering file item:', file);
                        // --- End Log ---
                        const fileStatus = file.status;
                        let statusTag;
                        switch (fileStatus) {
                            case 'QUEUED':
                                statusTag = (0, jsx_runtime_1.jsx)(antd_1.Tag, { color: "default", children: "\u961F\u5217\u4E2D" });
                                break;
                            case 'TRANSLATING':
                                statusTag = (0, jsx_runtime_1.jsx)(antd_1.Tag, { icon: (0, jsx_runtime_1.jsx)(icons_1.SyncOutlined, { spin: true }), color: "processing", children: "\u7FFB\u8BD1\u4E2D" });
                                break;
                            case 'REVIEWING':
                                statusTag = (0, jsx_runtime_1.jsx)(antd_1.Tag, { icon: (0, jsx_runtime_1.jsx)(icons_1.SyncOutlined, { spin: true }), color: "processing", children: "AI\u5BA1\u6821\u4E2D" });
                                break;
                            case 'TRANSLATED':
                                statusTag = (0, jsx_runtime_1.jsx)(antd_1.Tag, { icon: (0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, {}), color: "success", children: "\u7FFB\u8BD1\u5B8C\u6210" });
                                break;
                            case 'ERROR':
                                statusTag = (0, jsx_runtime_1.jsx)(antd_1.Tag, { color: "error", children: "\u9519\u8BEF" });
                                break;
                            default:
                                statusTag = (0, jsx_runtime_1.jsx)(antd_1.Tag, { color: "default", children: "\u672A\u77E5" });
                        }
                        return ((0, jsx_runtime_1.jsx)(antd_1.List.Item, { actions: [
                                fileStatus === 'TRANSLATED' && ((0, jsx_runtime_1.jsx)(antd_1.Button, { type: "link", icon: (0, jsx_runtime_1.jsx)(icons_1.FileTextOutlined, {}), onClick: () => onViewReview(file.id), children: "\u67E5\u770B\u5BA1\u6821" }))
                            ], children: (0, jsx_runtime_1.jsx)(antd_1.List.Item.Meta, { title: (0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsx)(Text, { children: file.originalName }), statusTag] }), description: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)(Text, { type: "secondary", children: [file.sourceLanguage, " \u2192 ", file.targetLanguage] }), (0, jsx_runtime_1.jsx)("div", { style: { marginTop: 8 }, children: (0, jsx_runtime_1.jsx)(antd_1.Progress, { percent: file.progress || 0, size: "small", status: fileStatus === 'ERROR'
                                                    ? 'exception'
                                                    : fileStatus === 'TRANSLATED'
                                                        ? 'success'
                                                        : 'active' }) })] }) }) }));
                    } }), isCompleted && ((0, jsx_runtime_1.jsx)("div", { style: { textAlign: 'center', marginTop: 24 }, children: (0, jsx_runtime_1.jsxs)(Paragraph, { type: "success", children: [(0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, {}), " \u7FFB\u8BD1\u548C\u81EA\u52A8\u5BA1\u6821\u5DF2\u5B8C\u6210\uFF01\u60A8\u73B0\u5728\u53EF\u4EE5\u8FDB\u5165\u5BA1\u6821\u9875\u9762\u67E5\u770B\u7ED3\u679C\u3002"] }) }))] }) }));
};
exports.default = TranslationProgress;
