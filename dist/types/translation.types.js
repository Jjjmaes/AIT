"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationEventType = exports.TranslationStatus = void 0;
// 翻译状态枚举
var TranslationStatus;
(function (TranslationStatus) {
    TranslationStatus["PENDING"] = "PENDING";
    TranslationStatus["PROCESSING"] = "PROCESSING";
    TranslationStatus["COMPLETED"] = "COMPLETED";
    TranslationStatus["FAILED"] = "FAILED";
    TranslationStatus["CANCELLED"] = "CANCELLED";
})(TranslationStatus || (exports.TranslationStatus = TranslationStatus = {}));
// 翻译事件
var TranslationEventType;
(function (TranslationEventType) {
    TranslationEventType["TASK_CREATED"] = "TASK_CREATED";
    TranslationEventType["TASK_STARTED"] = "TASK_STARTED";
    TranslationEventType["TASK_COMPLETED"] = "TASK_COMPLETED";
    TranslationEventType["TASK_FAILED"] = "TASK_FAILED";
    TranslationEventType["TASK_CANCELLED"] = "TASK_CANCELLED";
    TranslationEventType["PROGRESS_UPDATED"] = "PROGRESS_UPDATED";
})(TranslationEventType || (exports.TranslationEventType = TranslationEventType = {}));
