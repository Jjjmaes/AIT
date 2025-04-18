"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_router_dom_1 = require("react-router-dom");
const fileService_1 = require("../api/fileService");
const fileStore_1 = require("../store/fileStore"); // Import Zustand store AND FileState type
const useFileProgressSSE_1 = require("../hooks/useFileProgressSSE"); // Import SSE hook
const antd_1 = require("antd"); // Import Ant Design components
const icons_1 = require("@ant-design/icons");
const dayjs_1 = __importDefault(require("dayjs")); // For date formatting
// Updated status styling function to match FileType status values
const getStatusStyle = (status) => {
    let backgroundColor = '#f0f0f0';
    let color = '#333';
    switch (status) {
        case 'pending':
            backgroundColor = '#e8f5e9';
            color = '#2e7d32';
            break;
        case 'processing':
        case 'extracted':
        case 'translating':
        case 'reviewing':
            backgroundColor = '#e3f2fd';
            color = '#0d47a1';
            break;
        case 'translated':
        case 'review_completed':
            backgroundColor = '#fff9c4';
            color = '#f57f17';
            break;
        case 'completed':
            backgroundColor = '#dcedc8';
            color = '#33691e';
            break;
        case 'error':
            backgroundColor = '#ffebee';
            color = '#c62828';
            break;
    }
    return { backgroundColor, color, padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', display: 'inline-block' };
};
// Map FileStatus values to Ant Design status prop and icons
const getProgressStatus = (status) => {
    switch (status) {
        case 'completed':
        case 'translated':
        case 'review_completed':
            return 'success';
        case 'error':
            return 'exception';
        case 'translating':
        case 'reviewing':
        case 'processing': // Add processing as active
            return 'active';
        default:
            return 'normal';
    }
};
const getStatusTag = (status) => {
    let color = 'default';
    let icon = (0, jsx_runtime_1.jsx)(icons_1.ClockCircleOutlined, {});
    let text = status.toUpperCase();
    switch (status) {
        case 'pending':
            color = 'default';
            break;
        case 'processing':
        case 'extracted':
            color = 'processing';
            icon = (0, jsx_runtime_1.jsx)(icons_1.SyncOutlined, { spin: true });
            break;
        case 'translating':
            color = 'processing';
            icon = (0, jsx_runtime_1.jsx)(icons_1.TranslationOutlined, {});
            text = 'TRANSLATING';
            break;
        case 'reviewing':
            color = 'processing';
            icon = (0, jsx_runtime_1.jsx)(icons_1.FormOutlined, {});
            text = 'REVIEWING';
            break;
        case 'translated':
        case 'review_completed':
            color = 'warning';
            icon = (0, jsx_runtime_1.jsx)(icons_1.TranslationOutlined, {});
            break;
        case 'completed':
            color = 'success';
            icon = (0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, {});
            break;
        case 'error':
            color = 'error';
            icon = (0, jsx_runtime_1.jsx)(icons_1.ExclamationCircleOutlined, {});
            break;
        default:
            text = status.toUpperCase();
            break;
    }
    return (0, jsx_runtime_1.jsx)(antd_1.Tag, { icon: icon, color: color, children: text });
};
const ProjectFilesPage = () => {
    const { projectId } = (0, react_router_dom_1.useParams)();
    const navigate = (0, react_router_dom_1.useNavigate)();
    // --- Zustand Store Integration --- 
    const filesMap = (0, fileStore_1.useFileStore)((state) => state.files);
    const setFilesInStore = (0, fileStore_1.useFileStore)((state) => state.setFiles);
    const addFileToStore = (0, fileStore_1.useFileStore)((state) => state.addFile);
    // Remove file from store if delete functionality is added later
    // const removeFileFromStore = useFileStore((state) => state.removeFile);
    // --- Initialize SSE Connection --- 
    (0, useFileProgressSSE_1.useFileProgressSSE)(); // This hook manages connection lifecycle
    // Local state for UI interaction (loading, errors, upload form)
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [selectedFile, setSelectedFile] = (0, react_1.useState)(null);
    const [isUploading, setIsUploading] = (0, react_1.useState)(false);
    // Keep uploadError/Success local as they relate to the upload action itself
    const [uploadError, setUploadError] = (0, react_1.useState)(null);
    const [uploadSuccess, setUploadSuccess] = (0, react_1.useState)(null);
    // --- Fetch Initial Data --- 
    const fetchData = (0, react_1.useCallback)(async () => {
        if (!projectId) {
            setError('Project ID is missing');
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const fetchedFiles = await (0, fileService_1.getFilesByProjectId)(projectId);
            // --- Normalize and update the Zustand store --- 
            const normalizedFiles = fetchedFiles.map(f => ({
                id: f._id, // Use _id from backend as id
                projectId: f.projectId,
                fileName: f.fileName || f.originalName || 'Unnamed File',
                originalName: f.originalName,
                fileSize: f.fileSize,
                mimeType: f.mimeType,
                type: f.type, // Assuming type is FileType enum string
                // Handle both potential progress structures from backend
                progress: typeof f.progress === 'number' ? f.progress : f.progress?.percentage ?? 0,
                status: f.status || 'pending', // Default to pending if missing
                storageUrl: f.storageUrl,
                createdAt: f.createdAt,
                updatedAt: f.updatedAt,
                // Add other fields as needed
            }));
            setFilesInStore(normalizedFiles);
            // --- End Store Update --- 
        }
        catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'An error occurred fetching files';
            console.error('Fetch files error:', err);
            setError(errorMsg);
            setFilesInStore([]); // Clear store on error
        }
        finally {
            setIsLoading(false);
        }
    }, [projectId, setFilesInStore]);
    (0, react_1.useEffect)(() => {
        fetchData();
    }, [fetchData]);
    // --- File Upload Handlers --- 
    const handleFileChange = (event) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
            setUploadError(null);
            setUploadSuccess(null);
        }
    };
    const handleUpload = async () => {
        if (!selectedFile || !projectId) {
            setUploadError('No file selected or project ID missing.');
            return;
        }
        setIsUploading(true);
        setUploadError(null);
        setUploadSuccess(null);
        const uploadToastKey = 'uploading';
        antd_1.message.loading({ content: '上传文件中...', key: uploadToastKey, duration: 0 });
        try {
            const uploadedFile = await (0, fileService_1.uploadFile)(selectedFile, projectId);
            // --- Add file to Zustand store --- 
            const normalizedFile = {
                id: uploadedFile._id,
                projectId: uploadedFile.projectId,
                fileName: uploadedFile.fileName || uploadedFile.originalName || 'Unnamed File',
                originalName: uploadedFile.originalName,
                fileSize: uploadedFile.fileSize,
                mimeType: uploadedFile.mimeType,
                type: uploadedFile.type,
                progress: typeof uploadedFile.progress === 'number' ? uploadedFile.progress : uploadedFile.progress?.percentage ?? 0,
                status: uploadedFile.status || 'pending',
                storageUrl: uploadedFile.storageUrl,
                createdAt: uploadedFile.createdAt,
                updatedAt: uploadedFile.updatedAt,
            };
            addFileToStore(normalizedFile);
            // --- End Store Update --- 
            antd_1.message.success({ content: `文件 '${normalizedFile.fileName}' 上传成功！`, key: uploadToastKey, duration: 3 });
            setSelectedFile(null); // Clear the selected file input
            // Reset the file input visually (find a better way if possible)
            const input = document.getElementById('file-upload-input');
            if (input)
                input.value = '';
        }
        catch (err) {
            const errorMsg = err.response?.data?.message || err.message || '文件上传失败。请检查文件或稍后重试。';
            antd_1.message.error({ content: `上传失败: ${errorMsg}`, key: uploadToastKey, duration: 5 });
            console.error('[ProjectFilesPage] Upload failed:', err);
        }
        finally {
            setIsUploading(false);
        }
    };
    // --- Convert Map to Array for Rendering --- 
    const fileList = Array.from(filesMap.values()).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()); // Sort by creation date descending
    // --- Define Table Columns --- 
    const columns = [
        {
            title: '文件名',
            dataIndex: 'fileName',
            key: 'fileName',
            render: (text, record) => (
            // Link to translation center or review page based on status?
            (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: `/projects/${projectId}/files/${record.id}/translate`, children: text })),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status, record) => getStatusTag(status),
        },
        {
            title: '进度',
            dataIndex: 'progress',
            key: 'progress',
            render: (progress, record) => (
            // Use the progress value directly from the store state (already normalized)
            (0, jsx_runtime_1.jsx)(antd_1.Progress, { percent: progress, size: "small", status: getProgressStatus(record.status) })),
        },
        {
            title: '大小',
            dataIndex: 'fileSize',
            key: 'fileSize',
            render: (size, record) => size ? `${(size / 1024).toFixed(2)} KB` : '-',
        },
        {
            title: '上传时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date, record) => date ? (0, dayjs_1.default)(date).format('YYYY-MM-DD HH:mm') : '-',
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => ((0, jsx_runtime_1.jsx)(antd_1.Space, { size: "middle", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { size: "small", onClick: () => navigate(`/projects/${projectId}/files/${record.id}/translate`), children: "\u7F16\u8F91" }) })),
        },
    ];
    // --- Rendering Logic --- 
    return ((0, jsx_runtime_1.jsxs)("div", { style: { maxWidth: '1200px', margin: '0 auto', padding: '1rem' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '1px solid #e0e0e0'
                }, children: [(0, jsx_runtime_1.jsx)("h1", { style: { margin: 0, color: '#333' }, children: "\u9879\u76EE\u6587\u4EF6\u7BA1\u7406" }), (0, jsx_runtime_1.jsx)(react_router_dom_1.Link, { to: `/projects/${projectId}`, style: {
                            padding: '0.5rem 1rem',
                            backgroundColor: 'white',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            color: '#555',
                            textDecoration: 'none'
                        }, children: "\u8FD4\u56DE\u9879\u76EE\u8BE6\u60C5" })] }), error && ((0, jsx_runtime_1.jsx)("div", { style: {
                    padding: '1rem',
                    backgroundColor: '#ffebee',
                    color: '#c62828',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }, children: (0, jsx_runtime_1.jsx)("p", { style: { margin: 0 }, children: error }) })), (0, jsx_runtime_1.jsxs)("div", { style: {
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    marginBottom: '2rem',
                    overflow: 'hidden'
                }, children: [(0, jsx_runtime_1.jsx)("div", { style: {
                            padding: '1rem',
                            backgroundColor: '#f5f5f5',
                            borderBottom: '1px solid #eee',
                            fontWeight: 'bold',
                            fontSize: '1.1rem',
                            color: '#333'
                        }, children: "\u4E0A\u4F20\u65B0\u6587\u4EF6" }), (0, jsx_runtime_1.jsxs)("div", { style: { padding: '1.5rem' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '1.5rem' }, children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "file-upload-input", style: { display: 'block', marginBottom: '0.5rem', fontWeight: '500' }, children: "\u9009\u62E9\u6587\u4EF6:" }), (0, jsx_runtime_1.jsx)("input", { id: "file-upload-input", type: "file", onChange: handleFileChange, style: { border: '1px solid #ccc', padding: '8px', borderRadius: '4px' } }), selectedFile && ((0, jsx_runtime_1.jsxs)("p", { style: { marginTop: '0.75rem', color: '#555', fontSize: '0.9em' }, children: ["\u5DF2\u9009\u62E9: ", selectedFile.name, " (", (selectedFile.size / 1024).toFixed(2), " KB)"] }))] }), (0, jsx_runtime_1.jsxs)("div", { style: { textAlign: 'right' }, children: [uploadError && (0, jsx_runtime_1.jsxs)("p", { style: { color: '#c62828', marginRight: '1rem', display: 'inline-block' }, children: ["\u9519\u8BEF: ", uploadError] }), uploadSuccess && (0, jsx_runtime_1.jsx)("p", { style: { color: '#2e7d32', marginRight: '1rem', display: 'inline-block' }, children: uploadSuccess }), (0, jsx_runtime_1.jsx)("button", { onClick: handleUpload, disabled: !selectedFile || isUploading, style: {
                                            padding: '0.6rem 1.2rem',
                                            backgroundColor: (!selectedFile || isUploading) ? '#e0e0e0' : '#1976d2',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: (!selectedFile || isUploading) ? 'not-allowed' : 'pointer',
                                            fontWeight: 'bold'
                                        }, children: isUploading ? '上传中...' : '上传文件' })] })] })] }), (0, jsx_runtime_1.jsx)("div", { style: { marginTop: '2rem' }, children: (0, jsx_runtime_1.jsx)(antd_1.Table, { columns: columns, dataSource: fileList, rowKey: "id" // Use file.id as the key
                    , loading: isLoading, pagination: { pageSize: 10 } }) })] }));
};
exports.default = ProjectFilesPage;
