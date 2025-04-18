"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_router_dom_1 = require("react-router-dom");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const react_query_1 = require("@tanstack/react-query");
const antd_2 = require("antd");
const fileService_1 = require("../api/fileService");
const SegmentList_1 = __importDefault(require("../components/review/SegmentList"));
const SegmentEditor_1 = __importDefault(require("../components/review/SegmentEditor"));
const ReviewFilter_1 = __importDefault(require("../components/review/ReviewFilter"));
const IssuePanel_1 = __importDefault(require("../components/review/IssuePanel"));
const { Title, Text } = antd_1.Typography;
const { TabPane } = antd_1.Tabs;
// Local status enum for ReviewFilter component (matches its internal definition)
var SegmentStatus;
(function (SegmentStatus) {
    SegmentStatus["ALL"] = "all";
    SegmentStatus["PENDING"] = "pending";
    SegmentStatus["CONFIRMED"] = "confirmed";
    SegmentStatus["WITH_ISSUES"] = "with_issues";
})(SegmentStatus || (SegmentStatus = {}));
// --- Helper Function to Map Segment Data --- 
const mapSegmentForUI = (segment) => {
    if (!segment)
        return undefined;
    return {
        id: segment._id,
        segmentNumber: segment.segmentIndex,
        source: segment.sourceText,
        target: segment.humanReviewedText ?? segment.aiReviewedText ?? segment.mtText ?? '',
        // Map backend status to the simple status expected by UI components
        status: segment.status === fileService_1.SegmentStatus.COMPLETED ? 'confirmed' : 'pending',
        issues: segment.issues,
        aiSuggestion: segment.aiReviewedText
    };
};
const ReviewWorkspacePage = () => {
    const { fileId } = (0, react_router_dom_1.useParams)();
    const navigate = (0, react_router_dom_1.useNavigate)();
    const queryClient = (0, react_query_1.useQueryClient)();
    // State for current segment and filters
    const [currentSegmentId, setCurrentSegmentId] = (0, react_1.useState)(null);
    const [filterStatus, setFilterStatus] = (0, react_1.useState)(SegmentStatus.ALL);
    const [filterIssueType, setFilterIssueType] = (0, react_1.useState)(null);
    // Fetch file data
    const { data: file, isLoading: fileLoading, error: fileError } = (0, react_query_1.useQuery)({
        queryKey: ['file', fileId],
        queryFn: () => (0, fileService_1.getFileDetails)(fileId),
        enabled: !!fileId,
        select: (res) => res?.data
    });
    // Build filter parameters for API call
    const buildFilterParams = () => {
        const params = {};
        // Map local SegmentStatus (from ReviewFilter) to backend BackendSegmentStatus
        if (filterStatus === SegmentStatus.PENDING) {
            params.status = fileService_1.SegmentStatus.PENDING_REVIEW; // Adjust as needed
        }
        else if (filterStatus === SegmentStatus.CONFIRMED) {
            params.status = fileService_1.SegmentStatus.COMPLETED;
        }
        else if (filterStatus === SegmentStatus.WITH_ISSUES) {
            params.hasIssues = true;
        }
        if (filterIssueType) {
            params.issueType = filterIssueType;
        }
        return params;
    };
    // Fetch segments with filtering
    const { data: segmentsData, isLoading: segmentsLoading, error: segmentsError } = (0, react_query_1.useQuery)({
        queryKey: ['fileSegments', fileId, filterStatus, filterIssueType],
        queryFn: () => (0, fileService_1.getFileSegments)(fileId, buildFilterParams()),
        enabled: !!fileId,
        // Data structure from API: { segments: Segment[], total: number }
        select: (res) => res?.data
    });
    // Set first segment as current when data loads
    (0, react_1.useEffect)(() => {
        // Reset current segment if the segments list is empty or loading
        if (segmentsLoading || !segmentsData?.segments || segmentsData.segments.length === 0) {
            setCurrentSegmentId(null);
            return;
        }
        // If no segment is selected, or the selected one is not in the current list, select the first one
        const currentSegmentExists = segmentsData.segments.some(s => s._id === currentSegmentId);
        if (!currentSegmentId || !currentSegmentExists) {
            setCurrentSegmentId(segmentsData.segments[0]._id);
        }
    }, [segmentsData, segmentsLoading, currentSegmentId]);
    // Find the original segment object from the fetched data
    const originalCurrentSegment = segmentsData?.segments?.find((segment) => segment._id === currentSegmentId);
    // Map the segment for UI components
    const currentSegmentForUI = mapSegmentForUI(originalCurrentSegment);
    // Mutation to update segment status via fileService.updateSegment
    const confirmSegmentMutation = (0, react_query_1.useMutation)({
        mutationFn: (params) => (0, fileService_1.updateSegment)(params.segmentId, {
            humanReviewedText: params.translation,
            status: fileService_1.SegmentStatus.COMPLETED // Use backend enum
        }),
        onSuccess: (updatedSegment) => {
            queryClient.invalidateQueries({ queryKey: ['fileSegments', fileId] });
            antd_2.message.success(`段落 ${updatedSegment.data?.segmentIndex ?? ''} 已确认`);
        },
        onError: (error) => {
            antd_2.message.error(`确认段落失败: ${error?.message || '未知错误'}`);
        }
    });
    // Batch confirm segments mutation - Placeholder
    const batchConfirmMutation = (0, react_query_1.useMutation)({
        mutationFn: async (/* params */ { /* fileId, */ segmentIds }) => {
            console.warn('Batch confirm function not implemented yet. Using placeholder.');
            let success = true;
            for (const segmentId of segmentIds) {
                try {
                    const segmentToConfirm = segmentsData?.segments?.find(s => s._id === segmentId);
                    if (segmentToConfirm) {
                        await (0, fileService_1.updateSegment)(segmentId, {
                            humanReviewedText: segmentToConfirm.humanReviewedText ?? segmentToConfirm.aiReviewedText ?? segmentToConfirm.mtText ?? '',
                            status: fileService_1.SegmentStatus.COMPLETED // Use backend enum
                        });
                    }
                    else {
                        console.warn(`Segment ${segmentId} not found for batch confirm`);
                    }
                }
                catch (e) {
                    console.error(`Failed to batch confirm segment ${segmentId}:`, e);
                    success = false;
                }
            }
            return { success };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['fileSegments', fileId] });
            if (result.success) {
                antd_2.message.success('选定段落已批量确认');
            }
            else {
                antd_2.message.error('批量确认过程中部分段落失败');
            }
        },
        onError: (error) => {
            antd_2.message.error(`批量确认失败: ${error?.message || '未知错误'}`);
        }
    });
    // Handle segment selection from SegmentList (receives _id)
    const handleSelectSegment = (segmentId) => {
        setCurrentSegmentId(segmentId);
    };
    // Handle save/confirm action from SegmentEditor
    // SegmentEditor calls this with its internal ID (mapped from _id) and the new text
    const handleUpdateSegment = (segmentId, translation) => {
        // The segmentId received here is the mapped ID (_id)
        confirmSegmentMutation.mutate({
            segmentId,
            translation,
        });
    };
    // Handle batch confirm action
    const handleBatchConfirm = (segmentIds) => {
        if (segmentIds.length === 0) {
            antd_2.message.warning('请选择要批量确认的段落');
            return;
        }
        batchConfirmMutation.mutate({
            fileId: fileId,
            segmentIds
        });
    };
    // Handle filter changes from ReviewFilter
    const handleFilterChange = (status, issueType) => {
        setFilterStatus(status);
        setFilterIssueType(issueType);
    };
    // Loading state
    if (fileLoading || segmentsLoading) {
        return ((0, jsx_runtime_1.jsxs)("div", { style: { textAlign: 'center', padding: '100px 0' }, children: [(0, jsx_runtime_1.jsx)(antd_1.Spin, { size: "large" }), (0, jsx_runtime_1.jsx)("div", { style: { marginTop: 16 }, children: (0, jsx_runtime_1.jsx)(Text, { children: "\u52A0\u8F7D\u5BA1\u6821\u5DE5\u4F5C\u533A..." }) })] }));
    }
    // Error state
    if (fileError || segmentsError) {
        const error = fileError || segmentsError;
        return ((0, jsx_runtime_1.jsx)(antd_1.Alert, { type: "error", message: "\u52A0\u8F7D\u5931\u8D25", description: error?.message || "无法加载文件或段落数据，请刷新页面重试。", showIcon: true }));
    }
    if (!file) {
        return (0, jsx_runtime_1.jsx)(antd_1.Alert, { message: "\u9519\u8BEF", description: "\u65E0\u6CD5\u52A0\u8F7D\u6587\u4EF6\u6570\u636E", type: "error", showIcon: true });
    }
    // Prepare mapped segments for SegmentList
    const segmentsForUI = segmentsData?.segments?.map(mapSegmentForUI) || [];
    // Calculate statistics based on original segment data
    const totalSegments = segmentsData?.total || 0;
    const confirmedCount = segmentsData?.segments?.filter((s) => s.status === fileService_1.SegmentStatus.COMPLETED).length || 0;
    const issuesCount = segmentsData?.segments?.filter((s) => s.issues && s.issues.length > 0).length || 0;
    const progress = totalSegments > 0 ? Math.round((confirmedCount / totalSegments) * 100) : 0;
    return ((0, jsx_runtime_1.jsx)("div", { className: "review-workspace", children: (0, jsx_runtime_1.jsxs)(antd_1.Card, { children: [(0, jsx_runtime_1.jsx)("div", { className: "review-header", children: (0, jsx_runtime_1.jsxs)(antd_1.Space, { direction: "vertical", size: "small", style: { width: '100%' }, children: [(0, jsx_runtime_1.jsxs)(antd_1.Row, { justify: "space-between", align: "middle", children: [(0, jsx_runtime_1.jsxs)(antd_1.Col, { children: [(0, jsx_runtime_1.jsxs)(Title, { level: 3, style: { margin: 0 }, children: [(0, jsx_runtime_1.jsx)(icons_1.FileTextOutlined, {}), " \u5BA1\u6821\u5DE5\u4F5C\u533A: ", file?.fileName] }), (0, jsx_runtime_1.jsxs)(Text, { type: "secondary", children: ["(\u539F\u59CB\u6587\u4EF6\u540D: ", file?.originalFilename, ")"] })] }), (0, jsx_runtime_1.jsx)(antd_1.Col, { children: (0, jsx_runtime_1.jsx)(antd_1.Space, { children: (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.SaveOutlined, {}), onClick: () => navigate(`/projects/${file?.projectId}`), disabled: !file?.projectId, children: "\u5B8C\u6210\u5BA1\u6821" }) }) })] }), (0, jsx_runtime_1.jsxs)(antd_1.Row, { gutter: 16, children: [(0, jsx_runtime_1.jsx)(antd_1.Col, { children: (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u603B\u6BB5\u843D\u6570", value: totalSegments }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { children: (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u5DF2\u786E\u8BA4", value: confirmedCount }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { children: (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u5F85\u5904\u7406", value: totalSegments - confirmedCount }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { children: (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u542B\u95EE\u9898", value: issuesCount }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { children: (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u8FDB\u5EA6", value: progress, suffix: "%" }) })] })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Divider, {}), (0, jsx_runtime_1.jsxs)(antd_1.Row, { gutter: 16, className: "review-main-content", children: [(0, jsx_runtime_1.jsx)(antd_1.Col, { xs: 24, md: 8, lg: 6, children: (0, jsx_runtime_1.jsxs)(antd_1.Space, { direction: "vertical", style: { width: '100%' }, children: [(0, jsx_runtime_1.jsx)(ReviewFilter_1.default, { status: filterStatus, issueType: filterIssueType, onChange: handleFilterChange }), (0, jsx_runtime_1.jsx)(SegmentList_1.default, { segments: segmentsForUI, currentSegmentId: currentSegmentId, onSelectSegment: handleSelectSegment })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { xs: 24, md: 16, lg: 18, children: currentSegmentForUI ? ((0, jsx_runtime_1.jsxs)(antd_1.Tabs, { defaultActiveKey: "editor", className: "review-tabs", children: [(0, jsx_runtime_1.jsx)(TabPane, { tab: "\u6BB5\u843D\u7F16\u8F91\u5668", children: (0, jsx_runtime_1.jsx)(SegmentEditor_1.default, { segment: currentSegmentForUI, onUpdate: handleUpdateSegment, isUpdating: confirmSegmentMutation.isPending }) }, "editor"), (0, jsx_runtime_1.jsx)(TabPane, { tab: (0, jsx_runtime_1.jsx)(antd_1.Badge, { count: currentSegmentForUI.issues?.length || 0, children: "\u95EE\u9898\u9762\u677F" }), children: (0, jsx_runtime_1.jsx)(IssuePanel_1.default, { segment: currentSegmentForUI, onApplyFix: (fixedTranslation) => {
                                                if (currentSegmentForUI?.id) {
                                                    handleUpdateSegment(currentSegmentForUI.id, fixedTranslation);
                                                }
                                            } }) }, "issues")] })) : ((0, jsx_runtime_1.jsx)(antd_1.Card, { style: { height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }, children: (0, jsx_runtime_1.jsx)(Text, { type: "secondary", children: "\u8BF7\u4ECE\u5DE6\u4FA7\u5217\u8868\u4E2D\u9009\u62E9\u4E00\u4E2A\u6BB5\u843D\u8FDB\u884C\u5BA1\u6821\u3002" }) })) })] }), (0, jsx_runtime_1.jsx)(antd_1.Divider, {}), (0, jsx_runtime_1.jsx)("div", { className: "review-footer", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { onClick: () => handleBatchConfirm(segmentsData?.segments?.filter(s => s.status !== fileService_1.SegmentStatus.COMPLETED).map(s => s._id) || []), disabled: batchConfirmMutation.isPending || segmentsLoading, loading: batchConfirmMutation.isPending, children: "\u786E\u8BA4\u6240\u6709\u672A\u786E\u8BA4\u6BB5\u843D" }) })] }) }));
};
exports.default = ReviewWorkspacePage;
