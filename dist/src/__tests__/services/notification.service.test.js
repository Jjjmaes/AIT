"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const notification_model_1 = require("../../models/notification.model");
const notification_service_1 = __importDefault(require("../../services/notification.service"));
const notification_types_1 = require("../../types/notification.types");
let mongoServer;
beforeAll(async () => {
    mongoServer = await mongodb_memory_server_1.MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose_1.default.connect(mongoUri);
});
afterAll(async () => {
    await mongoose_1.default.disconnect();
    await mongoServer.stop();
});
beforeEach(async () => {
    await notification_model_1.Notification.deleteMany({});
});
describe('NotificationService', () => {
    const userId = new mongoose_1.default.Types.ObjectId();
    const mockNotification = {
        userId,
        type: notification_types_1.NotificationType.REVIEW_REQUEST,
        title: '测试通知',
        content: '这是一个测试通知',
        priority: notification_types_1.NotificationPriority.MEDIUM,
        status: notification_types_1.NotificationStatus.UNREAD,
        metadata: {
            projectId: new mongoose_1.default.Types.ObjectId(),
            fileId: new mongoose_1.default.Types.ObjectId()
        }
    };
    describe('createNotification', () => {
        it('should create a new notification', async () => {
            const notification = await notification_service_1.default.createNotification(mockNotification);
            expect(notification).toBeDefined();
            expect(notification.userId).toEqual(userId);
            expect(notification.type).toBe(notification_types_1.NotificationType.REVIEW_REQUEST);
            expect(notification.title).toBe('测试通知');
            expect(notification.content).toBe('这是一个测试通知');
            expect(notification.priority).toBe(notification_types_1.NotificationPriority.MEDIUM);
            expect(notification.status).toBe(notification_types_1.NotificationStatus.UNREAD);
            expect(notification.metadata).toEqual(mockNotification.metadata);
            expect(notification.createdAt).toBeDefined();
        });
    });
    describe('getNotifications', () => {
        beforeEach(async () => {
            // 创建多个测试通知
            await notification_model_1.Notification.create([
                { ...mockNotification, type: notification_types_1.NotificationType.REVIEW_REQUEST },
                { ...mockNotification, type: notification_types_1.NotificationType.ISSUE_CREATED },
                { ...mockNotification, type: notification_types_1.NotificationType.SYSTEM }
            ]);
        });
        it('should return all notifications for user', async () => {
            const result = await notification_service_1.default.getNotifications(userId);
            expect(result.notifications).toHaveLength(3);
            expect(result.total).toBe(3);
        });
        it('should filter notifications by type', async () => {
            const result = await notification_service_1.default.getNotifications(userId, {
                type: notification_types_1.NotificationType.REVIEW_REQUEST
            });
            expect(result.notifications).toHaveLength(1);
            expect(result.notifications[0].type).toBe(notification_types_1.NotificationType.REVIEW_REQUEST);
        });
        it('should support pagination', async () => {
            const result = await notification_service_1.default.getNotifications(userId, {
                page: 1,
                limit: 2
            });
            expect(result.notifications).toHaveLength(2);
            expect(result.total).toBe(3);
        });
    });
    describe('getNotification', () => {
        let notificationId;
        beforeEach(async () => {
            const notification = await notification_model_1.Notification.create(mockNotification);
            notificationId = notification._id.toString();
        });
        it('should return notification by id', async () => {
            const notification = await notification_service_1.default.getNotification(notificationId, userId);
            expect(notification).toBeDefined();
            expect(notification._id.toString()).toBe(notificationId);
        });
        it('should throw NotFoundError for non-existent notification', async () => {
            const nonExistentId = new mongoose_1.default.Types.ObjectId().toString();
            await expect(notification_service_1.default.getNotification(nonExistentId, userId)).rejects.toThrow('通知不存在');
        });
    });
    describe('markAsRead', () => {
        let notificationId;
        beforeEach(async () => {
            const notification = await notification_model_1.Notification.create(mockNotification);
            notificationId = notification._id.toString();
        });
        it('should mark notification as read', async () => {
            await notification_service_1.default.markAsRead(notificationId, userId);
            const notification = await notification_model_1.Notification.findById(notificationId);
            expect(notification?.status).toBe(notification_types_1.NotificationStatus.READ);
            expect(notification?.readAt).toBeDefined();
        });
    });
    describe('markMultipleAsRead', () => {
        let notificationIds;
        beforeEach(async () => {
            const notifications = await notification_model_1.Notification.create([
                { ...mockNotification },
                { ...mockNotification },
                { ...mockNotification }
            ]);
            notificationIds = notifications.map(n => n._id.toString());
        });
        it('should mark multiple notifications as read', async () => {
            await notification_service_1.default.markMultipleAsRead(notificationIds, userId);
            const notifications = await notification_model_1.Notification.find({
                _id: { $in: notificationIds }
            });
            notifications.forEach(notification => {
                expect(notification.status).toBe(notification_types_1.NotificationStatus.READ);
                expect(notification.readAt).toBeDefined();
            });
        });
    });
    describe('archiveNotification', () => {
        let notificationId;
        beforeEach(async () => {
            const notification = await notification_model_1.Notification.create(mockNotification);
            notificationId = notification._id.toString();
        });
        it('should archive notification', async () => {
            await notification_service_1.default.archiveNotification(notificationId, userId);
            const notification = await notification_model_1.Notification.findById(notificationId);
            expect(notification?.status).toBe(notification_types_1.NotificationStatus.ARCHIVED);
            expect(notification?.archivedAt).toBeDefined();
        });
    });
    describe('getUnreadCount', () => {
        beforeEach(async () => {
            await notification_model_1.Notification.create([
                { ...mockNotification, status: notification_types_1.NotificationStatus.UNREAD },
                { ...mockNotification, status: notification_types_1.NotificationStatus.READ },
                { ...mockNotification, status: notification_types_1.NotificationStatus.ARCHIVED }
            ]);
        });
        it('should return count of unread notifications', async () => {
            const count = await notification_service_1.default.getUnreadCount(userId);
            expect(count).toBe(1);
        });
    });
    describe('getStats', () => {
        beforeEach(async () => {
            await notification_model_1.Notification.create([
                { ...mockNotification, type: notification_types_1.NotificationType.REVIEW_REQUEST, status: notification_types_1.NotificationStatus.UNREAD },
                { ...mockNotification, type: notification_types_1.NotificationType.ISSUE_CREATED, status: notification_types_1.NotificationStatus.READ },
                { ...mockNotification, type: notification_types_1.NotificationType.SYSTEM, status: notification_types_1.NotificationStatus.ARCHIVED }
            ]);
        });
        it('should return notification statistics', async () => {
            const stats = await notification_service_1.default.getStats(userId);
            expect(stats.total).toBe(3);
            expect(stats.unread).toBe(1);
            expect(stats.read).toBe(1);
            expect(stats.archived).toBe(1);
            expect(stats.byType[notification_types_1.NotificationType.REVIEW_REQUEST]).toBe(1);
            expect(stats.byType[notification_types_1.NotificationType.ISSUE_CREATED]).toBe(1);
            expect(stats.byType[notification_types_1.NotificationType.SYSTEM]).toBe(1);
        });
    });
    describe('deleteNotification', () => {
        let notificationId;
        beforeEach(async () => {
            const notification = await notification_model_1.Notification.create(mockNotification);
            notificationId = notification._id.toString();
        });
        it('should delete notification', async () => {
            await notification_service_1.default.deleteNotification(notificationId, userId);
            const notification = await notification_model_1.Notification.findById(notificationId);
            expect(notification).toBeNull();
        });
        it('should throw NotFoundError for non-existent notification', async () => {
            const nonExistentId = new mongoose_1.default.Types.ObjectId().toString();
            await expect(notification_service_1.default.deleteNotification(nonExistentId, userId)).rejects.toThrow('通知不存在');
        });
    });
});
