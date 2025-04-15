"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const notification_types_1 = require("../types/notification.types");
const notificationSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: Object.values(notification_types_1.NotificationType),
        required: true
    },
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: Object.values(notification_types_1.NotificationPriority),
        default: notification_types_1.NotificationPriority.MEDIUM
    },
    status: {
        type: String,
        enum: Object.values(notification_types_1.NotificationStatus),
        default: notification_types_1.NotificationStatus.UNREAD
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed
    },
    readAt: Date,
    archivedAt: Date
}, {
    timestamps: true
});
// 实例方法
notificationSchema.methods.markAsRead = async function () {
    if (this.status === notification_types_1.NotificationStatus.UNREAD) {
        this.status = notification_types_1.NotificationStatus.READ;
        this.readAt = new Date();
        await this.save();
    }
};
notificationSchema.methods.archive = async function () {
    if (this.status !== notification_types_1.NotificationStatus.ARCHIVED) {
        this.status = notification_types_1.NotificationStatus.ARCHIVED;
        this.archivedAt = new Date();
        await this.save();
    }
};
// 静态方法
notificationSchema.statics.getUnreadCount = async function (userId) {
    return this.countDocuments({
        userId,
        status: notification_types_1.NotificationStatus.UNREAD
    });
};
notificationSchema.statics.getStats = async function (userId) {
    const stats = await this.aggregate([
        { $match: { userId } },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                unread: {
                    $sum: { $cond: [{ $eq: ['$status', notification_types_1.NotificationStatus.UNREAD] }, 1, 0] }
                },
                read: {
                    $sum: { $cond: [{ $eq: ['$status', notification_types_1.NotificationStatus.READ] }, 1, 0] }
                },
                archived: {
                    $sum: { $cond: [{ $eq: ['$status', notification_types_1.NotificationStatus.ARCHIVED] }, 1, 0] }
                },
                byType: {
                    $push: {
                        k: '$type',
                        v: 1
                    }
                },
                byPriority: {
                    $push: {
                        k: '$priority',
                        v: 1
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                total: 1,
                unread: 1,
                read: 1,
                archived: 1,
                byType: { $arrayToObject: '$byType' },
                byPriority: { $arrayToObject: '$byPriority' }
            }
        }
    ]);
    return stats[0] || {
        total: 0,
        unread: 0,
        read: 0,
        archived: 0,
        byType: Object.values(notification_types_1.NotificationType).reduce((acc, type) => ({ ...acc, [type]: 0 }), {}),
        byPriority: Object.values(notification_types_1.NotificationPriority).reduce((acc, priority) => ({ ...acc, [priority]: 0 }), {})
    };
};
// 创建索引
notificationSchema.index({ userId: 1, status: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });
exports.Notification = mongoose_1.default.model('Notification', notificationSchema);
