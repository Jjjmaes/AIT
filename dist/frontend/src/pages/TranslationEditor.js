"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
// frontend/src/pages/TranslationEditor.tsx
const react_1 = require("react");
const react_router_dom_1 = require("react-router-dom");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const translationService_1 = require("../api/translationService");
const { Content } = antd_1.Layout;
const { TextArea } = antd_1.Input;
const { Text, Title, Paragraph } = antd_1.Typography;
// Segment Status Display Configuration
const segmentStatusConfigs = {
    unconfirmed: { color: 'orange', text: '未确认' },
    confirmed: { color: 'green', text: '已确认' },
    needs_revision: { color: 'red', text: '需修改' },
};
const TranslationEditor = () => {
    const { taskId } = (0, react_router_dom_1.useParams)();
    const navigate = (0, react_router_dom_1.useNavigate)();
    const [segments, setSegments] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [saving, setSaving] = (0, react_1.useState)({}); // Track saving state per segment
    const [confirming, setConfirming] = (0, react_1.useState)(false); // Track overall confirm state
    const [error, setError] = (0, react_1.useState)(null);
    // Fetch segments
    const fetchSegments = (0, react_1.useCallback)(async () => {
        if (!taskId) {
            setError("Task ID is missing.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const fetchedSegments = await (0, translationService_1.getTranslatedSegments)(taskId);
            // Sort segments by sequence just in case API doesn't guarantee order
            fetchedSegments.sort((a, b) => a.sequence - b.sequence);
            setSegments(fetchedSegments);
        }
        catch (err) {
            console.error("Error fetching segments:", err);
            setError(err instanceof Error ? err.message : 'Failed to load segments.');
            antd_1.message.error('加载翻译片段失败！');
        }
        finally {
            setLoading(false);
        }
    }, [taskId]);
    (0, react_1.useEffect)(() => {
        fetchSegments();
    }, [fetchSegments]);
    // Handle target text changes
    const handleTargetChange = (segmentId, newTarget) => {
        setSegments(prevSegments => prevSegments.map(seg => seg._id === segmentId ? { ...seg, target: newTarget } : seg));
        // Optionally auto-save on change (or use a dedicated save button)
        // handleSaveSegment(segmentId, newTarget); // Example auto-save
    };
    // Handle saving a single segment (e.g., triggered by blur or button)
    const handleSaveSegment = async (segmentId) => {
        const segmentToSave = segments.find(s => s._id === segmentId);
        if (!segmentToSave)
            return;
        setSaving(prev => ({ ...prev, [segmentId]: true }));
        try {
            await (0, translationService_1.updateSegment)(segmentId, { target: segmentToSave.target });
            antd_1.message.success(`片段 ${segmentToSave.sequence} 已保存`);
            // Optionally update segment status locally if needed, or refetch
        }
        catch (err) {
            antd_1.message.error(`保存片段 ${segmentToSave.sequence} 失败`);
            console.error("Save segment error:", err);
        }
        finally {
            setSaving(prev => ({ ...prev, [segmentId]: false }));
        }
    };
    // Handle changing the status of a single segment
    const handleSegmentStatusChange = async (segmentId, newStatus) => {
        const segmentToUpdate = segments.find(s => s._id === segmentId);
        if (!segmentToUpdate || segmentToUpdate.status === newStatus)
            return;
        setSaving(prev => ({ ...prev, [segmentId]: true })); // Use saving state for status update too
        try {
            await (0, translationService_1.updateSegment)(segmentId, { status: newStatus });
            // Update local state immediately for better UX
            setSegments(prevSegments => prevSegments.map(seg => seg._id === segmentId ? { ...seg, status: newStatus } : seg));
            antd_1.message.success(`片段 ${segmentToUpdate.sequence} 状态已更新`);
        }
        catch (err) {
            antd_1.message.error(`更新片段 ${segmentToUpdate.sequence} 状态失败`);
            console.error("Update segment status error:", err);
        }
        finally {
            setSaving(prev => ({ ...prev, [segmentId]: false }));
        }
    };
    // Handle confirming the entire task
    const handleConfirmAll = async () => {
        if (!taskId)
            return;
        setConfirming(true);
        try {
            await (0, translationService_1.confirmTranslationTask)(taskId);
            antd_1.message.success('任务已确认完成！');
            // Optionally navigate back or update UI
            navigate('/translation-center'); // Navigate back after confirmation
        }
        catch (err) {
            antd_1.message.error('确认任务失败！');
            console.error("Confirm task error:", err);
        }
        finally {
            setConfirming(false);
        }
    };
    if (loading) {
        return (0, jsx_runtime_1.jsx)("div", { style: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 100px)' }, children: (0, jsx_runtime_1.jsx)(antd_1.Spin, { size: "large", tip: "\u52A0\u8F7D\u7247\u6BB5\u4E2D..." }) });
    }
    if (error) {
        return (0, jsx_runtime_1.jsx)("div", { style: { padding: '50px', textAlign: 'center' }, children: (0, jsx_runtime_1.jsx)(antd_1.Empty, { description: (0, jsx_runtime_1.jsxs)(Text, { type: "danger", children: ["\u52A0\u8F7D\u5931\u8D25: ", error] }) }) });
    }
    if (segments.length === 0) {
        return (0, jsx_runtime_1.jsx)("div", { style: { padding: '50px', textAlign: 'center' }, children: (0, jsx_runtime_1.jsx)(antd_1.Empty, { description: "\u672A\u627E\u5230\u8BE5\u4EFB\u52A1\u7684\u7FFB\u8BD1\u7247\u6BB5\u3002" }) });
    }
    return ((0, jsx_runtime_1.jsxs)(antd_1.Layout, { style: { padding: '24px', background: '#fff' }, children: [(0, jsx_runtime_1.jsxs)(antd_1.Affix, { offsetTop: 80, children: [" ", (0, jsx_runtime_1.jsx)(antd_1.Card, { bodyStyle: { padding: '10px 24px' }, style: { marginBottom: '16px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(5px)' }, children: (0, jsx_runtime_1.jsxs)(antd_1.Row, { justify: "space-between", align: "middle", children: [(0, jsx_runtime_1.jsx)(antd_1.Col, { children: (0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.ArrowLeftOutlined, {}), onClick: () => navigate('/translation-center'), children: "\u8FD4\u56DE\u7FFB\u8BD1\u4E2D\u5FC3" }), (0, jsx_runtime_1.jsxs)(Title, { level: 4, style: { margin: 0 }, children: ["\u7F16\u8F91\u4EFB\u52A1: ", taskId] })] }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { children: (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", icon: (0, jsx_runtime_1.jsx)(icons_1.CheckSquareOutlined, {}), onClick: handleConfirmAll, loading: confirming, disabled: segments.some(s => s.status !== 'confirmed'), children: "\u786E\u8BA4\u5E76\u5B8C\u6210\u4EFB\u52A1" }) })] }) })] }), (0, jsx_runtime_1.jsx)(Content, { children: segments.map((segment) => ((0, jsx_runtime_1.jsx)(antd_1.Card, { style: { marginBottom: '16px' }, bodyStyle: { padding: '16px' }, children: (0, jsx_runtime_1.jsxs)(antd_1.Row, { gutter: 16, children: [(0, jsx_runtime_1.jsxs)(antd_1.Col, { xs: 24, sm: 12, children: [(0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '8px' }, children: [(0, jsx_runtime_1.jsxs)(antd_1.Tag, { color: "blue", children: ["\u6E90\u6587 #", segment.sequence] }), (0, jsx_runtime_1.jsx)(antd_1.Tag, { color: segmentStatusConfigs[segment.status]?.color || 'default', children: segmentStatusConfigs[segment.status]?.text || segment.status })] }), (0, jsx_runtime_1.jsx)(Paragraph, { style: { background: '#f5f5f5', padding: '10px', borderRadius: '4px', minHeight: '80px' }, children: segment.source })] }), (0, jsx_runtime_1.jsxs)(antd_1.Col, { xs: 24, sm: 12, children: [(0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '8px' }, children: [(0, jsx_runtime_1.jsxs)(antd_1.Tag, { color: "green", children: ["\u8BD1\u6587 #", segment.sequence] }), (0, jsx_runtime_1.jsxs)(antd_1.Space, { style: { float: 'right' }, children: [(0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u4FDD\u5B58\u6B64\u7247\u6BB5", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.SaveOutlined, {}), size: "small", onClick: () => handleSaveSegment(segment._id), loading: saving[segment._id], disabled: saving[segment._id], type: "text" }) }), (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u786E\u8BA4\u6B64\u7247\u6BB5", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { icon: (0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, {}), size: "small", onClick: () => handleSegmentStatusChange(segment._id, 'confirmed'), loading: saving[segment._id], disabled: saving[segment._id] || segment.status === 'confirmed', type: segment.status === 'confirmed' ? 'primary' : 'text', ghost: segment.status === 'confirmed' }) })] })] }), (0, jsx_runtime_1.jsx)(TextArea, { rows: 4, value: segment.target, onChange: (e) => handleTargetChange(segment._id, e.target.value), onBlur: () => handleSaveSegment(segment._id), style: { minHeight: '80px', borderColor: segment.status === 'unconfirmed' ? 'orange' : undefined }, placeholder: "\u5728\u6B64\u8F93\u5165\u6216\u7F16\u8F91\u8BD1\u6587..." })] })] }) }, segment._id))) }), (0, jsx_runtime_1.jsx)(antd_1.Affix, { offsetBottom: 20, style: { textAlign: 'right', marginTop: '20px' }, children: (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", icon: (0, jsx_runtime_1.jsx)(icons_1.CheckSquareOutlined, {}), onClick: handleConfirmAll, loading: confirming, disabled: segments.some(s => s.status !== 'confirmed'), children: "\u786E\u8BA4\u5E76\u5B8C\u6210\u4EFB\u52A1" }) })] }));
};
exports.default = TranslationEditor;
