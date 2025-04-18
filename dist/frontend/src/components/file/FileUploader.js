"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const client_1 = __importDefault(require("../../api/client"));
const formatUtils_1 = require("../../utils/formatUtils");
const { Dragger } = antd_1.Upload;
const { Title, Text } = antd_1.Typography;
// 扩展名到图标映射
const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'pdf':
            return (0, jsx_runtime_1.jsx)(icons_1.FilePdfOutlined, {});
        case 'doc':
        case 'docx':
            return (0, jsx_runtime_1.jsx)(icons_1.FileWordOutlined, {});
        case 'xls':
        case 'xlsx':
        case 'csv':
            return (0, jsx_runtime_1.jsx)(icons_1.FileExcelOutlined, {});
        case 'txt':
        case 'md':
        case 'xml':
        case 'json':
            return (0, jsx_runtime_1.jsx)(icons_1.FileTextOutlined, {});
        default:
            return (0, jsx_runtime_1.jsx)(icons_1.FileUnknownOutlined, {});
    }
};
// 默认支持的文件格式
const DEFAULT_SUPPORTED_FORMATS = [
    '.doc', '.docx', '.pdf', '.txt', '.xml', '.json', '.md', '.csv', '.xls', '.xlsx',
    '.mqxliff'
];
const FileUploader = ({ projectId, onUploadComplete, supportedFormats = DEFAULT_SUPPORTED_FORMATS, maxFileSize = 20, // 默认20MB
 }) => {
    const [fileList, setFileList] = (0, react_1.useState)([]);
    const [uploading, setUploading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    // 上传前检查文件类型和大小
    const beforeUpload = (file) => {
        const isFormatValid = supportedFormats.some(format => file.name.toLowerCase().endsWith(format));
        if (!isFormatValid) {
            antd_1.message.error(`不支持${file.name}的文件格式。支持的格式: ${supportedFormats.join(', ')}`);
            return antd_1.Upload.LIST_IGNORE;
        }
        const isSizeValid = file.size / 1024 / 1024 < maxFileSize;
        if (!isSizeValid) {
            antd_1.message.error(`文件必须小于 ${maxFileSize}MB!`);
            return antd_1.Upload.LIST_IGNORE;
        }
        return true;
    };
    // 自定义上传
    const customUpload = async (options) => {
        const { file, onProgress, onSuccess, onError } = options;
        setUploading(true);
        setError(null);
        // 创建FormData
        const formData = new FormData();
        formData.append('file', file);
        try {
            // 创建上传请求
            const response = await client_1.default.post(`/projects/${projectId}/files/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent) => {
                    const percent = progressEvent.total
                        ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                        : 0;
                    onProgress({ percent });
                },
            });
            onSuccess(response.data, file);
            antd_1.message.success(`${file.name} 上传成功`);
            onUploadComplete();
        }
        catch (err) {
            const errorMsg = err.response?.data?.message || '上传失败';
            setError(errorMsg);
            onError({ status: err.response?.status, message: errorMsg });
            antd_1.message.error(`${file.name} 上传失败：${errorMsg}`);
        }
        finally {
            setUploading(false);
        }
    };
    // 处理上传列表变化
    const handleChange = (info) => {
        // Keep only the last X files if needed, or just update the list
        let fileList = [...info.fileList];
        // fileList = fileList.slice(-5); // Example: keep last 5 files
        // Update progress, status etc.
        fileList = fileList.map(file => {
            if (file.response) {
                // Component will show file.url as link
                // file.url = file.response.url; // Example if server returns URL
            }
            return file;
        });
        setFileList(fileList);
    };
    // 处理移除文件
    const handleRemove = (file) => {
        setFileList(prev => prev.filter(item => item.uid !== file.uid));
        return true;
    };
    // 获取格式友好的支持格式列表
    const getSupportedFormatsText = () => {
        return supportedFormats.map(format => format.replace('.', '')).join(', ');
    };
    return ((0, jsx_runtime_1.jsx)(antd_1.Card, { children: (0, jsx_runtime_1.jsxs)(antd_1.Space, { direction: "vertical", style: { width: '100%' }, size: "large", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(Title, { level: 4, children: "\u4E0A\u4F20\u6587\u4EF6" }), (0, jsx_runtime_1.jsxs)(Text, { type: "secondary", children: ["\u652F\u6301\u7684\u683C\u5F0F: ", getSupportedFormatsText(), "\u3002\u5355\u4E2A\u6587\u4EF6\u5927\u5C0F\u9650\u5236: ", maxFileSize, "MB"] })] }), error && ((0, jsx_runtime_1.jsx)(antd_1.Alert, { message: "\u4E0A\u4F20\u9519\u8BEF", description: error, type: "error", showIcon: true, closable: true, onClose: () => setError(null) })), (0, jsx_runtime_1.jsxs)(Dragger, { name: "file", multiple: true, fileList: fileList, beforeUpload: beforeUpload, customRequest: customUpload, onChange: handleChange, onRemove: handleRemove, disabled: uploading, style: { padding: '20px 0' }, children: [(0, jsx_runtime_1.jsx)("p", { className: "ant-upload-drag-icon", children: (0, jsx_runtime_1.jsx)(icons_1.FileAddOutlined, { style: { fontSize: 48, color: '#1890ff' } }) }), (0, jsx_runtime_1.jsx)("p", { className: "ant-upload-text", children: "\u70B9\u51FB\u6216\u62D6\u62FD\u6587\u4EF6\u5230\u6B64\u533A\u57DF\u4E0A\u4F20" }), (0, jsx_runtime_1.jsx)("p", { className: "ant-upload-hint", children: "\u652F\u6301\u5355\u4E2A\u6216\u6279\u91CF\u4E0A\u4F20\u3002\u4E0A\u4F20\u540E\u6587\u4EF6\u5C06\u81EA\u52A8\u89E3\u6790\u5E76\u5206\u6BB5\u3002" })] }), fileList.length > 0 && ((0, jsx_runtime_1.jsx)(antd_1.List, { header: (0, jsx_runtime_1.jsx)("div", { children: "\u4E0A\u4F20\u6587\u4EF6\u5217\u8868" }), bordered: true, dataSource: fileList, renderItem: (file) => ((0, jsx_runtime_1.jsx)(antd_1.List.Item, { actions: [
                            (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.DeleteOutlined, {}), size: "small", danger: true, onClick: () => handleRemove(file), disabled: file.status === 'uploading', children: "\u79FB\u9664" }, "delete")
                        ], children: (0, jsx_runtime_1.jsx)(antd_1.List.Item.Meta, { avatar: getFileIcon(file.name), title: file.name, description: (0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsx)(Text, { type: "secondary", children: (0, formatUtils_1.formatFileSize)(file.size || 0) }), file.status === 'uploading' && ((0, jsx_runtime_1.jsx)(antd_1.Progress, { percent: file.percent, size: "small" })), file.status === 'done' && ((0, jsx_runtime_1.jsx)(antd_1.Tag, { color: "success", children: "\u4E0A\u4F20\u6210\u529F" })), file.status === 'error' && ((0, jsx_runtime_1.jsx)(antd_1.Tag, { color: "error", children: "\u4E0A\u4F20\u5931\u8D25" }))] }) }) })) })), (0, jsx_runtime_1.jsx)("div", { style: { display: 'flex', justifyContent: 'flex-end' }, children: (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", onClick: onUploadComplete, disabled: fileList.some(file => file.status === 'uploading'), children: "\u5B8C\u6210" }) })] }) }));
};
exports.default = FileUploader;
