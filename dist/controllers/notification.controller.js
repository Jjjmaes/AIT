"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotifications = getNotifications;
exports.getNotification = getNotification;
exports.markAsRead = markAsRead;
exports.markMultipleAsRead = markMultipleAsRead;
exports.archiveNotification = archiveNotification;
exports.getUnreadCount = getUnreadCount;
exports.getNotificationStats = getNotificationStats;
exports.deleteNotification = deleteNotification;
const notification_service_1 = __importDefault(require("../services/notification.service"));
const logger_1 = __importDefault(require("../utils/logger"));
const mongoose_1 = require("mongoose");
const errors_1 = require("../utils/errors");
/**
 * 获取通知列表
 * GET /api/notifications
 */
async function getNotifications(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: '未授权的访问' });
            return;
        }
        const { status, type, priority, page, limit } = req.query;
        const options = {};
        if (status) {
            options.status = status;
        }
        if (type) {
            options.type = type;
        }
        if (priority) {
            options.priority = priority;
        }
        if (page) {
            const pageNum = parseInt(page);
            if (isNaN(pageNum) || pageNum < 1) {
                res.status(400).json({ error: '页码必须是大于0的数字' });
                return;
            }
            options.page = pageNum;
        }
        if (limit) {
            const limitNum = parseInt(limit);
            if (isNaN(limitNum) || limitNum < 1) {
                res.status(400).json({ error: '每页数量必须是大于0的数字' });
                return;
            }
            options.limit = limitNum;
        }
        try {
            const result = await notification_service_1.default.getNotifications(new mongoose_1.Types.ObjectId(userId), options);
            res.status(200).json({
                success: true,
                data: result
            });
        }
        catch (serviceError) {
            if (serviceError.name === 'BadRequestError') {
                res.status(400).json({ error: serviceError.message });
            }
            else {
                throw serviceError;
            }
        }
    }
    catch (error) {
        if (error instanceof errors_1.NotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        logger_1.default.error('获取通知列表失败', { error });
        res.status(500).json({ error: error.message || '获取通知列表失败' });
    }
}
/**
 * 获取单个通知
 * GET /api/notifications/:id
 */
async function getNotification(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: '未授权的访问' });
            return;
        }
        const { id } = req.params;
        const notification = await notification_service_1.default.getNotification(id, new mongoose_1.Types.ObjectId(userId));
        res.status(200).json({
            success: true,
            data: notification
        });
    }
    catch (error) {
        if (error instanceof errors_1.NotFoundError) {
            res.status(404).json({ error: error.message });
            return;
        }
        logger_1.default.error('获取通知失败', { error });
        res.status(500).json({ error: error.message || '获取通知失败' });
    }
}
/**
 * 标记通知为已读
 * PUT /api/notifications/:id/read
 */
async function markAsRead(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: '未授权的访问' });
            return;
        }
        const { id } = req.params;
        await notification_service_1.default.markAsRead(id, new mongoose_1.Types.ObjectId(userId));
        res.status(200).json({
            success: true,
            message: '通知已标记为已读'
        });
    }
    catch (error) {
        if (error.name === 'NotFoundError') {
            res.status(404).json({ error: error.message });
        }
        else {
            logger_1.default.error('标记通知为已读失败', { error });
            res.status(500).json({ error: error.message || '标记通知为已读失败' });
        }
    }
}
/**
 * 批量标记通知为已读
 * PUT /api/notifications/read
 */
async function markMultipleAsRead(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: '未授权的访问' });
            return;
        }
        const { notificationIds } = req.body;
        if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
            res.status(400).json({ error: '通知ID列表不能为空' });
            return;
        }
        await notification_service_1.default.markMultipleAsRead(notificationIds, new mongoose_1.Types.ObjectId(userId));
        res.status(200).json({
            success: true,
            message: '通知已批量标记为已读'
        });
    }
    catch (error) {
        logger_1.default.error('批量标记通知为已读失败', { error });
        res.status(500).json({ error: error.message || '批量标记通知为已读失败' });
    }
}
/**
 * 归档通知
 * PUT /api/notifications/:id/archive
 */
async function archiveNotification(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: '未授权的访问' });
            return;
        }
        const { id } = req.params;
        await notification_service_1.default.archiveNotification(id, new mongoose_1.Types.ObjectId(userId));
        res.status(200).json({
            success: true,
            message: '通知已归档'
        });
    }
    catch (error) {
        if (error.name === 'NotFoundError') {
            res.status(404).json({ error: error.message });
        }
        else {
            logger_1.default.error('归档通知失败', { error });
            res.status(500).json({ error: error.message || '归档通知失败' });
        }
    }
}
/**
 * 获取未读通知数量
 * GET /api/notifications/unread/count
 */
async function getUnreadCount(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: '未授权的访问' });
            return;
        }
        const count = await notification_service_1.default.getUnreadCount(new mongoose_1.Types.ObjectId(userId));
        res.status(200).json({
            success: true,
            data: { count }
        });
    }
    catch (error) {
        logger_1.default.error('获取未读通知数量失败', { error });
        res.status(500).json({ error: error.message || '获取未读通知数量失败' });
    }
}
/**
 * 获取通知统计信息
 * GET /api/notifications/stats
 */
async function getNotificationStats(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: '未授权的访问' });
            return;
        }
        const stats = await notification_service_1.default.getStats(new mongoose_1.Types.ObjectId(userId));
        res.status(200).json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        logger_1.default.error('获取通知统计信息失败', { error });
        res.status(500).json({ error: error.message || '获取通知统计信息失败' });
    }
}
/**
 * 删除通知
 * DELETE /api/notifications/:id
 */
async function deleteNotification(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: '未授权的访问' });
            return;
        }
        const { id } = req.params;
        await notification_service_1.default.deleteNotification(id, new mongoose_1.Types.ObjectId(userId));
        res.status(200).json({
            success: true,
            message: '通知已删除'
        });
    }
    catch (error) {
        if (error.name === 'NotFoundError') {
            res.status(404).json({ error: error.message });
        }
        else {
            logger_1.default.error('删除通知失败', { error });
            res.status(500).json({ error: error.message || '删除通知失败' });
        }
    }
}
