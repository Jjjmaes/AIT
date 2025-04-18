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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translationQueueService = void 0;
const translation_queue_service_1 = require("./translation-queue.service");
// 创建翻译队列服务实例，默认配置
exports.translationQueueService = new translation_queue_service_1.TranslationQueueService({
    processInterval: 1000, // 处理间隔1秒
    maxConcurrent: 5, // 最大并发任务数
    maxRetries: 3, // 最大重试次数
    retryDelay: 5000, // 重试延迟5秒
    timeout: 60000, // 任务超时时间60秒
    priorityLevels: 5, // 优先级级别数量
    enablePersistence: true, // 启用任务持久化
    persistencePath: './data/queue' // 任务持久化路径
});
// 导出队列相关类型和接口
__exportStar(require("./queue-task.interface"), exports);
__exportStar(require("./queue-config.interface"), exports);
