"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationStatus = exports.NotificationPriority = exports.NotificationType = void 0;
var NotificationType;
(function (NotificationType) {
    NotificationType["REVIEW_REQUEST"] = "review_request";
    NotificationType["REVIEW_COMPLETE"] = "review_complete";
    NotificationType["ISSUE_CREATED"] = "issue_created";
    NotificationType["ISSUE_RESOLVED"] = "issue_resolved";
    NotificationType["PROJECT_ASSIGNED"] = "project_assigned";
    NotificationType["FILE_COMPLETE"] = "file_complete";
    NotificationType["SYSTEM"] = "system";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationPriority;
(function (NotificationPriority) {
    NotificationPriority["LOW"] = "low";
    NotificationPriority["MEDIUM"] = "medium";
    NotificationPriority["HIGH"] = "high";
})(NotificationPriority || (exports.NotificationPriority = NotificationPriority = {}));
var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["UNREAD"] = "unread";
    NotificationStatus["READ"] = "read";
    NotificationStatus["ARCHIVED"] = "archived";
})(NotificationStatus || (exports.NotificationStatus = NotificationStatus = {}));
