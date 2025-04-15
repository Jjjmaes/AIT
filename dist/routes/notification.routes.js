"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const notification_controller_1 = require("../controllers/notification.controller");
const router = (0, express_1.Router)();
// 所有通知路由都需要认证
router.use(auth_middleware_1.authenticateJwt);
// 获取通知列表
router.get('/', notification_controller_1.getNotifications);
// 获取单个通知
router.get('/:id', notification_controller_1.getNotification);
// 标记通知为已读
router.put('/:id/read', notification_controller_1.markAsRead);
// 批量标记通知为已读
router.put('/read', notification_controller_1.markMultipleAsRead);
// 归档通知
router.put('/:id/archive', notification_controller_1.archiveNotification);
// 获取未读通知数量
router.get('/unread/count', notification_controller_1.getUnreadCount);
// 获取通知统计信息
router.get('/stats', notification_controller_1.getNotificationStats);
// 删除通知
router.delete('/:id', notification_controller_1.deleteNotification);
exports.default = router;
