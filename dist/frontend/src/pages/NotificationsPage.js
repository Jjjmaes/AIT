"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const antd_1 = require("antd");
const icons_1 = require("@ant-design/icons");
const useNotifications_1 = require("../hooks/useNotifications");
const formatUtils_1 = require("../utils/formatUtils");
const react_router_dom_1 = require("react-router-dom");
const { Title, Text } = antd_1.Typography;
const NotificationsPage = () => {
    const { notifications, loading, error, markAsRead, markAllAsRead, deleteNotification, fetchNotifications, } = (0, useNotifications_1.useNotifications)();
    const navigate = (0, react_router_dom_1.useNavigate)();
    (0, react_1.useEffect)(() => {
        fetchNotifications();
    }, [fetchNotifications]);
    const handleNotificationClick = (notification) => {
        markAsRead(notification.id);
        switch (notification.relatedType) {
            case 'project':
                navigate(`/projects/${notification.relatedId}`);
                break;
            case 'file':
                if (notification.relatedProjectId) {
                    navigate(`/files/${notification.relatedId}/review`);
                }
                else {
                    console.warn('Project ID missing for file notification', notification);
                }
                break;
            default:
                console.log('No specific navigation for this notification type');
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }, children: [(0, jsx_runtime_1.jsx)(Title, { level: 2, children: "\u901A\u77E5\u4E2D\u5FC3" }), (0, jsx_runtime_1.jsx)(antd_1.Button, { onClick: markAllAsRead, disabled: loading || notifications.filter(n => !n.isRead).length === 0, children: "\u5168\u90E8\u6807\u8BB0\u4E3A\u5DF2\u8BFB" })] }), loading && (0, jsx_runtime_1.jsx)("div", { style: { textAlign: 'center' }, children: (0, jsx_runtime_1.jsx)(antd_1.Spin, {}) }), error && (0, jsx_runtime_1.jsx)(Text, { type: "danger", children: error }), !loading && notifications.length === 0 && ((0, jsx_runtime_1.jsx)(antd_1.Empty, { description: "\u6CA1\u6709\u901A\u77E5" })), !loading && notifications.length > 0 && ((0, jsx_runtime_1.jsx)(antd_1.List, { itemLayout: "horizontal", dataSource: notifications, renderItem: item => ((0, jsx_runtime_1.jsx)(antd_1.List.Item, { style: {
                        backgroundColor: item.isRead ? '#fff' : '#e6f7ff',
                        padding: '12px 16px',
                        cursor: 'pointer'
                    }, actions: [
                        (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u6807\u8BB0\u4E3A\u5DF2\u8BFB", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "text", icon: (0, jsx_runtime_1.jsx)(icons_1.CheckOutlined, {}), onClick: (e) => { e.stopPropagation(); markAsRead(item.id); }, disabled: item.isRead }) }),
                        (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: "\u5220\u9664\u901A\u77E5", children: (0, jsx_runtime_1.jsx)(antd_1.Button, { type: "text", danger: true, icon: (0, jsx_runtime_1.jsx)(icons_1.DeleteOutlined, {}), onClick: (e) => { e.stopPropagation(); deleteNotification(item.id); } }) }),
                    ], onClick: () => handleNotificationClick(item), children: (0, jsx_runtime_1.jsx)(antd_1.List.Item.Meta, { title: item.title, description: (0, jsx_runtime_1.jsxs)(antd_1.Space, { direction: "vertical", size: "small", children: [(0, jsx_runtime_1.jsx)(Text, { children: item.content }), (0, jsx_runtime_1.jsx)(antd_1.Tooltip, { title: (0, formatUtils_1.formatDate)(item.createdAt, 'YYYY-MM-DD HH:mm:ss'), children: (0, jsx_runtime_1.jsx)(Text, { type: "secondary", style: { fontSize: '12px' }, children: (0, formatUtils_1.formatRelativeTime)(item.createdAt) }) })] }) }) })) }))] }));
};
exports.default = NotificationsPage;
