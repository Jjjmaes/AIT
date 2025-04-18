"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_router_dom_1 = require("react-router-dom");
const fileService_1 = require("../api/fileService");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const SegmentReview_1 = __importDefault(require("../components/review/SegmentReview"));
const base_1 = require("../api/base");
const { Title, Text } = antd_1.Typography;
const { Option } = antd_1.Select;
const { Panel } = antd_1.Collapse;
const FileReviewPage = () => {
    const { projectId, fileId } = (0, react_router_dom_1.useParams)();
    const navigate = (0, react_router_dom_1.useNavigate)();
    // Use the imported ProjectFile type for file details
    const [fileDetails, setFileDetails] = (0, react_1.useState)(null);
    const [editableSegments, setEditableSegments] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [currentPage, setCurrentPage] = (0, react_1.useState)(1);
    const [pageSize, setPageSize] = (0, react_1.useState)(10); // Renamed from segmentsPerPage for clarity with Pagination prop
    const [totalSegmentsCount, setTotalSegmentsCount] = (0, react_1.useState)(0); // Store total count for pagination
    // Filters and Sorting
    const [filterStatus, setFilterStatus] = (0, react_1.useState)([]);
    const [filterIssues, setFilterIssues] = (0, react_1.useState)(undefined); // Use undefined for "all"
    const [sortOrder, setSortOrder] = (0, react_1.useState)('asc');
    // UI State
    const [drawerVisible, setDrawerVisible] = (0, react_1.useState)(false);
    const [terminology, setTerminology] = (0, react_1.useState)({});
    // Fetch Core Data (File Details and Segments)
    const fetchData = (0, react_1.useCallback)(async () => {
        if (!fileId) {
            setError('File ID is missing');
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            // Fetch file details using the service function
            const detailsRes = await (0, fileService_1.getFileDetails)(fileId);
            if (detailsRes.success && detailsRes.data) {
                setFileDetails(detailsRes.data); // Assume data matches ProjectFile type
            }
            else {
                throw new Error(detailsRes.message || 'Failed to load file details');
            }
            // Fetch segments based on current filters and pagination
            const params = {
                page: currentPage,
                limit: pageSize,
                sort: sortOrder === 'asc' ? 'segmentIndex' : '-segmentIndex', // Example sort field
                status: filterStatus.length > 0 ? filterStatus.join(',') : undefined,
                hasIssues: filterIssues,
            };
            const segmentsRes = await (0, fileService_1.getFileSegments)(fileId, params);
            if (segmentsRes.success && segmentsRes.data) {
                setTotalSegmentsCount(segmentsRes.data.total);
                // Map fetched Segment data to EditableSegmentUI for UI state
                const mappedSegments = segmentsRes.data.segments.map((seg) => ({
                    ...seg,
                    isEditing: false,
                    // Initialize currentEditText: use humanReviewedText if available, else aiReviewed, else mt
                    currentEditText: seg.humanReviewedText ?? seg.aiReviewedText ?? seg.mtText ?? '',
                    isSaving: false,
                    saveError: null,
                }));
                setEditableSegments(mappedSegments);
            }
            else {
                throw new Error(segmentsRes.message || 'Failed to load segments');
            }
        }
        catch (err) {
            console.error('Error fetching review data:', err);
            setError(err.message || 'An error occurred loading review data');
            setFileDetails(null); // Clear details on error
            setEditableSegments([]); // Clear segments on error
            setTotalSegmentsCount(0);
        }
        finally {
            setIsLoading(false);
        }
        // Depend on filters, sorting, pagination
    }, [fileId, currentPage, pageSize, filterStatus, filterIssues, sortOrder]);
    // Initial fetch and re-fetch on dependency change
    (0, react_1.useEffect)(() => {
        fetchData();
    }, [fetchData]);
    // Fetch Terminology (can be separate)
    (0, react_1.useEffect)(() => {
        if (!fileId)
            return;
        const fetchTerminology = async () => {
            try {
                // Use the imported api client
                const response = await base_1.axiosInstance.get(`/files/${fileId}/terminology`);
                setTerminology(response.data?.terms || {});
            }
            catch (error) {
                console.error('Error fetching terminology:', error);
                // Optionally show a non-blocking message to the user
            }
        };
        fetchTerminology();
    }, [fileId]);
    // Save segment changes (called by SegmentReview's onSave)
    const handleSaveSegment = (0, react_1.useCallback)(async (segmentId, reviewedText, status) => {
        const segmentIndex = editableSegments.findIndex(s => s._id === segmentId);
        if (segmentIndex === -1)
            return;
        setEditableSegments(prev => prev.map((seg, idx) => idx === segmentIndex ? { ...seg, isSaving: true, saveError: null } : seg));
        try {
            const payload = {
                humanReviewedText: reviewedText,
                status: status,
            };
            const response = await (0, fileService_1.updateSegment)(segmentId, payload); // Use imported service
            if (response.success && response.data) {
                const updatedSegmentData = response.data;
                setEditableSegments(prev => prev.map((seg, idx) => idx === segmentIndex ? {
                    ...seg, // Keep existing editable segment fields
                    ...updatedSegmentData, // Update with fields from API response (like status, potentially updated reviewedText)
                    currentEditText: updatedSegmentData.humanReviewedText ?? '', // Reflect saved text
                    isEditing: false, // Exit edit mode on successful save
                    isSaving: false,
                    saveError: null
                } : seg));
                antd_1.message.success(`段落 ${segmentId} 已保存`);
                // Optimistically update file progress details if needed
                if (fileDetails) {
                    // Recalculate counts based on the *new* status
                    const previousStatus = editableSegments[segmentIndex].status;
                    const completedChange = status === fileService_1.SegmentStatus.COMPLETED ? 1 : (previousStatus === fileService_1.SegmentStatus.COMPLETED ? -1 : 0);
                    const pendingChange = status === fileService_1.SegmentStatus.PENDING_REVIEW ? 1 : (previousStatus === fileService_1.SegmentStatus.PENDING_REVIEW ? -1 : 0);
                    const newCompleted = (fileDetails.completedSegments ?? 0) + completedChange;
                    const newPending = (fileDetails.pendingSegments ?? 0) + pendingChange;
                    const totalSegments = fileDetails.totalSegments ?? 0;
                    const newProgress = totalSegments > 0 ? (newCompleted / totalSegments) * 100 : 0;
                    setFileDetails(prev => prev ? ({
                        ...prev,
                        completedSegments: newCompleted,
                        pendingSegments: newPending,
                        progress: newProgress
                    }) : null);
                }
            }
            else {
                throw new Error(response.message || 'Failed to save segment');
            }
        }
        catch (err) {
            console.error('Save segment error:', err);
            antd_1.message.error(`保存段落 ${segmentId} 失败: ${err.message}`);
            setEditableSegments(prev => prev.map((seg, idx) => idx === segmentIndex ? { ...seg, isSaving: false, saveError: err.message || 'Save failed' } : seg));
            // Re-throw to allow SegmentReview to handle its state if needed
            throw err;
        }
    }, [editableSegments, fileDetails]); // Add dependencies
    // Navigate to the next logical segment or page
    const handleNextSegment = () => {
        // Find the index of the *next* segment that isn't completed
        const currentSegment = editableSegments.find(s => document.activeElement?.closest(`#segment-${s._id}`));
        const currentIdx = currentSegment ? editableSegments.indexOf(currentSegment) : -1;
        let nextIncompleteIdx = -1;
        for (let i = currentIdx + 1; i < editableSegments.length; i++) {
            if (editableSegments[i].status !== fileService_1.SegmentStatus.COMPLETED) {
                nextIncompleteIdx = i;
                break;
            }
        }
        if (nextIncompleteIdx !== -1) {
            // Focus next incomplete segment on the current page
            document.getElementById(`segment-${editableSegments[nextIncompleteIdx]._id}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
            // Potentially focus the textarea within that segment
            // document.querySelector(`#segment-${editableSegments[nextIncompleteIdx]._id} textarea`)?.focus();
        }
        else if (currentPage * pageSize < totalSegmentsCount) {
            // Go to the next page if available
            setCurrentPage(prev => prev + 1);
        }
        else {
            // All segments on all pages are potentially complete
            antd_1.message.success('所有段落审校完成!');
            // Optionally show a modal confirmation
            antd_1.Modal.success({
                title: '审校完成',
                content: '您已完成此文件所有段落的审校。',
                onOk: () => navigate(`/projects/${projectId}/files`) // Use projectId from useParams
            });
        }
    };
    // --- Render Logic ---
    if (isLoading && !fileDetails) { // Show loading spinner only on initial load
        return ((0, jsx_runtime_1.jsx)("div", { style: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }, children: (0, jsx_runtime_1.jsx)(antd_1.Spin, { size: "large", tip: "\u52A0\u8F7D\u5BA1\u6821\u6570\u636E\u4E2D..." }) }));
    }
    if (error && !fileDetails) { // Show full page error if details failed to load
        return (0, jsx_runtime_1.jsx)(antd_1.Alert, { message: "Error Loading Data", description: error, type: "error", showIcon: true, closable: true });
    }
    if (!fileDetails) {
        return (0, jsx_runtime_1.jsx)(antd_1.Empty, { description: "\u672A\u627E\u5230\u6587\u4EF6\u8BE6\u60C5" });
    }
    // Calculate completion stats
    const completedCount = fileDetails.completedSegments ?? 0;
    const totalCount = fileDetails.totalSegments ?? 1; // Avoid division by zero
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    // Main Layout Render
    return ((0, jsx_runtime_1.jsxs)(antd_1.Layout, { style: { minHeight: '100vh', backgroundColor: '#f0f2f5' }, children: [(0, jsx_runtime_1.jsxs)(antd_1.Layout.Header, { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'white',
                    padding: '0 24px',
                    borderBottom: '1px solid #f0f0f0'
                }, children: [(0, jsx_runtime_1.jsxs)(antd_1.Space, { align: "center", children: [(0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.ArrowLeftOutlined, {}), onClick: () => navigate(`/projects/${projectId}/files`), children: "\u8FD4\u56DE\u6587\u4EF6\u5217\u8868" }), (0, jsx_runtime_1.jsx)(icons_1.FileTextOutlined, { style: { fontSize: '20px', marginLeft: '16px' } }), (0, jsx_runtime_1.jsxs)(Title, { level: 4, style: { marginBottom: 0, marginLeft: '8px' }, children: ["\u5BA1\u6821: ", fileDetails.fileName] })] }), (0, jsx_runtime_1.jsx)(antd_1.Space, { children: (0, jsx_runtime_1.jsx)(antd_1.Button, { onClick: () => setDrawerVisible(true), icon: (0, jsx_runtime_1.jsx)(icons_1.InfoCircleOutlined, {}), children: "\u9879\u76EE\u4FE1\u606F" }) })] }), (0, jsx_runtime_1.jsxs)(antd_1.Layout.Content, { style: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }, children: [" ", (0, jsx_runtime_1.jsxs)(antd_1.Card, { style: { margin: '16px 16px 0', flexShrink: 0 }, children: [" ", (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }, children: [(0, jsx_runtime_1.jsxs)(antd_1.Space, { wrap: true, children: [(0, jsx_runtime_1.jsx)(Text, { strong: true, children: "\u7B5B\u9009:" }), (0, jsx_runtime_1.jsxs)(antd_1.Select, { mode: "multiple", placeholder: "\u72B6\u6001", style: { minWidth: 150 }, value: filterStatus, onChange: setFilterStatus, maxTagCount: 1, allowClear: true, children: [(0, jsx_runtime_1.jsx)(Option, { value: fileService_1.SegmentStatus.PENDING_REVIEW, children: "\u5F85\u5BA1\u6821" }), (0, jsx_runtime_1.jsx)(Option, { value: fileService_1.SegmentStatus.EDITED, children: "\u5BA1\u6821\u4E2D" }), (0, jsx_runtime_1.jsx)(Option, { value: fileService_1.SegmentStatus.COMPLETED, children: "\u5DF2\u5B8C\u6210" }), (0, jsx_runtime_1.jsx)(Option, { value: fileService_1.SegmentStatus.REVIEWING, children: "\u8FDB\u884C\u4E2D" })] }), (0, jsx_runtime_1.jsxs)(antd_1.Select, { placeholder: "\u95EE\u9898", style: { minWidth: 120 }, value: filterIssues, onChange: setFilterIssues, allowClear: true, children: [(0, jsx_runtime_1.jsx)(Option, { value: true, children: "\u6709\u95EE\u9898" }), (0, jsx_runtime_1.jsx)(Option, { value: false, children: "\u65E0\u95EE\u9898" })] })] }), (0, jsx_runtime_1.jsxs)(antd_1.Space, { wrap: true, children: [(0, jsx_runtime_1.jsx)(antd_1.Badge, { count: fileDetails.pendingSegments ?? 0, showZero: true, color: "#faad14", style: { marginRight: '10px' }, children: (0, jsx_runtime_1.jsx)(Text, { children: "\u5F85\u5BA1\u6821" }) }), (0, jsx_runtime_1.jsx)(antd_1.Badge, { count: fileDetails.completedSegments ?? 0, showZero: true, color: "#52c41a", children: (0, jsx_runtime_1.jsx)(Text, { children: "\u5DF2\u5B8C\u6210" }) }), (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: sortOrder === 'asc' ? (0, jsx_runtime_1.jsx)(icons_1.SortAscendingOutlined, {}) : (0, jsx_runtime_1.jsx)(icons_1.SortDescendingOutlined, {}), onClick: () => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'), children: "\u6392\u5E8F" })] })] }), (0, jsx_runtime_1.jsx)("div", { style: { display: 'flex', justifyContent: 'center', marginTop: '16px' }, children: (0, jsx_runtime_1.jsx)(antd_1.Pagination, { current: currentPage, pageSize: pageSize, total: totalSegmentsCount, onChange: (page, size) => {
                                        setCurrentPage(page);
                                        if (size !== pageSize)
                                            setPageSize(size); // Update page size if changed
                                    }, onShowSizeChange: (_current, size) => {
                                        setCurrentPage(1); // Reset page to 1 on size change
                                        setPageSize(size);
                                    }, pageSizeOptions: [5, 10, 20, 50], showSizeChanger: true, showQuickJumper: true, showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条` }) })] }), (0, jsx_runtime_1.jsx)("div", { style: { flexGrow: 1, overflowY: 'auto', padding: '16px', background: '#f0f2f5' }, children: isLoading ? ((0, jsx_runtime_1.jsx)("div", { style: { textAlign: 'center', padding: '50px' }, children: (0, jsx_runtime_1.jsx)(antd_1.Spin, { size: "large" }) })) : editableSegments.length === 0 ? ((0, jsx_runtime_1.jsx)(antd_1.Empty, { description: filterStatus.length > 0 || filterIssues !== undefined ? "没有符合筛选条件的段落" : "此文件没有段落" })) : ((0, jsx_runtime_1.jsxs)("div", { style: { maxWidth: '1000px', margin: '0 auto' }, children: [" ", editableSegments.map((segment) => ((0, jsx_runtime_1.jsx)("div", { id: `segment-${segment._id}`, style: { marginBottom: '16px' }, children: (0, jsx_runtime_1.jsx)(SegmentReview_1.default
                                    // Pass Segment data
                                    , { 
                                        // Pass Segment data
                                        segmentId: segment._id, sourceText: segment.sourceText, aiTranslation: segment.mtText || '', 
                                        // Pass editable text from UI state
                                        aiReviewedTranslation: segment.currentEditText, status: segment.status, issues: segment.issues || [], 
                                        // Pass handlers
                                        onSave: handleSaveSegment, onNext: handleNextSegment, terminology: terminology, 
                                        // Pass UI state flags
                                        isSaving: segment.isSaving, saveError: segment.saveError }) }, segment._id)))] })) })] }), (0, jsx_runtime_1.jsx)(antd_1.Drawer, { title: "\u6587\u4EF6\u8BE6\u60C5", placement: "right", onClose: () => setDrawerVisible(false), open: drawerVisible, width: Math.min(450, window.innerWidth - 40), children: fileDetails && ((0, jsx_runtime_1.jsxs)(antd_1.Space, { direction: "vertical", style: { width: '100%' }, size: "middle", children: [(0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u6587\u4EF6\u540D\u79F0", value: fileDetails.fileName }), (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u539F\u59CB\u540D\u79F0", value: fileDetails.originalFilename ?? '-' }), (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u8BED\u8A00\u5BF9", value: `${fileDetails.sourceLanguage} → ${fileDetails.targetLanguage}` }), (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u6587\u4EF6\u72B6\u6001", value: fileDetails.status || '-' }), (0, jsx_runtime_1.jsx)(antd_1.Collapse, { defaultActiveKey: ['progress'], bordered: false, children: (0, jsx_runtime_1.jsx)(Panel, { header: "\u8FDB\u5EA6\u7EDF\u8BA1", children: (0, jsx_runtime_1.jsxs)(antd_1.List, { size: "small", children: [(0, jsx_runtime_1.jsxs)(antd_1.List.Item, { children: ["\u603B\u6BB5\u843D\u6570 ", (0, jsx_runtime_1.jsx)(Text, { strong: true, style: { float: 'right' }, children: fileDetails.totalSegments ?? 0 })] }), (0, jsx_runtime_1.jsxs)(antd_1.List.Item, { children: ["\u5DF2\u5B8C\u6210 ", (0, jsx_runtime_1.jsx)(Text, { strong: true, style: { float: 'right', color: '#52c41a' }, children: fileDetails.completedSegments ?? 0 })] }), (0, jsx_runtime_1.jsxs)(antd_1.List.Item, { children: ["\u5F85\u5BA1\u6821 ", (0, jsx_runtime_1.jsx)(Text, { strong: true, style: { float: 'right', color: '#faad14' }, children: fileDetails.pendingSegments ?? 0 })] }), (0, jsx_runtime_1.jsxs)(antd_1.List.Item, { children: ["\u6574\u4F53\u8FDB\u5EA6 ", (0, jsx_runtime_1.jsx)(antd_1.Progress, { percent: progressPercent, size: "small" })] })] }) }, "progress") }), (0, jsx_runtime_1.jsx)(antd_1.Collapse, { bordered: false, children: (0, jsx_runtime_1.jsx)(Panel, { header: "\u9879\u76EE\u4FE1\u606F", children: (0, jsx_runtime_1.jsxs)(antd_1.Button, { type: "link", icon: (0, jsx_runtime_1.jsx)(icons_1.FileTextOutlined, {}), onClick: () => navigate(`/projects/${projectId}`), style: { padding: 0 }, children: ["\u67E5\u770B\u9879\u76EE\u8BE6\u60C5 (ID: ", projectId, ")"] }) }, "project") }), (0, jsx_runtime_1.jsxs)(Text, { type: "secondary", style: { fontSize: '12px' }, children: ["\u521B\u5EFA\u65F6\u95F4: ", new Date(fileDetails.createdAt).toLocaleString()] })] })) })] }));
};
exports.default = FileReviewPage;
