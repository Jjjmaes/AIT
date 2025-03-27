import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Notification } from '../../models/notification.model';
import notificationService from '../../services/notification.service';
import { NotificationType, NotificationPriority, NotificationStatus } from '../../types/notification.types';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Notification.deleteMany({});
});

describe('NotificationService', () => {
  const userId = new mongoose.Types.ObjectId();
  const mockNotification = {
    userId,
    type: NotificationType.REVIEW_REQUEST,
    title: '测试通知',
    content: '这是一个测试通知',
    priority: NotificationPriority.MEDIUM,
    status: NotificationStatus.UNREAD,
    metadata: {
      projectId: new mongoose.Types.ObjectId(),
      fileId: new mongoose.Types.ObjectId()
    }
  };

  describe('createNotification', () => {
    it('should create a new notification', async () => {
      const notification = await notificationService.createNotification(mockNotification);

      expect(notification).toBeDefined();
      expect(notification.userId).toEqual(userId);
      expect(notification.type).toBe(NotificationType.REVIEW_REQUEST);
      expect(notification.title).toBe('测试通知');
      expect(notification.content).toBe('这是一个测试通知');
      expect(notification.priority).toBe(NotificationPriority.MEDIUM);
      expect(notification.status).toBe(NotificationStatus.UNREAD);
      expect(notification.metadata).toEqual(mockNotification.metadata);
      expect(notification.createdAt).toBeDefined();
    });
  });

  describe('getNotifications', () => {
    beforeEach(async () => {
      // 创建多个测试通知
      await Notification.create([
        { ...mockNotification, type: NotificationType.REVIEW_REQUEST },
        { ...mockNotification, type: NotificationType.ISSUE_CREATED },
        { ...mockNotification, type: NotificationType.SYSTEM }
      ]);
    });

    it('should return all notifications for user', async () => {
      const result = await notificationService.getNotifications(userId);

      expect(result.notifications).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should filter notifications by type', async () => {
      const result = await notificationService.getNotifications(userId, {
        type: NotificationType.REVIEW_REQUEST
      });

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0].type).toBe(NotificationType.REVIEW_REQUEST);
    });

    it('should support pagination', async () => {
      const result = await notificationService.getNotifications(userId, {
        page: 1,
        limit: 2
      });

      expect(result.notifications).toHaveLength(2);
      expect(result.total).toBe(3);
    });
  });

  describe('getNotification', () => {
    let notificationId: string;

    beforeEach(async () => {
      const notification = await Notification.create(mockNotification);
      notificationId = notification._id.toString();
    });

    it('should return notification by id', async () => {
      const notification = await notificationService.getNotification(notificationId, userId);

      expect(notification).toBeDefined();
      expect(notification._id.toString()).toBe(notificationId);
    });

    it('should throw NotFoundError for non-existent notification', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      await expect(
        notificationService.getNotification(nonExistentId, userId)
      ).rejects.toThrow('通知不存在');
    });
  });

  describe('markAsRead', () => {
    let notificationId: string;

    beforeEach(async () => {
      const notification = await Notification.create(mockNotification);
      notificationId = notification._id.toString();
    });

    it('should mark notification as read', async () => {
      await notificationService.markAsRead(notificationId, userId);

      const notification = await Notification.findById(notificationId);
      expect(notification?.status).toBe(NotificationStatus.READ);
      expect(notification?.readAt).toBeDefined();
    });
  });

  describe('markMultipleAsRead', () => {
    let notificationIds: string[];

    beforeEach(async () => {
      const notifications = await Notification.create([
        { ...mockNotification },
        { ...mockNotification },
        { ...mockNotification }
      ]);
      notificationIds = notifications.map(n => n._id.toString());
    });

    it('should mark multiple notifications as read', async () => {
      await notificationService.markMultipleAsRead(notificationIds, userId);

      const notifications = await Notification.find({
        _id: { $in: notificationIds }
      });

      notifications.forEach(notification => {
        expect(notification.status).toBe(NotificationStatus.READ);
        expect(notification.readAt).toBeDefined();
      });
    });
  });

  describe('archiveNotification', () => {
    let notificationId: string;

    beforeEach(async () => {
      const notification = await Notification.create(mockNotification);
      notificationId = notification._id.toString();
    });

    it('should archive notification', async () => {
      await notificationService.archiveNotification(notificationId, userId);

      const notification = await Notification.findById(notificationId);
      expect(notification?.status).toBe(NotificationStatus.ARCHIVED);
      expect(notification?.archivedAt).toBeDefined();
    });
  });

  describe('getUnreadCount', () => {
    beforeEach(async () => {
      await Notification.create([
        { ...mockNotification, status: NotificationStatus.UNREAD },
        { ...mockNotification, status: NotificationStatus.READ },
        { ...mockNotification, status: NotificationStatus.ARCHIVED }
      ]);
    });

    it('should return count of unread notifications', async () => {
      const count = await notificationService.getUnreadCount(userId);
      expect(count).toBe(1);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await Notification.create([
        { ...mockNotification, type: NotificationType.REVIEW_REQUEST, status: NotificationStatus.UNREAD },
        { ...mockNotification, type: NotificationType.ISSUE_CREATED, status: NotificationStatus.READ },
        { ...mockNotification, type: NotificationType.SYSTEM, status: NotificationStatus.ARCHIVED }
      ]);
    });

    it('should return notification statistics', async () => {
      const stats = await notificationService.getStats(userId);

      expect(stats.total).toBe(3);
      expect(stats.unread).toBe(1);
      expect(stats.read).toBe(1);
      expect(stats.archived).toBe(1);
      expect(stats.byType[NotificationType.REVIEW_REQUEST]).toBe(1);
      expect(stats.byType[NotificationType.ISSUE_CREATED]).toBe(1);
      expect(stats.byType[NotificationType.SYSTEM]).toBe(1);
    });
  });

  describe('deleteNotification', () => {
    let notificationId: string;

    beforeEach(async () => {
      const notification = await Notification.create(mockNotification);
      notificationId = notification._id.toString();
    });

    it('should delete notification', async () => {
      await notificationService.deleteNotification(notificationId, userId);

      const notification = await Notification.findById(notificationId);
      expect(notification).toBeNull();
    });

    it('should throw NotFoundError for non-existent notification', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      await expect(
        notificationService.deleteNotification(nonExistentId, userId)
      ).rejects.toThrow('通知不存在');
    });
  });
}); 