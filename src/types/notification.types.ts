import { Types } from 'mongoose';

export enum NotificationType {
  REVIEW_REQUEST = 'review_request',
  REVIEW_COMPLETE = 'review_complete',
  ISSUE_CREATED = 'issue_created',
  ISSUE_RESOLVED = 'issue_resolved',
  PROJECT_ASSIGNED = 'project_assigned',
  FILE_COMPLETE = 'file_complete',
  SYSTEM = 'system'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
  ARCHIVED = 'archived'
}

export interface INotification {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  content: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  metadata?: {
    projectId?: Types.ObjectId;
    fileId?: Types.ObjectId;
    segmentId?: Types.ObjectId;
    issueId?: Types.ObjectId;
    [key: string]: any;
  };
  createdAt: Date;
  readAt?: Date;
  archivedAt?: Date;
}

export interface INotificationStats {
  total: number;
  unread: number;
  read: number;
  archived: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
} 