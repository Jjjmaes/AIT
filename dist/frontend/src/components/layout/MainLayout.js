"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_router_dom_1 = require("react-router-dom");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const AuthContext_1 = require("../../context/AuthContext");
const useNotifications_1 = require("../../hooks/useNotifications");
const { Header, Sider, Content } = antd_1.Layout;
const MainLayout = () => {
    const [collapsed, setCollapsed] = (0, react_1.useState)(false);
    const navigate = (0, react_router_dom_1.useNavigate)();
    const { token } = antd_1.theme.useToken();
    const { user, logout } = (0, AuthContext_1.useAuth)();
    const { unreadCount } = (0, useNotifications_1.useNotifications)();
    const isAdmin = user?.role === 'admin';
    const menuItems = [
        {
            key: 'dashboard',
            icon: (0, jsx_runtime_1.jsx)(icons_1.DashboardOutlined, {}),
            label: '仪表盘',
            onClick: () => navigate('/dashboard'),
        },
        {
            key: 'projects',
            icon: (0, jsx_runtime_1.jsx)(icons_1.ProjectOutlined, {}),
            label: '项目管理',
            onClick: () => navigate('/projects'),
        },
        {
            key: 'translate',
            icon: (0, jsx_runtime_1.jsx)(icons_1.TranslationOutlined, {}),
            label: '翻译中心',
            onClick: () => navigate('/translate'),
        },
        {
            key: 'prompts',
            icon: (0, jsx_runtime_1.jsx)(icons_1.FormOutlined, {}),
            label: '提示词管理',
            onClick: () => navigate('/prompts'),
            disabled: !isAdmin,
        },
        {
            key: 'ai-configs',
            icon: (0, jsx_runtime_1.jsx)(icons_1.RobotOutlined, {}),
            label: 'AI引擎配置',
            onClick: () => navigate('/ai-configs'),
            disabled: !isAdmin,
        },
        {
            key: 'terminology',
            icon: (0, jsx_runtime_1.jsx)(icons_1.BookOutlined, {}),
            label: '术语管理',
            onClick: () => navigate('/terminology'),
        },
        {
            key: 'tm',
            icon: (0, jsx_runtime_1.jsx)(icons_1.DatabaseOutlined, {}),
            label: '翻译记忆库',
            onClick: () => navigate('/translation-memory'),
        },
    ];
    const userMenuItems = [
        {
            key: 'profile',
            icon: (0, jsx_runtime_1.jsx)(icons_1.UserOutlined, {}),
            label: '个人信息',
        },
        {
            key: 'settings',
            icon: (0, jsx_runtime_1.jsx)(icons_1.SettingOutlined, {}),
            label: '设置',
        },
        {
            key: 'logout',
            icon: (0, jsx_runtime_1.jsx)(icons_1.LogoutOutlined, {}),
            label: '退出登录',
            danger: true,
            onClick: logout,
        },
    ];
    return ((0, jsx_runtime_1.jsxs)(antd_1.Layout, { style: { minHeight: '100vh' }, children: [(0, jsx_runtime_1.jsxs)(Sider, { trigger: null, collapsible: true, collapsed: collapsed, theme: "light", style: {
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    zIndex: 10,
                }, children: [(0, jsx_runtime_1.jsx)("div", { style: {
                            height: 64,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            padding: collapsed ? 0 : '0 16px',
                            borderBottom: `1px solid ${token.colorBorder}`
                        }, children: collapsed ?
                            (0, jsx_runtime_1.jsx)("span", { style: { fontSize: 24, fontWeight: 'bold' }, children: "TP" }) :
                            (0, jsx_runtime_1.jsx)("span", { style: { fontSize: 18, fontWeight: 'bold' }, children: "\u7FFB\u8BD1\u5BA1\u6821\u5E73\u53F0" }) }), (0, jsx_runtime_1.jsx)(antd_1.Menu, { mode: "inline", selectedKeys: [window.location.pathname.split('/')[1] || 'dashboard'], style: { borderRight: 0 }, items: menuItems })] }), (0, jsx_runtime_1.jsxs)(antd_1.Layout, { children: [(0, jsx_runtime_1.jsxs)(Header, { style: {
                            padding: '0 16px',
                            background: token.colorBgContainer,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
                        }, children: [(0, jsx_runtime_1.jsx)(antd_1.Button, { type: "text", icon: collapsed ? (0, jsx_runtime_1.jsx)(icons_1.MenuUnfoldOutlined, {}) : (0, jsx_runtime_1.jsx)(icons_1.MenuFoldOutlined, {}), onClick: () => setCollapsed(!collapsed), style: { fontSize: '16px', width: 48, height: 48 } }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', alignItems: 'center', gap: 16 }, children: [(0, jsx_runtime_1.jsx)(antd_1.Badge, { count: unreadCount, overflowCount: 99, children: (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "text", icon: (0, jsx_runtime_1.jsx)(icons_1.BellOutlined, {}), onClick: () => navigate('/notifications'), style: { fontSize: '16px' } }) }), (0, jsx_runtime_1.jsx)(antd_1.Dropdown, { menu: { items: userMenuItems }, placement: "bottomRight", children: (0, jsx_runtime_1.jsxs)("div", { style: { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }, children: [(0, jsx_runtime_1.jsx)(antd_1.Avatar, { icon: (0, jsx_runtime_1.jsx)(icons_1.UserOutlined, {}) }), !collapsed && (0, jsx_runtime_1.jsx)("span", { children: user?.name })] }) })] })] }), (0, jsx_runtime_1.jsx)(Content, { style: {
                            margin: '16px',
                            padding: 24,
                            background: token.colorBgContainer,
                            borderRadius: token.borderRadius,
                            overflow: 'initial',
                            minHeight: 280,
                        }, children: (0, jsx_runtime_1.jsx)("div", { style: { padding: '8px', overflow: 'auto' }, children: (0, jsx_runtime_1.jsx)(react_router_dom_1.Outlet, {}) }) })] })] }));
};
exports.default = MainLayout;
