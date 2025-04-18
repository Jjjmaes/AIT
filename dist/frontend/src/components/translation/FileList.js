"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const dayjs_1 = __importDefault(require("dayjs"));
require("dayjs/locale/zh-cn");
dayjs_1.default.locale('zh-cn');
const { Title, Text } = antd_1.Typography;
const FileList = ({ files, selectedFileIds, onSelectFiles }) => {
    const columns = [
        {
            title: '文件名',
            dataIndex: 'fileName',
            key: 'fileName',
            render: (text, record) => ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(Text, { strong: true, children: text }), record.originalName && record.originalName !== text && ((0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsxs)(Text, { type: "secondary", style: { fontSize: '12px' }, children: ["(\u539F\u540D: ", record.originalName, ")"] }) }))] })),
        },
        {
            title: '大小',
            dataIndex: 'fileSize',
            key: 'fileSize',
            width: 100,
            render: (size) => size != null ? `${(size / 1024).toFixed(2)} KB` : '-',
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status) => {
                let color = 'default';
                let icon = null;
                let text = '未知';
                switch (status) {
                    case 'pending':
                        color = 'cyan';
                        icon = (0, jsx_runtime_1.jsx)(icons_1.ClockCircleOutlined, {});
                        text = '准备就绪';
                        break;
                    case 'processing':
                    case 'extracted':
                    case 'translating':
                    case 'reviewing':
                        color = 'processing';
                        icon = (0, jsx_runtime_1.jsx)(icons_1.SyncOutlined, { spin: true });
                        text = status === 'processing' ? '处理中' :
                            status === 'extracted' ? '提取完成' :
                                status === 'translating' ? '翻译中' :
                                    status === 'reviewing' ? '审校中' :
                                        '进行中';
                        break;
                    case 'translated':
                    case 'review_completed':
                        color = 'warning';
                        icon = (0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, {});
                        text = '待确认/完成';
                        break;
                    case 'completed':
                        color = 'success';
                        icon = (0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, {});
                        text = '已完成';
                        break;
                    case 'error':
                        color = 'error';
                        icon = (0, jsx_runtime_1.jsx)(icons_1.WarningOutlined, {});
                        text = '错误';
                        break;
                    default:
                        console.warn(`[FileList] Encountered unexpected file status: ${status}`);
                        break;
                }
                return (0, jsx_runtime_1.jsx)(antd_1.Tag, { icon: icon, color: color, children: text });
            },
        },
        {
            title: '上传时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180,
            render: (date) => {
                const parsedDate = (0, dayjs_1.default)(date);
                return parsedDate.isValid() ? parsedDate.format('YYYY-MM-DD HH:mm:ss') : '-';
            },
        },
    ];
    // --- Add More Logging ---
    console.log('[FileList] Received files prop:', files);
    // --- End Logging ---
    // --- Defensively ensure we have an array --- 
    const filesArray = Array.isArray(files) ? files : [];
    console.log('[FileList] filesArray value before filter:', filesArray);
    // --- End Defensive Check ---
    // Log actual statuses received
    filesArray.forEach(file => {
        console.log(`[FileList] File ${file.fileName} status: '${file.status}'`);
    });
    // Filter files that are eligible for translation
    const eligibleFiles = filesArray.filter((file) => file && (file.status === 'pending'));
    console.log('[FileList] Eligible files after filter:', eligibleFiles);
    // If no eligible files, show message
    if (eligibleFiles.length === 0) {
        return ((0, jsx_runtime_1.jsxs)("div", { style: { textAlign: 'center', padding: '40px 0' }, children: [(0, jsx_runtime_1.jsx)(antd_1.Empty, { description: (0, jsx_runtime_1.jsx)("span", { children: "\u6CA1\u6709\u72B6\u6001\u4E3A\"\u51C6\u5907\u5C31\u7EEA\"\u7684\u6587\u4EF6\u53EF\u4F9B\u7FFB\u8BD1\u3002\u8BF7\u786E\u4FDD\u6587\u4EF6\u5DF2\u6210\u529F\u4E0A\u4F20\u548C\u5904\u7406\u3002" }) }), (0, jsx_runtime_1.jsx)("div", { style: { marginTop: 20 }, children: (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", onClick: () => window.history.back(), children: "\u8FD4\u56DE\u9879\u76EE" }) })] }));
    }
    const rowSelection = {
        selectedRowKeys: selectedFileIds,
        onChange: (selectedRowKeys) => {
            onSelectFiles(selectedRowKeys);
        },
        getCheckboxProps: (record) => ({
            disabled: record.status !== 'pending',
            name: record.fileName,
        }),
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "file-list-container", children: [(0, jsx_runtime_1.jsx)(Title, { level: 4, children: "\u9009\u62E9\u8981\u7FFB\u8BD1\u7684\u6587\u4EF6" }), (0, jsx_runtime_1.jsx)(Text, { type: "secondary", style: { marginBottom: '16px', display: 'block' }, children: "\u9009\u62E9\u4E0B\u5217\u72B6\u6001\u4E3A\"\u51C6\u5907\u5C31\u7EEA\"\u7684\u6587\u4EF6\u8FDB\u884C\u7FFB\u8BD1\u3002\u60A8\u53EF\u4EE5\u9009\u62E9\u591A\u4E2A\u6587\u4EF6\u540C\u65F6\u7FFB\u8BD1\u3002" }), (0, jsx_runtime_1.jsx)(antd_1.Table, { rowSelection: rowSelection, columns: columns, dataSource: eligibleFiles, rowKey: "_id", pagination: false, bordered: true }), (0, jsx_runtime_1.jsx)("div", { style: { marginTop: '16px', textAlign: 'right' }, children: (0, jsx_runtime_1.jsxs)(Text, { type: "secondary", children: ["\u5DF2\u9009\u62E9 ", selectedFileIds.length, " \u4E2A\u6587\u4EF6"] }) })] }));
};
exports.default = FileList;
