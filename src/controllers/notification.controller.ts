import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import notificationService from '../services/notification.service';
import { NotificationStatus, NotificationType, NotificationPriority } from '../types/notification.types';
import logger from '../utils/logger';
import { Types } from 'mongoose';
import { NotFoundError } from '../utils/errors';

/**
 * 获取通知列表
 * GET /api/notifications
 */
export async function getNotifications(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: '未授权的访问' });
      return;
    }

    const {
      status,
      type,
      priority,
      page,
      limit
    } = req.query;

    const options: any = {};

    if (status) {
      options.status = status as NotificationStatus;
    }

    if (type) {
      options.type = type as NotificationType;
    }

    if (priority) {
      options.priority = priority as NotificationPriority;
    }

    if (page) {
      const pageNum = parseInt(page as string);
      if (isNaN(pageNum) || pageNum < 1) {
        res.status(400).json({ error: '页码必须是大于0的数字' });
        return;
      }
      options.page = pageNum;
    }

    if (limit) {
      const limitNum = parseInt(limit as string);
      if (isNaN(limitNum) || limitNum < 1) {
        res.status(400).json({ error: '每页数量必须是大于0的数字' });
        return;
      }
      options.limit = limitNum;
    }

    try {
      const result = await notificationService.getNotifications(new Types.ObjectId(userId), options);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (serviceError: any) {
      if (serviceError.name === 'BadRequestError') {
        res.status(400).json({ error: serviceError.message });
      } else {
        throw serviceError;
      }
    }
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    logger.error('获取通知列表失败', { error });
    res.status(500).json({ error: error.message || '获取通知列表失败' });
  }
}

/**
 * 获取单个通知
 * GET /api/notifications/:id
 */
export async function getNotification(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: '未授权的访问' });
      return;
    }

    const { id } = req.params;
    const notification = await notificationService.getNotification(id, new Types.ObjectId(userId));

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    logger.error('获取通知失败', { error });
    res.status(500).json({ error: error.message || '获取通知失败' });
  }
}

/**
 * 标记通知为已读
 * PUT /api/notifications/:id/read
 */
export async function markAsRead(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: '未授权的访问' });
      return;
    }

    const { id } = req.params;
    await notificationService.markAsRead(id, new Types.ObjectId(userId));

    res.status(200).json({
      success: true,
      message: '通知已标记为已读'
    });
  } catch (error: any) {
    if (error.name === 'NotFoundError') {
      res.status(404).json({ error: error.message });
    } else {
      logger.error('标记通知为已读失败', { error });
      res.status(500).json({ error: error.message || '标记通知为已读失败' });
    }
  }
}

/**
 * 批量标记通知为已读
 * PUT /api/notifications/read
 */
export async function markMultipleAsRead(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: '未授权的访问' });
      return;
    }

    const { notificationIds } = req.body;
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      res.status(400).json({ error: '通知ID列表不能为空' });
      return;
    }

    await notificationService.markMultipleAsRead(notificationIds, new Types.ObjectId(userId));

    res.status(200).json({
      success: true,
      message: '通知已批量标记为已读'
    });
  } catch (error: any) {
    logger.error('批量标记通知为已读失败', { error });
    res.status(500).json({ error: error.message || '批量标记通知为已读失败' });
  }
}

/**
 * 归档通知
 * PUT /api/notifications/:id/archive
 */
export async function archiveNotification(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: '未授权的访问' });
      return;
    }

    const { id } = req.params;
    await notificationService.archiveNotification(id, new Types.ObjectId(userId));

    res.status(200).json({
      success: true,
      message: '通知已归档'
    });
  } catch (error: any) {
    if (error.name === 'NotFoundError') {
      res.status(404).json({ error: error.message });
    } else {
      logger.error('归档通知失败', { error });
      res.status(500).json({ error: error.message || '归档通知失败' });
    }
  }
}

/**
 * 获取未读通知数量
 * GET /api/notifications/unread/count
 */
export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: '未授权的访问' });
      return;
    }

    const count = await notificationService.getUnreadCount(new Types.ObjectId(userId));

    res.status(200).json({
      success: true,
      data: { count }
    });
  } catch (error: any) {
    logger.error('获取未读通知数量失败', { error });
    res.status(500).json({ error: error.message || '获取未读通知数量失败' });
  }
}

/**
 * 获取通知统计信息
 * GET /api/notifications/stats
 */
export async function getNotificationStats(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: '未授权的访问' });
      return;
    }

    const stats = await notificationService.getStats(new Types.ObjectId(userId));

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('获取通知统计信息失败', { error });
    res.status(500).json({ error: error.message || '获取通知统计信息失败' });
  }
}

/**
 * 删除通知
 * DELETE /api/notifications/:id
 */
export async function deleteNotification(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: '未授权的访问' });
      return;
    }

    const { id } = req.params;
    await notificationService.deleteNotification(id, new Types.ObjectId(userId));

    res.status(200).json({
      success: true,
      message: '通知已删除'
    });
  } catch (error: any) {
    if (error.name === 'NotFoundError') {
      res.status(404).json({ error: error.message });
    } else {
      logger.error('删除通知失败', { error });
      res.status(500).json({ error: error.message || '删除通知失败' });
    }
  }
} 