import { Notification, INotificationDocument } from '../models/notification.model';
import { NotificationType, NotificationPriority, NotificationStatus, INotification } from '../types/notification.types';
import { Types } from 'mongoose';
import { AppError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

class BadRequestError extends AppError {
  constructor(message: string = '请求参数错误') {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

export class NotificationService {
  /**
   * 创建通知
   */
  async createNotification(data: Omit<INotification, 'createdAt'>): Promise<INotificationDocument> {
    try {
      const notification = new Notification({
        ...data,
        createdAt: new Date()
      });
      return await notification.save();
    } catch (error) {
      logger.error('创建通知失败', { error });
      throw new BadRequestError('创建通知失败');
    }
  }

  /**
   * 获取用户的通知列表
   */
  async getNotifications(
    userId: Types.ObjectId,
    options: {
      status?: NotificationStatus;
      type?: NotificationType;
      priority?: NotificationPriority;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    notifications: INotificationDocument[];
    total: number;
  }> {
    try {
      const {
        status,
        type,
        priority,
        page = 1,
        limit = 20
      } = options;

      const query: any = { userId };

      if (status) {
        query.status = status;
      }

      if (type) {
        query.type = type;
      }

      if (priority) {
        query.priority = priority;
      }

      const total = await Notification.countDocuments(query);
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();

      return {
        notifications,
        total
      };
    } catch (error) {
      logger.error('获取通知列表失败', { userId, error });
      throw new BadRequestError('获取通知列表失败');
    }
  }

  /**
   * 获取单个通知
   */
  async getNotification(notificationId: string, userId: Types.ObjectId): Promise<INotificationDocument> {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        userId
      });

      if (!notification) {
        throw new NotFoundError('通知不存在');
      }

      return notification;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'CastError') {
        throw new NotFoundError('通知不存在');
      }
      logger.error('获取通知失败', { notificationId, userId, error });
      throw new BadRequestError('获取通知失败');
    }
  }

  /**
   * 标记通知为已读
   */
  async markAsRead(notificationId: string, userId: Types.ObjectId): Promise<void> {
    try {
      const notification = await this.getNotification(notificationId, userId);
      await notification.markAsRead();
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('标记通知为已读失败', { notificationId, userId, error });
      throw new BadRequestError('标记通知为已读失败');
    }
  }

  /**
   * 批量标记通知为已读
   */
  async markMultipleAsRead(notificationIds: string[], userId: Types.ObjectId): Promise<void> {
    try {
      await Notification.updateMany(
        {
          _id: { $in: notificationIds },
          userId,
          status: NotificationStatus.UNREAD
        },
        {
          $set: {
            status: NotificationStatus.READ,
            readAt: new Date()
          }
        }
      );
    } catch (error) {
      logger.error('批量标记通知为已读失败', { notificationIds, userId, error });
      throw new BadRequestError('批量标记通知为已读失败');
    }
  }

  /**
   * 归档通知
   */
  async archiveNotification(notificationId: string, userId: Types.ObjectId): Promise<void> {
    try {
      const notification = await this.getNotification(notificationId, userId);
      await notification.archive();
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('归档通知失败', { notificationId, userId, error });
      throw new BadRequestError('归档通知失败');
    }
  }

  /**
   * 获取未读通知数量
   */
  async getUnreadCount(userId: Types.ObjectId): Promise<number> {
    try {
      return await Notification.getUnreadCount(userId);
    } catch (error) {
      logger.error('获取未读通知数量失败', { userId, error });
      throw new BadRequestError('获取未读通知数量失败');
    }
  }

  /**
   * 获取通知统计信息
   */
  async getStats(userId: Types.ObjectId): Promise<{
    total: number;
    unread: number;
    read: number;
    archived: number;
    byType: Record<NotificationType, number>;
    byPriority: Record<NotificationPriority, number>;
  }> {
    try {
      return await Notification.getStats(userId);
    } catch (error) {
      logger.error('获取通知统计信息失败', { userId, error });
      throw new BadRequestError('获取通知统计信息失败');
    }
  }

  /**
   * 删除通知
   */
  async deleteNotification(notificationId: string, userId: Types.ObjectId): Promise<void> {
    try {
      const result = await Notification.deleteOne({
        _id: notificationId,
        userId
      });

      if (result.deletedCount === 0) {
        throw new NotFoundError('通知不存在');
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'CastError') {
        throw new NotFoundError('通知不存在');
      }
      logger.error('删除通知失败', { notificationId, userId, error });
      throw new BadRequestError('删除通知失败');
    }
  }
}

// 创建并导出默认实例
const notificationService = new NotificationService();
export default notificationService; 