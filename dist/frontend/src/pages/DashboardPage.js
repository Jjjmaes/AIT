"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const react_router_dom_1 = require("react-router-dom");
const base_1 = require("../api/base");
const AuthContext_1 = require("../context/AuthContext");
const { Title } = antd_1.Typography;
const DashboardPage = () => {
    const [stats, setStats] = (0, react_1.useState)({
        totalProjects: 0,
        pendingReviews: 0,
        completedFiles: 0,
        overallProgress: 0,
    });
    const [recentProjects, setRecentProjects] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const navigate = (0, react_router_dom_1.useNavigate)();
    const {} = (0, AuthContext_1.useAuth)();
    (0, react_1.useEffect)(() => {
        const fetchDashboardData = async () => {
            try {
                const [statsResponse, projectsResponse] = await Promise.all([
                    base_1.axiosInstance.get('/users/stats'),
                    base_1.axiosInstance.get('/projects/recent')
                ]);
                setStats(statsResponse.data);
                if (projectsResponse.data && projectsResponse.data.success && projectsResponse.data.data) {
                    setRecentProjects(projectsResponse.data.data.projects);
                }
                else {
                    console.error('Unexpected structure for /projects/recent:', projectsResponse.data);
                    setRecentProjects([]);
                }
            }
            catch (error) {
                console.error('Error fetching dashboard data:', error);
            }
            finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, []);
    const columns = [
        {
            title: '项目名称',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => ((0, jsx_runtime_1.jsx)("a", { onClick: () => navigate(`/projects/${record.id}`), children: text })),
        },
        {
            title: '语言对',
            key: 'languages',
            render: (_, record) => (`${record.sourceLanguage} → ${record.targetLanguage}`),
        },
        {
            title: '进度',
            dataIndex: 'progress',
            key: 'progress',
            render: (progress) => `${progress}%`,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                let color = 'default';
                if (status === '进行中')
                    color = 'processing';
                if (status === '已完成')
                    color = 'success';
                if (status === '已暂停')
                    color = 'warning';
                return (0, jsx_runtime_1.jsx)(antd_1.Tag, { color: color, children: status });
            },
        },
        {
            title: '截止日期',
            dataIndex: 'deadline',
            key: 'deadline',
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => ((0, jsx_runtime_1.jsx)(antd_1.Button, { type: "link", icon: (0, jsx_runtime_1.jsx)(icons_1.RightOutlined, {}), onClick: () => navigate(`/projects/${record.id}`), children: "\u67E5\u770B" })),
        },
    ];
    return ((0, jsx_runtime_1.jsxs)("div", { className: "dashboard-container", children: [(0, jsx_runtime_1.jsx)(Title, { level: 2, style: { marginBottom: 24 }, children: "\u4EEA\u8868\u76D8" }), (0, jsx_runtime_1.jsxs)(antd_1.Row, { gutter: [24, 24], children: [(0, jsx_runtime_1.jsx)(antd_1.Col, { xs: 24, sm: 12, md: 6, children: (0, jsx_runtime_1.jsx)(antd_1.Card, { hoverable: true, style: { height: '100%' }, children: (0, jsx_runtime_1.jsx)(antd_1.Skeleton, { loading: loading, active: true, paragraph: { rows: 1 }, children: (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u6211\u7684\u9879\u76EE", value: stats.totalProjects, prefix: (0, jsx_runtime_1.jsx)(icons_1.ProjectOutlined, {}) }) }) }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { xs: 24, sm: 12, md: 6, children: (0, jsx_runtime_1.jsx)(antd_1.Card, { hoverable: true, style: { height: '100%' }, children: (0, jsx_runtime_1.jsx)(antd_1.Skeleton, { loading: loading, active: true, paragraph: { rows: 1 }, children: (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u5F85\u5BA1\u6821", value: stats.pendingReviews, prefix: (0, jsx_runtime_1.jsx)(icons_1.ClockCircleOutlined, {}), valueStyle: { color: stats.pendingReviews > 0 ? '#faad14' : undefined } }) }) }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { xs: 24, sm: 12, md: 6, children: (0, jsx_runtime_1.jsx)(antd_1.Card, { hoverable: true, style: { height: '100%' }, children: (0, jsx_runtime_1.jsx)(antd_1.Skeleton, { loading: loading, active: true, paragraph: { rows: 1 }, children: (0, jsx_runtime_1.jsx)(antd_1.Statistic, { title: "\u5DF2\u5B8C\u6210\u6587\u4EF6", value: stats.completedFiles, prefix: (0, jsx_runtime_1.jsx)(icons_1.FileTextOutlined, {}) }) }) }) }), (0, jsx_runtime_1.jsx)(antd_1.Col, { xs: 24, sm: 12, md: 6, children: (0, jsx_runtime_1.jsx)(antd_1.Card, { hoverable: true, style: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }, onClick: () => navigate('/projects'), children: (0, jsx_runtime_1.jsxs)(antd_1.Skeleton, { loading: loading, active: true, paragraph: { rows: 1 }, children: [(0, jsx_runtime_1.jsx)(icons_1.TranslationOutlined, { style: { fontSize: '24px', marginBottom: '8px' } }), (0, jsx_runtime_1.jsx)(antd_1.Typography.Text, { strong: true, children: "\u5F00\u59CB\u7FFB\u8BD1" }), (0, jsx_runtime_1.jsx)(antd_1.Typography.Text, { type: "secondary", style: { display: 'block', fontSize: '12px' }, children: "\u9009\u62E9\u9879\u76EE\u5E76\u542F\u52A8" })] }) }) })] }), (0, jsx_runtime_1.jsxs)("div", { style: { marginTop: 32 }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, children: [(0, jsx_runtime_1.jsx)(Title, { level: 4, children: "\u8FD1\u671F\u9879\u76EE" }), (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "primary", onClick: () => navigate('/projects'), children: "\u67E5\u770B\u5168\u90E8" })] }), (0, jsx_runtime_1.jsx)(antd_1.Skeleton, { loading: loading, active: true, paragraph: { rows: 6 }, children: (0, jsx_runtime_1.jsx)(antd_1.Table, { columns: columns, dataSource: recentProjects, rowKey: "id", pagination: false, style: { overflowX: 'auto' }, scroll: { x: 'max-content' } }) })] }), (0, jsx_runtime_1.jsx)("style", { children: `
        .dashboard-container .ant-card {
          transition: all 0.3s;
        }
        .dashboard-container .ant-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        @media screen and (max-width: 768px) {
          .dashboard-container .ant-card {
            margin-bottom: 16px;
          }
        }
      ` })] }));
};
exports.default = DashboardPage;
