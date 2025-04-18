"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const antd_1 = require("antd");
const dayjs_1 = __importDefault(require("dayjs"));
const { Text } = antd_1.Typography;
const FileList = ({ files, selectedFileIds, onSelectedFilesChange, loading = false }) => {
    // Filter files for eligibility (you can adjust this based on your criteria)
    const eligibleFiles = (0, react_1.useMemo)(() => {
        return files.filter(file => file.status !== 'processing' && file.status !== 'error');
    }, [files]);
    const columns = [
        {
            title: 'File Name',
            dataIndex: 'originalName',
            key: 'originalName',
            render: (text) => (0, jsx_runtime_1.jsx)(Text, { strong: true, children: text })
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                let color = 'default';
                if (status === 'ready')
                    color = 'green';
                if (status === 'processing')
                    color = 'blue';
                if (status === 'error')
                    color = 'red';
                return (0, jsx_runtime_1.jsx)(antd_1.Tag, { color: color, children: status.toUpperCase() });
            }
        },
        {
            title: 'Size',
            dataIndex: 'size',
            key: 'size',
            render: (size) => {
                // Convert bytes to KB or MB
                if (size < 1024) {
                    return `${size} B`;
                }
                else if (size < 1024 * 1024) {
                    return `${(size / 1024).toFixed(2)} KB`;
                }
                else {
                    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
                }
            }
        },
        {
            title: 'Uploaded',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => (0, dayjs_1.default)(date).format('YYYY-MM-DD HH:mm')
        }
    ];
    const rowSelection = {
        selectedRowKeys: selectedFileIds,
        onChange: (selectedRowKeys) => {
            onSelectedFilesChange(selectedRowKeys);
        }
    };
    return ((0, jsx_runtime_1.jsx)(antd_1.Table, { rowSelection: rowSelection, columns: columns, dataSource: eligibleFiles.map(file => ({ ...file, key: file._id })), pagination: { pageSize: 5 }, loading: loading }));
};
exports.default = FileList;
