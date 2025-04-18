"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueTaskStatus = exports.QueueTaskType = void 0;
var QueueTaskType;
(function (QueueTaskType) {
    /** 文本翻译任务 */
    QueueTaskType["TRANSLATION"] = "TRANSLATION";
    /** 批量翻译任务 */
    QueueTaskType["BATCH_TRANSLATION"] = "batch_translation";
    /** 文件翻译任务 */
    QueueTaskType["FILE_TRANSLATION"] = "file_translation";
    /** 翻译质量评估任务 */
    QueueTaskType["QUALITY_ASSESSMENT"] = "quality_assessment";
    /** 审校任务 */
    QueueTaskType["REVIEW"] = "REVIEW";
    /** 术语提取任务 */
    QueueTaskType["TERMINOLOGY_EXTRACTION"] = "terminology_extraction";
    /** 翻译记忆库更新任务 */
    QueueTaskType["TM_UPDATE"] = "tm_update";
    /** 翻译进度更新任务 */
    QueueTaskType["PROGRESS_UPDATE"] = "progress_update";
    /** 翻译统计更新任务 */
    QueueTaskType["STATS_UPDATE"] = "stats_update";
    /** 翻译缓存清理任务 */
    QueueTaskType["CACHE_CLEANUP"] = "cache_cleanup";
    /** 翻译错误处理任务 */
    QueueTaskType["ERROR_HANDLING"] = "error_handling";
    /** 翻译性能监控任务 */
    QueueTaskType["PERFORMANCE_MONITORING"] = "performance_monitoring";
    /** 翻译成本计算任务 */
    QueueTaskType["COST_CALCULATION"] = "cost_calculation";
    /** 翻译报告生成任务 */
    QueueTaskType["REPORT_GENERATION"] = "report_generation";
    /** 翻译配置更新任务 */
    QueueTaskType["CONFIG_UPDATE"] = "config_update";
    /** 翻译模型更新任务 */
    QueueTaskType["MODEL_UPDATE"] = "model_update";
    /** 翻译验证任务 */
    QueueTaskType["VALIDATION"] = "VALIDATION";
    /** 翻译质量检查任务 */
    QueueTaskType["QUALITY_CHECK"] = "QUALITY_CHECK";
})(QueueTaskType || (exports.QueueTaskType = QueueTaskType = {}));
var QueueTaskStatus;
(function (QueueTaskStatus) {
    QueueTaskStatus["PENDING"] = "PENDING";
    QueueTaskStatus["PROCESSING"] = "PROCESSING";
    QueueTaskStatus["COMPLETED"] = "COMPLETED";
    QueueTaskStatus["FAILED"] = "FAILED";
    QueueTaskStatus["CANCELLED"] = "CANCELLED";
    QueueTaskStatus["RETRYING"] = "retrying";
    QueueTaskStatus["TIMEOUT"] = "timeout";
})(QueueTaskStatus || (exports.QueueTaskStatus = QueueTaskStatus = {}));
