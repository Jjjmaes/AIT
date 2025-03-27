import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import {
  getNotifications,
  getNotification,
  markAsRead,
  markMultipleAsRead,
  archiveNotification,
  getUnreadCount,
  getNotificationStats,
  deleteNotification
} from '../controllers/notification.controller';

const router = Router();

// 所有通知路由都需要认证
router.use(authenticateJwt);

// 获取通知列表
router.get('/', getNotifications);

// 获取单个通知
router.get('/:id', getNotification);

// 标记通知为已读
router.put('/:id/read', markAsRead);

// 批量标记通知为已读
router.put('/read', markMultipleAsRead);

// 归档通知
router.put('/:id/archive', archiveNotification);

// 获取未读通知数量
router.get('/unread/count', getUnreadCount);

// 获取通知统计信息
router.get('/stats', getNotificationStats);

// 删除通知
router.delete('/:id', deleteNotification);

export default router; 