"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useNotifications = void 0;
const react_1 = require("react");
const AuthContext_1 = require("../context/AuthContext");
const base_1 = require("../api/base");
const useNotifications = () => {
    const [notifications, setNotifications] = (0, react_1.useState)([]);
    const [unreadCount, setUnreadCount] = (0, react_1.useState)(0);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const { user } = (0, AuthContext_1.useAuth)();
    // 获取通知列表
    const fetchNotifications = (0, react_1.useCallback)(async () => {
        if (!user)
            return;
        setLoading(true);
        setError(null);
        try {
            const response = await base_1.axiosInstance.get('/notifications');
            if (response.data && response.data.data && response.data.data.notifications) {
                setNotifications(response.data.data.notifications);
                setUnreadCount(response.data.data.notifications.filter((n) => !n.isRead).length);
            }
            else {
                console.error('Unexpected response structure for notifications:', response.data);
                setNotifications([]);
                setUnreadCount(0);
                setError('获取通知数据格式错误');
            }
        }
        catch (err) {
            console.error('获取通知失败:', err);
            setError(err?.message || '获取通知失败');
        }
        finally {
            setLoading(false);
        }
    }, [user]);
    // 标记通知为已读
    const markAsRead = (0, react_1.useCallback)(async (notificationId) => {
        if (!user)
            return;
        try {
            await base_1.axiosInstance.put(`/notifications/${notificationId}/read`);
            // 更新本地状态
            setNotifications(prev => prev.map(notification => notification.id === notificationId
                ? { ...notification, isRead: true }
                : notification));
            // 更新未读数量
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
        catch (err) {
            console.error('标记通知已读失败:', err);
        }
    }, [user]);
    // 标记所有通知为已读
    const markAllAsRead = (0, react_1.useCallback)(async () => {
        if (!user)
            return;
        // Optimistic update: Mark all as read locally first
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        try {
            await base_1.axiosInstance.put('/notifications/read-all');
            // No need to refetch, local state is already updated
        }
        catch (error) {
            console.error('标记所有通知已读失败:', error);
        }
    }, [user]);
    // 删除通知
    const deleteNotification = (0, react_1.useCallback)(async (notificationId) => {
        if (!user)
            return;
        try {
            await base_1.axiosInstance.delete(`/notifications/${notificationId}`);
            // 更新本地状态
            setNotifications(prev => prev.filter(notification => notification.id !== notificationId));
            // 如果删除的是未读通知，则更新未读数量
            const deletedNotification = notifications.find(n => n.id === notificationId);
            if (deletedNotification && !deletedNotification.isRead) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        }
        catch (err) {
            console.error('删除通知失败:', err);
        }
    }, [user, notifications]);
    // 初始加载通知
    (0, react_1.useEffect)(() => {
        if (user) {
            fetchNotifications();
        }
    }, [user, fetchNotifications]);
    // 设置轮询更新（每分钟）
    (0, react_1.useEffect)(() => {
        if (!user)
            return;
        const intervalId = setInterval(fetchNotifications, 60000);
        return () => clearInterval(intervalId);
    }, [user, fetchNotifications]);
    return {
        notifications,
        unreadCount,
        loading,
        error,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification
    };
};
exports.useNotifications = useNotifications;
