import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import notificationService from '../../services/notification.service';
import { NotificationType, NotificationPriority, NotificationStatus } from '../../types/notification.types';
import mongoose from 'mongoose';
import { INotificationDocument } from '../../models/notification.model';
import { 
  getNotifications, 
  getNotification, 
  markAsRead, 
  markMultipleAsRead, 
  archiveNotification, 
  getUnreadCount, 
  getNotificationStats, 
  deleteNotification 
} from '../../controllers/notification.controller';
import { NotFoundError } from '../../utils/errors';

describe('NotificationController', () => {
  describe('getNotifications', () => {
    it('should return all notifications', async () => {
      const mockNotification = {
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(),
        title: '测试通知1',
        content: '这是测试通知1',
        type: NotificationType.REVIEW_REQUEST,
        priority: NotificationPriority.MEDIUM,
        status: NotificationStatus.UNREAD,
        metadata: {
          projectId: new mongoose.Types.ObjectId(),
          fileId: new mongoose.Types.ObjectId()
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        markAsRead: jest.fn(),
        archive: jest.fn(),
        $assertPopulated: jest.fn(),
        $clone: jest.fn()
      } as unknown as INotificationDocument;

      const mockReq = {
        query: {},
        user: { id: mockNotification.userId }
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      jest.spyOn(notificationService, 'getNotifications').mockResolvedValue({
        notifications: [mockNotification],
        total: 1
      });

      await getNotifications(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          notifications: expect.arrayContaining([
            expect.objectContaining({
              _id: expect.any(mongoose.Types.ObjectId),
              userId: expect.any(mongoose.Types.ObjectId),
              title: mockNotification.title,
              content: mockNotification.content,
              type: mockNotification.type,
              priority: mockNotification.priority,
              status: mockNotification.status,
              metadata: expect.objectContaining({
                projectId: expect.any(mongoose.Types.ObjectId),
                fileId: expect.any(mongoose.Types.ObjectId)
              })
            })
          ]),
          total: 1
        }
      });
    });

    it('should handle unauthorized access', async () => {
      const mockReq = {
        query: {},
        user: null
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      await getNotifications(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '未授权的访问' });
    });

    it('should handle invalid pagination parameters', async () => {
      const mockReq = {
        query: {
          page: '0',
          limit: '-1'
        },
        user: { id: new mongoose.Types.ObjectId() }
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      await getNotifications(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '页码必须是大于0的数字' });
    });
  });

  describe('getNotification', () => {
    it('should return notification by id', async () => {
      const mockNotification = {
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(),
        title: '测试通知',
        content: '这是一个测试通知',
        type: NotificationType.REVIEW_REQUEST,
        priority: NotificationPriority.MEDIUM,
        status: NotificationStatus.UNREAD,
        metadata: {
          projectId: new mongoose.Types.ObjectId(),
          fileId: new mongoose.Types.ObjectId()
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        markAsRead: jest.fn(),
        archive: jest.fn(),
        $assertPopulated: jest.fn(),
        $clone: jest.fn()
      } as unknown as INotificationDocument;

      const mockReq = {
        params: { id: mockNotification._id.toString() },
        user: { id: mockNotification.userId }
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      jest.spyOn(notificationService, 'getNotification').mockResolvedValue(mockNotification);

      await getNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: expect.any(mongoose.Types.ObjectId),
          userId: expect.any(mongoose.Types.ObjectId),
          title: mockNotification.title,
          content: mockNotification.content,
          type: mockNotification.type,
          priority: mockNotification.priority,
          status: mockNotification.status,
          metadata: expect.objectContaining({
            projectId: expect.any(mongoose.Types.ObjectId),
            fileId: expect.any(mongoose.Types.ObjectId)
          })
        })
      });
    });

    it('should handle non-existent notification', async () => {
      const mockReq = {
        params: { id: new mongoose.Types.ObjectId().toString() },
        user: { id: new mongoose.Types.ObjectId() }
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      jest.spyOn(notificationService, 'getNotification').mockRejectedValue(new NotFoundError('通知不存在'));

      await getNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '通知不存在' });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockReq = {
        params: { id: new mongoose.Types.ObjectId().toString() },
        user: { id: new mongoose.Types.ObjectId() }
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      jest.spyOn(notificationService, 'markAsRead').mockResolvedValue(undefined);

      await markAsRead(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '通知已标记为已读'
      });
    });

    it('should handle non-existent notification', async () => {
      const mockReq = {
        params: { id: new mongoose.Types.ObjectId().toString() },
        user: { id: new mongoose.Types.ObjectId() }
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      jest.spyOn(notificationService, 'markAsRead').mockRejectedValue(new NotFoundError('通知不存在'));

      await markAsRead(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '通知不存在' });
    });
  });

  describe('markMultipleAsRead', () => {
    it('should mark multiple notifications as read', async () => {
      const mockReq = {
        body: {
          notificationIds: [
            new mongoose.Types.ObjectId().toString(),
            new mongoose.Types.ObjectId().toString()
          ]
        },
        user: { id: new mongoose.Types.ObjectId() }
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      jest.spyOn(notificationService, 'markMultipleAsRead').mockResolvedValue(undefined);

      await markMultipleAsRead(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '通知已批量标记为已读'
      });
    });

    it('should handle empty notification ids', async () => {
      const mockReq = {
        body: { notificationIds: [] },
        user: { id: new mongoose.Types.ObjectId() }
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      await markMultipleAsRead(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '通知ID列表不能为空' });
    });
  });

  describe('archiveNotification', () => {
    it('should archive notification', async () => {
      const mockReq = {
        params: { id: new mongoose.Types.ObjectId().toString() },
        user: { id: new mongoose.Types.ObjectId() }
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      jest.spyOn(notificationService, 'archiveNotification').mockResolvedValue(undefined);

      await archiveNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '通知已归档'
      });
    });

    it('should handle non-existent notification', async () => {
      const mockReq = {
        params: { id: new mongoose.Types.ObjectId().toString() },
        user: { id: new mongoose.Types.ObjectId() }
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      jest.spyOn(notificationService, 'archiveNotification').mockRejectedValue(new NotFoundError('通知不存在'));

      await archiveNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '通知不存在' });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      const mockReq = {
        user: { id: new mongoose.Types.ObjectId() }
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      jest.spyOn(notificationService, 'getUnreadCount').mockResolvedValue(5);

      await getUnreadCount(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { count: 5 }
      });
    });
  });

  describe('getNotificationStats', () => {
    it('should return notification statistics', async () => {
      const mockReq = {
        user: { id: new mongoose.Types.ObjectId() }
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      const mockStats = {
        total: 10,
        unread: 5,
        read: 3,
        archived: 2,
        byType: {
          [NotificationType.REVIEW_REQUEST]: 3,
          [NotificationType.REVIEW_COMPLETE]: 2,
          [NotificationType.ISSUE_CREATED]: 1,
          [NotificationType.ISSUE_RESOLVED]: 1,
          [NotificationType.PROJECT_ASSIGNED]: 1,
          [NotificationType.FILE_COMPLETE]: 1,
          [NotificationType.SYSTEM]: 1
        },
        byPriority: {
          [NotificationPriority.LOW]: 3,
          [NotificationPriority.MEDIUM]: 5,
          [NotificationPriority.HIGH]: 2
        }
      };

      jest.spyOn(notificationService, 'getStats').mockResolvedValue(mockStats);

      await getNotificationStats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      const mockReq = {
        params: { id: new mongoose.Types.ObjectId().toString() },
        user: { id: new mongoose.Types.ObjectId() }
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      jest.spyOn(notificationService, 'deleteNotification').mockResolvedValue(undefined);

      await deleteNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '通知已删除'
      });
    });

    it('should handle non-existent notification', async () => {
      const mockReq = {
        params: { id: new mongoose.Types.ObjectId().toString() },
        user: { id: new mongoose.Types.ObjectId() }
      } as unknown as AuthRequest;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;

      jest.spyOn(notificationService, 'deleteNotification').mockRejectedValue(new NotFoundError('通知不存在'));

      await deleteNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: '通知不存在' });
    });
  });
});