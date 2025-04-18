"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const notification_service_1 = __importDefault(require("../../services/notification.service"));
const notification_types_1 = require("../../types/notification.types");
const mongoose_1 = __importDefault(require("mongoose"));
const notification_controller_1 = require("../../controllers/notification.controller");
const errors_1 = require("../../utils/errors");
describe('NotificationController', () => {
    describe('getNotifications', () => {
        it('should return all notifications', async () => {
            const mockNotification = {
                _id: new mongoose_1.default.Types.ObjectId(),
                userId: new mongoose_1.default.Types.ObjectId(),
                title: '测试通知1',
                content: '这是测试通知1',
                type: notification_types_1.NotificationType.REVIEW_REQUEST,
                priority: notification_types_1.NotificationPriority.MEDIUM,
                status: notification_types_1.NotificationStatus.UNREAD,
                metadata: {
                    projectId: new mongoose_1.default.Types.ObjectId(),
                    fileId: new mongoose_1.default.Types.ObjectId()
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                markAsRead: jest.fn(),
                archive: jest.fn(),
                $assertPopulated: jest.fn(),
                $clone: jest.fn()
            };
            const mockReq = {
                query: {},
                user: { id: mockNotification.userId }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            jest.spyOn(notification_service_1.default, 'getNotifications').mockResolvedValue({
                notifications: [mockNotification],
                total: 1
            });
            await (0, notification_controller_1.getNotifications)(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    notifications: expect.arrayContaining([
                        expect.objectContaining({
                            _id: expect.any(mongoose_1.default.Types.ObjectId),
                            userId: expect.any(mongoose_1.default.Types.ObjectId),
                            title: mockNotification.title,
                            content: mockNotification.content,
                            type: mockNotification.type,
                            priority: mockNotification.priority,
                            status: mockNotification.status,
                            metadata: expect.objectContaining({
                                projectId: expect.any(mongoose_1.default.Types.ObjectId),
                                fileId: expect.any(mongoose_1.default.Types.ObjectId)
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
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            await (0, notification_controller_1.getNotifications)(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: '未授权的访问' });
        });
        it('should handle invalid pagination parameters', async () => {
            const mockReq = {
                query: {
                    page: '0',
                    limit: '-1'
                },
                user: { id: new mongoose_1.default.Types.ObjectId() }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            await (0, notification_controller_1.getNotifications)(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({ error: '页码必须是大于0的数字' });
        });
    });
    describe('getNotification', () => {
        it('should return notification by id', async () => {
            const mockNotification = {
                _id: new mongoose_1.default.Types.ObjectId(),
                userId: new mongoose_1.default.Types.ObjectId(),
                title: '测试通知',
                content: '这是一个测试通知',
                type: notification_types_1.NotificationType.REVIEW_REQUEST,
                priority: notification_types_1.NotificationPriority.MEDIUM,
                status: notification_types_1.NotificationStatus.UNREAD,
                metadata: {
                    projectId: new mongoose_1.default.Types.ObjectId(),
                    fileId: new mongoose_1.default.Types.ObjectId()
                },
                createdAt: new Date(),
                updatedAt: new Date(),
                markAsRead: jest.fn(),
                archive: jest.fn(),
                $assertPopulated: jest.fn(),
                $clone: jest.fn()
            };
            const mockReq = {
                params: { id: mockNotification._id.toString() },
                user: { id: mockNotification.userId }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            jest.spyOn(notification_service_1.default, 'getNotification').mockResolvedValue(mockNotification);
            await (0, notification_controller_1.getNotification)(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    _id: expect.any(mongoose_1.default.Types.ObjectId),
                    userId: expect.any(mongoose_1.default.Types.ObjectId),
                    title: mockNotification.title,
                    content: mockNotification.content,
                    type: mockNotification.type,
                    priority: mockNotification.priority,
                    status: mockNotification.status,
                    metadata: expect.objectContaining({
                        projectId: expect.any(mongoose_1.default.Types.ObjectId),
                        fileId: expect.any(mongoose_1.default.Types.ObjectId)
                    })
                })
            });
        });
        it('should handle non-existent notification', async () => {
            const mockReq = {
                params: { id: new mongoose_1.default.Types.ObjectId().toString() },
                user: { id: new mongoose_1.default.Types.ObjectId() }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            jest.spyOn(notification_service_1.default, 'getNotification').mockRejectedValue(new errors_1.NotFoundError('通知不存在'));
            await (0, notification_controller_1.getNotification)(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: '通知不存在' });
        });
    });
    describe('markAsRead', () => {
        it('should mark notification as read', async () => {
            const mockReq = {
                params: { id: new mongoose_1.default.Types.ObjectId().toString() },
                user: { id: new mongoose_1.default.Types.ObjectId() }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            jest.spyOn(notification_service_1.default, 'markAsRead').mockResolvedValue(undefined);
            await (0, notification_controller_1.markAsRead)(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: '通知已标记为已读'
            });
        });
        it('should handle non-existent notification', async () => {
            const mockReq = {
                params: { id: new mongoose_1.default.Types.ObjectId().toString() },
                user: { id: new mongoose_1.default.Types.ObjectId() }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            jest.spyOn(notification_service_1.default, 'markAsRead').mockRejectedValue(new errors_1.NotFoundError('通知不存在'));
            await (0, notification_controller_1.markAsRead)(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: '通知不存在' });
        });
    });
    describe('markMultipleAsRead', () => {
        it('should mark multiple notifications as read', async () => {
            const mockReq = {
                body: {
                    notificationIds: [
                        new mongoose_1.default.Types.ObjectId().toString(),
                        new mongoose_1.default.Types.ObjectId().toString()
                    ]
                },
                user: { id: new mongoose_1.default.Types.ObjectId() }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            jest.spyOn(notification_service_1.default, 'markMultipleAsRead').mockResolvedValue(undefined);
            await (0, notification_controller_1.markMultipleAsRead)(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: '通知已批量标记为已读'
            });
        });
        it('should handle empty notification ids', async () => {
            const mockReq = {
                body: { notificationIds: [] },
                user: { id: new mongoose_1.default.Types.ObjectId() }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            await (0, notification_controller_1.markMultipleAsRead)(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({ error: '通知ID列表不能为空' });
        });
    });
    describe('archiveNotification', () => {
        it('should archive notification', async () => {
            const mockReq = {
                params: { id: new mongoose_1.default.Types.ObjectId().toString() },
                user: { id: new mongoose_1.default.Types.ObjectId() }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            jest.spyOn(notification_service_1.default, 'archiveNotification').mockResolvedValue(undefined);
            await (0, notification_controller_1.archiveNotification)(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: '通知已归档'
            });
        });
        it('should handle non-existent notification', async () => {
            const mockReq = {
                params: { id: new mongoose_1.default.Types.ObjectId().toString() },
                user: { id: new mongoose_1.default.Types.ObjectId() }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            jest.spyOn(notification_service_1.default, 'archiveNotification').mockRejectedValue(new errors_1.NotFoundError('通知不存在'));
            await (0, notification_controller_1.archiveNotification)(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: '通知不存在' });
        });
    });
    describe('getUnreadCount', () => {
        it('should return unread count', async () => {
            const mockReq = {
                user: { id: new mongoose_1.default.Types.ObjectId() }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            jest.spyOn(notification_service_1.default, 'getUnreadCount').mockResolvedValue(5);
            await (0, notification_controller_1.getUnreadCount)(mockReq, mockRes);
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
                user: { id: new mongoose_1.default.Types.ObjectId() }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const mockStats = {
                total: 10,
                unread: 5,
                read: 3,
                archived: 2,
                byType: {
                    [notification_types_1.NotificationType.REVIEW_REQUEST]: 3,
                    [notification_types_1.NotificationType.REVIEW_COMPLETE]: 2,
                    [notification_types_1.NotificationType.ISSUE_CREATED]: 1,
                    [notification_types_1.NotificationType.ISSUE_RESOLVED]: 1,
                    [notification_types_1.NotificationType.PROJECT_ASSIGNED]: 1,
                    [notification_types_1.NotificationType.FILE_COMPLETE]: 1,
                    [notification_types_1.NotificationType.SYSTEM]: 1
                },
                byPriority: {
                    [notification_types_1.NotificationPriority.LOW]: 3,
                    [notification_types_1.NotificationPriority.MEDIUM]: 5,
                    [notification_types_1.NotificationPriority.HIGH]: 2
                }
            };
            jest.spyOn(notification_service_1.default, 'getStats').mockResolvedValue(mockStats);
            await (0, notification_controller_1.getNotificationStats)(mockReq, mockRes);
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
                params: { id: new mongoose_1.default.Types.ObjectId().toString() },
                user: { id: new mongoose_1.default.Types.ObjectId() }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            jest.spyOn(notification_service_1.default, 'deleteNotification').mockResolvedValue(undefined);
            await (0, notification_controller_1.deleteNotification)(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: '通知已删除'
            });
        });
        it('should handle non-existent notification', async () => {
            const mockReq = {
                params: { id: new mongoose_1.default.Types.ObjectId().toString() },
                user: { id: new mongoose_1.default.Types.ObjectId() }
            };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            jest.spyOn(notification_service_1.default, 'deleteNotification').mockRejectedValue(new errors_1.NotFoundError('通知不存在'));
            await (0, notification_controller_1.deleteNotification)(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: '通知不存在' });
        });
    });
});
