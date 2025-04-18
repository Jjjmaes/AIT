"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const react_router_dom_1 = require("react-router-dom");
// Import from the NEW reviewService
const reviewService_1 = require("../api/reviewService");
// Import shared configs if applicable, or define review-specific ones
// Assuming statusConfigs from TranslationCenterPage contains necessary review statuses
// Adjust this import path if TranslationCenterPage is in a different directory
// You might need to export statusConfigs and priorityConfigs from TranslationCenterPage or move them to a shared location.
const commonStatusConfigs = {
    pending: { color: 'default', icon: (0, jsx_runtime_1.jsx)(icons_1.ClockCircleOutlined, {}), text: '待处理' },
    preprocessing: { color: 'processing', icon: (0, jsx_runtime_1.jsx)(icons_1.SyncOutlined, { spin: true }), text: '预处理中' },
    ready_for_translation: { color: 'cyan', icon: (0, jsx_runtime_1.jsx)(icons_1.SendOutlined, {}), text: '待翻译' },
    in_translation_queue: { color: 'purple', icon: (0, jsx_runtime_1.jsx)(icons_1.ClockCircleOutlined, {}), text: '翻译队列中' },
    translating: { color: 'processing', icon: (0, jsx_runtime_1.jsx)(icons_1.SyncOutlined, { spin: true }), text: '翻译中' },
    translation_failed: { color: 'error', icon: (0, jsx_runtime_1.jsx)(icons_1.WarningOutlined, {}), text: '翻译失败' },
    translated_pending_confirmation: { color: 'warning', icon: (0, jsx_runtime_1.jsx)(icons_1.EyeOutlined, {}), text: '待确认翻译' },
    translation_confirmed: { color: 'success', icon: (0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, {}), text: '翻译已确认' },
    in_review_queue: { color: 'purple', icon: (0, jsx_runtime_1.jsx)(icons_1.ClockCircleOutlined, {}), text: '审校队列中' },
    reviewing: { color: 'processing', icon: (0, jsx_runtime_1.jsx)(icons_1.SyncOutlined, { spin: true }), text: '审校中' },
    review_failed: { color: 'error', icon: (0, jsx_runtime_1.jsx)(icons_1.WarningOutlined, {}), text: '审校失败' },
    reviewed_pending_confirmation: { color: 'warning', icon: (0, jsx_runtime_1.jsx)(icons_1.FileSearchOutlined, {}), text: '待确认审校' },
    completed: { color: 'success', icon: (0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, {}), text: '已完成' },
};
const priorityConfigs = {
    low: { color: 'blue', icon: (0, jsx_runtime_1.jsx)(icons_1.FlagOutlined, {}), text: '低' },
    medium: { color: 'orange', icon: (0, jsx_runtime_1.jsx)(icons_1.FlagOutlined, {}), text: '中' },
    high: { color: 'red', icon: (0, jsx_runtime_1.jsx)(icons_1.FireOutlined, {}), text: '高' },
};
const { Title, Text } = antd_1.Typography;
// Define statuses specifically relevant for the Review Center UI
// You can merge commonStatusConfigs or define entirely new ones
const reviewStatusConfigs = {
    in_review_queue: commonStatusConfigs.in_review_queue || { color: 'purple', icon: (0, jsx_runtime_1.jsx)(icons_1.ClockCircleOutlined, {}), text: '审校队列中' },
    reviewing: commonStatusConfigs.reviewing || { color: 'processing', icon: (0, jsx_runtime_1.jsx)(icons_1.SyncOutlined, { spin: true }), text: '审校中' },
    review_failed: commonStatusConfigs.review_failed || { color: 'error', icon: (0, jsx_runtime_1.jsx)(icons_1.WarningOutlined, {}), text: '审校失败' },
    reviewed_pending_confirmation: commonStatusConfigs.reviewed_pending_confirmation || { color: 'warning', icon: (0, jsx_runtime_1.jsx)(icons_1.FileSearchOutlined, {}), text: '待确认审校' },
    completed: commonStatusConfigs.completed || { color: 'success', icon: (0, jsx_runtime_1.jsx)(icons_1.CheckCircleOutlined, {}), text: '已完成' }, // Review confirmed = completed
    // Add other statuses if needed
};
const ReviewCenterPage = () => {
    const [tasks, setTasks] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [stats, setStats] = (0, react_1.useState)({ total: 0, completed: 0, pending: 0, inProgress: 0 /* Initialize based on ReviewStats */ });
    const [searchText, setSearchText] = (0, react_1.useState)('');
    const [activeFilter, setActiveFilter] = (0, react_1.useState)('All');
    const navigate = (0, react_router_dom_1.useNavigate)();
    const fetchReviewTasks = async () => {
        setLoading(true);
        try {
            const { tasks: fetchedTasks, stats: fetchedStats } = await (0, reviewService_1.getReviewTasks)();
            setTasks(fetchedTasks);
            setStats(fetchedStats);
        }
        catch (err) {
            console.error('加载审校任务失败', err);
            antd_1.message.error('Failed to load review tasks.');
            setTasks([]);
            // Reset stats based on ReviewStats interface
            setStats({ total: 0, completed: 0, pending: 0, inProgress: 0 /* Reset other expected keys */ });
        }
        finally {
            setLoading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        fetchReviewTasks();
    }, []);
    const handleRetryReviewTask = async (taskId) => {
        antd_1.message.loading({ content: `Retrying review task ${taskId}...`, key: `retry-review-${taskId}` });
        try {
            await (0, reviewService_1.retryReviewTask)(taskId);
            antd_1.message.success({ content: `Review task ${taskId} submitted for retry.`, key: `retry-review-${taskId}`, duration: 2 });
            fetchReviewTasks(); // Refresh list after retry
        }
        catch (error) {
            antd_1.message.error({ content: `Failed to retry review task ${taskId}.`, key: `retry-review-${taskId}`, duration: 2 });
            console.error("Review retry failed:", error);
        }
    };
    // Define table columns (similar to TranslationCenterPage, adjust as needed)
    const columns = [
        // File Name, Project, Languages, Word Count etc. (reuse from TranslationCenterPage columns if identical)
        {
            title: '文件名', dataIndex: 'fileName', key: 'fileName',
            render: (text) => ((0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsx)(icons_1.FileTextOutlined, {}), " ", (0, jsx_runtime_1.jsx)(Text, { strong: true, children: text })] }))
        },
        { title: '项目', dataIndex: 'projectName', key: 'projectName' },
        {
            title: '语言', key: 'languages',
            render: (_, record) => ((0, jsx_runtime_1.jsxs)(antd_1.Space, { children: [(0, jsx_runtime_1.jsx)(antd_1.Tag, { icon: (0, jsx_runtime_1.jsx)(icons_1.GlobalOutlined, {}), children: record.sourceLang }), " ", (0, jsx_runtime_1.jsx)(icons_1.ArrowRightOutlined, {}), " ", (0, jsx_runtime_1.jsx)(antd_1.Tag, { icon: (0, jsx_runtime_1.jsx)(icons_1.GlobalOutlined, {}), color: "blue", children: record.targetLang })] }))
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            // Use reviewStatusConfigs for filters and rendering
            filters: Object.entries(reviewStatusConfigs).map(([value, config]) => ({ text: config.text, value })),
            onFilter: (value, record) => record.status === value,
            render: (status) => {
                const config = reviewStatusConfigs[status];
                if (!config)
                    return (0, jsx_runtime_1.jsxs)(antd_1.Tag, { children: ["Unknown: ", status] });
                return (0, jsx_runtime_1.jsx)(antd_1.Tag, { icon: config.icon, color: config.color, children: config.text });
            }
        },
        {
            title: '优先级', dataIndex: 'priority', key: 'priority',
            // Reuse priorityConfigs if applicable
            filters: Object.entries(priorityConfigs).map(([value, config]) => ({ text: config.text, value })),
            onFilter: (value, record) => record.priority === value,
            render: (priority) => {
                const config = priorityConfigs[priority];
                if (!config)
                    return (0, jsx_runtime_1.jsxs)(antd_1.Tag, { children: ["Unknown: ", priority] });
                return (0, jsx_runtime_1.jsx)(antd_1.Tag, { icon: config.icon, color: config.color, children: config.text });
            }
        },
        {
            title: '操作',
            key: 'action',
            width: 180,
            render: (_text, task) => {
                const actions = [];
                // Action: View/Confirm Review Results
                if (task.status === 'reviewed_pending_confirmation') {
                    actions.push((0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u67E5\u770B/\u786E\u8BA4\u5BA1\u6821\u7ED3\u679C", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { size: "small", icon: (0, jsx_runtime_1.jsx)(icons_1.EditOutlined, {}), onClick: () => navigate(`/review/${task._id}/edit`), children: "\u5BA1\u6821" }) }, "review"));
                }
                // Action: Retry Failed Review Task
                if (task.status === 'review_failed') {
                    actions.push((0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u91CD\u8BD5\u5BA1\u6821", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { size: "small", icon: (0, jsx_runtime_1.jsx)(icons_1.RedoOutlined, {}), onClick: () => handleRetryReviewTask(task._id), children: "\u91CD\u8BD5" }) }, "retryReview"));
                }
                // Action: View details if task is completed or no other action applies
                if (task.status === 'completed' || actions.length === 0) {
                    actions.push((0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u67E5\u770B\u8BE6\u60C5", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { size: "small", icon: (0, jsx_runtime_1.jsx)(icons_1.EyeOutlined, {}), onClick: () => antd_1.message.info(`查看审校任务 ${task._id} 详情 (功能待实现)`), children: "\u8BE6\u60C5" }) }, "viewReview"));
                }
                return (0, jsx_runtime_1.jsx)(antd_1.Space, { size: "small", children: actions });
            },
        },
    ];
    // Filter tasks based on search text and active filter
    const filteredTasks = tasks.filter(task => {
        // Adapt filtering logic if ReviewTask properties differ
        const lowerSearchText = searchText.toLowerCase();
        const matchesSearch = !searchText || (task.projectName?.toLowerCase().includes(lowerSearchText) ||
            task.fileName?.toLowerCase().includes(lowerSearchText));
        const matchesFilter = activeFilter === 'All' || task.status === activeFilter;
        return matchesSearch && matchesFilter;
    });
    // Dynamic filter options based on reviewStatusConfigs and stats
    const filterOptions = [
        { label: `全部 (${stats.total || 0})`, value: 'All' },
        ...Object.entries(reviewStatusConfigs).map(([value, config]) => {
            const count = stats[value] ?? 0;
            return { label: `${config.text} (${count})`, value: value };
        })
    ].filter(opt => opt.value === 'All' || (stats[opt.value] ?? 0) > 0);
    if (loading) {
        return (0, jsx_runtime_1.jsx)("div", { style: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }, children: (0, jsx_runtime_1.jsx)(antd_1.Spin, { size: "large" }) });
    }
    return ((0, jsx_runtime_1.jsx)("div", { style: { padding: '24px' }, children: (0, jsx_runtime_1.jsxs)(antd_1.Row, { gutter: [0, 24], children: [(0, jsx_runtime_1.jsxs)(antd_1.Col, { span: 24, children: [(0, jsx_runtime_1.jsx)(Title, { level: 2, children: "\u5BA1\u6821\u4E2D\u5FC3" }), (0, jsx_runtime_1.jsx)(Text, { type: "secondary", children: "\u7BA1\u7406\u5BA1\u6821\u4EFB\u52A1\uFF0C\u786E\u8BA4 AI \u5BA1\u6821\u7ED3\u679C" })] }), (0, jsx_runtime_1.jsx)(antd_1.Col, { span: 24, children: (0, jsx_runtime_1.jsx)(antd_1.Row, { gutter: 16, children: Object.entries(stats)
                            .filter(([key]) => key === 'total' || reviewStatusConfigs[key])
                            .map(([key, value]) => ((0, jsx_runtime_1.jsx)(antd_1.Col, { xs: 24, sm: 12, md: 8, lg: 4, xl: 4, children: (0, jsx_runtime_1.jsx)(antd_1.Card, { hoverable: true, children: (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: key === 'total' ? '总任务' : reviewStatusConfigs[key]?.text || key, value: value, suffix: "\u4E2A\u4EFB\u52A1", valueStyle: { color: key === 'total' ? '#1890ff' : reviewStatusConfigs[key]?.color } }) }) }, key))) }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { span: 24, children: (0, jsx_runtime_1.jsx)(antd_1.Card, { children: (0, jsx_runtime_1.jsx)(antd_1.Space, { direction: "vertical", style: { width: '100%' }, size: "large", children: (0, jsx_runtime_1.jsxs)(antd_1.Row, { gutter: 16, justify: "space-between", align: "middle", children: [(0, jsx_runtime_1.jsx)(antd_1.Col, { xs: 24, sm: 24, md: 14, children: (0, jsx_runtime_1.jsx)(antd_1.Segmented, { options: filterOptions, value: activeFilter, onChange: (value) => setActiveFilter(value), style: { marginBottom: 16 }, block: true }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { xs: 24, sm: 24, md: 10, children: (0, jsx_runtime_1.jsx)(antd_1.Input, { placeholder: "\u641C\u7D22\u9879\u76EE\u540D\u3001\u6587\u4EF6\u540D...", prefix: (0, jsx_runtime_1.jsx)(icons_1.SearchOutlined, {}), value: searchText, onChange: (e) => setSearchText(e.target.value), allowClear: true }) })] }) }) }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { span: 24, children: (0, jsx_runtime_1.jsx)(antd_1.Card, { bodyStyle: { padding: 0 }, children: filteredTasks.length === 0 && !loading ? ((0, jsx_runtime_1.jsx)(antd_1.Empty, { description: searchText || activeFilter !== 'All' ? "没有找到匹配的任务" : "暂无审校任务", style: { padding: '40px 0' } })) : ((0, jsx_runtime_1.jsx)(antd_1.Table, { dataSource: filteredTasks, columns: columns, rowKey: "_id", loading: loading, pagination: { pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` } })) }) })] }) }));
};
exports.default = ReviewCenterPage;
