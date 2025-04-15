"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const notification_model_1 = require("../models/notification.model");
const notification_types_1 = require("../types/notification.types");
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
class BadRequestError extends errors_1.AppError {
    constructor(message = '请求参数错误') {
        super(message, 400);
        this.name = 'BadRequestError';
    }
}
class NotificationService {
    /**
     * 创建通知
     */
    async createNotification(data) {
        try {
            const notification = new notification_model_1.Notification({
                ...data,
                createdAt: new Date()
            });
            return await notification.save();
        }
        catch (error) {
            logger_1.default.error('创建通知失败', { error });
            throw new BadRequestError('创建通知失败');
        }
    }
    /**
     * 获取用户的通知列表
     */
    async getNotifications(userId, options = {}) {
        try {
            const { status, type, priority, page = 1, limit = 20 } = options;
            const query = { userId };
            if (status) {
                query.status = status;
            }
            if (type) {
                query.type = type;
            }
            if (priority) {
                query.priority = priority;
            }
            const total = await notification_model_1.Notification.countDocuments(query);
            const notifications = await notification_model_1.Notification.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .exec();
            return {
                notifications,
                total
            };
        }
        catch (error) {
            logger_1.default.error('获取通知列表失败', { userId, error });
            throw new BadRequestError('获取通知列表失败');
        }
    }
    /**
     * 获取单个通知
     */
    async getNotification(notificationId, userId) {
        try {
            const notification = await notification_model_1.Notification.findOne({
                _id: notificationId,
                userId
            });
            if (!notification) {
                throw new errors_1.NotFoundError('通知不存在');
            }
            return notification;
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError) {
                throw error;
            }
            if (error instanceof Error && error.name === 'CastError') {
                throw new errors_1.NotFoundError('通知不存在');
            }
            logger_1.default.error('获取通知失败', { notificationId, userId, error });
            throw new BadRequestError('获取通知失败');
        }
    }
    /**
     * 标记通知为已读
     */
    async markAsRead(notificationId, userId) {
        try {
            const notification = await this.getNotification(notificationId, userId);
            await notification.markAsRead();
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError) {
                throw error;
            }
            logger_1.default.error('标记通知为已读失败', { notificationId, userId, error });
            throw new BadRequestError('标记通知为已读失败');
        }
    }
    /**
     * 批量标记通知为已读
     */
    async markMultipleAsRead(notificationIds, userId) {
        try {
            await notification_model_1.Notification.updateMany({
                _id: { $in: notificationIds },
                userId,
                status: notification_types_1.NotificationStatus.UNREAD
            }, {
                $set: {
                    status: notification_types_1.NotificationStatus.READ,
                    readAt: new Date()
                }
            });
        }
        catch (error) {
            logger_1.default.error('批量标记通知为已读失败', { notificationIds, userId, error });
            throw new BadRequestError('批量标记通知为已读失败');
        }
    }
    /**
     * 归档通知
     */
    async archiveNotification(notificationId, userId) {
        try {
            const notification = await this.getNotification(notificationId, userId);
            await notification.archive();
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError) {
                throw error;
            }
            logger_1.default.error('归档通知失败', { notificationId, userId, error });
            throw new BadRequestError('归档通知失败');
        }
    }
    /**
     * 获取未读通知数量
     */
    async getUnreadCount(userId) {
        try {
            return await notification_model_1.Notification.getUnreadCount(userId);
        }
        catch (error) {
            logger_1.default.error('获取未读通知数量失败', { userId, error });
            throw new BadRequestError('获取未读通知数量失败');
        }
    }
    /**
     * 获取通知统计信息
     */
    async getStats(userId) {
        try {
            return await notification_model_1.Notification.getStats(userId);
        }
        catch (error) {
            logger_1.default.error('获取通知统计信息失败', { userId, error });
            throw new BadRequestError('获取通知统计信息失败');
        }
    }
    /**
     * 删除通知
     */
    async deleteNotification(notificationId, userId) {
        try {
            const result = await notification_model_1.Notification.deleteOne({
                _id: notificationId,
                userId
            });
            if (result.deletedCount === 0) {
                throw new errors_1.NotFoundError('通知不存在');
            }
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError) {
                throw error;
            }
            if (error instanceof Error && error.name === 'CastError') {
                throw new errors_1.NotFoundError('通知不存在');
            }
            logger_1.default.error('删除通知失败', { notificationId, userId, error });
            throw new BadRequestError('删除通知失败');
        }
    }
}
exports.NotificationService = NotificationService;
// 创建并导出默认实例
const notificationService = new NotificationService();
exports.default = notificationService;
