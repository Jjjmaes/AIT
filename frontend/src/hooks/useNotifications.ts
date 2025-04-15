import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

interface Notification {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
  relatedId?: string; // 相关项目或文件ID
  relatedType?: 'project' | 'file' | 'segment' | 'system'; // 相关对象类型
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // 获取通知列表
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/notifications');
      if (response.data && response.data.data && response.data.data.notifications) {
        setNotifications(response.data.data.notifications);
        setUnreadCount(response.data.data.notifications.filter((n: Notification) => !n.isRead).length);
      } else {
        console.error('Unexpected response structure for notifications:', response.data);
        setNotifications([]);
        setUnreadCount(0);
        setError('获取通知数据格式错误');
      }
    } catch (err) {
      console.error('获取通知失败:', err);
      setError('获取通知失败');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 标记通知为已读
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return;
    
    try {
      await api.put(`/notifications/${notificationId}/read`);
      
      // 更新本地状态
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true } 
            : notification
        )
      );
      
      // 更新未读数量
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('标记通知已读失败:', err);
    }
  }, [user]);

  // 标记所有通知为已读
  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    
    try {
      await api.put('/notifications/read-all');
      
      // 更新本地状态
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, isRead: true }))
      );
      
      // 更新未读数量
      setUnreadCount(0);
    } catch (err) {
      console.error('标记所有通知已读失败:', err);
    }
  }, [user]);

  // 删除通知
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) return;
    
    try {
      await api.delete(`/notifications/${notificationId}`);
      
      // 更新本地状态
      setNotifications(prev => 
        prev.filter(notification => notification.id !== notificationId)
      );
      
      // 如果删除的是未读通知，则更新未读数量
      const deletedNotification = notifications.find(n => n.id === notificationId);
      if (deletedNotification && !deletedNotification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('删除通知失败:', err);
    }
  }, [user, notifications]);

  // 初始加载通知
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  // 设置轮询更新（每分钟）
  useEffect(() => {
    if (!user) return;
    
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