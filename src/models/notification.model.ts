import mongoose, { Schema, Document, Model } from 'mongoose';
import { INotification, NotificationType, NotificationPriority, NotificationStatus } from '../types/notification.types';

export interface INotificationDocument extends INotification, Document {
  markAsRead(): Promise<void>;
  archive(): Promise<void>;
}

export interface INotificationModel extends Model<INotificationDocument> {
  getUnreadCount(userId: mongoose.Types.ObjectId): Promise<number>;
  getStats(userId: mongoose.Types.ObjectId): Promise<{
    total: number;
    unread: number;
    read: number;
    archived: number;
    byType: Record<NotificationType, number>;
    byPriority: Record<NotificationPriority, number>;
  }>;
}

const notificationSchema = new Schema<INotificationDocument, INotificationModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
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
      enum: Object.values(NotificationPriority),
      default: NotificationPriority.MEDIUM
    },
    status: {
      type: String,
      enum: Object.values(NotificationStatus),
      default: NotificationStatus.UNREAD
    },
    metadata: {
      type: Schema.Types.Mixed
    },
    readAt: Date,
    archivedAt: Date
  },
  {
    timestamps: true
  }
);

// 实例方法
notificationSchema.methods.markAsRead = async function(): Promise<void> {
  if (this.status === NotificationStatus.UNREAD) {
    this.status = NotificationStatus.READ;
    this.readAt = new Date();
    await this.save();
  }
};

notificationSchema.methods.archive = async function(): Promise<void> {
  if (this.status !== NotificationStatus.ARCHIVED) {
    this.status = NotificationStatus.ARCHIVED;
    this.archivedAt = new Date();
    await this.save();
  }
};

// 静态方法
notificationSchema.statics.getUnreadCount = async function(userId: mongoose.Types.ObjectId): Promise<number> {
  return this.countDocuments({
    userId,
    status: NotificationStatus.UNREAD
  });
};

notificationSchema.statics.getStats = async function(userId: mongoose.Types.ObjectId) {
  const stats = await this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: {
          $sum: { $cond: [{ $eq: ['$status', NotificationStatus.UNREAD] }, 1, 0] }
        },
        read: {
          $sum: { $cond: [{ $eq: ['$status', NotificationStatus.READ] }, 1, 0] }
        },
        archived: {
          $sum: { $cond: [{ $eq: ['$status', NotificationStatus.ARCHIVED] }, 1, 0] }
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
    byType: Object.values(NotificationType).reduce((acc, type) => ({ ...acc, [type]: 0 }), {}),
    byPriority: Object.values(NotificationPriority).reduce((acc, priority) => ({ ...acc, [priority]: 0 }), {})
  };
};

// 创建索引
notificationSchema.index({ userId: 1, status: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });

export const Notification = mongoose.model<INotificationDocument, INotificationModel>('Notification', notificationSchema); 