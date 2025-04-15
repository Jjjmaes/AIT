"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestSegmentReview = requestSegmentReview;
exports.completeSegmentReview = completeSegmentReview;
exports.getSegmentReviewResult = getSegmentReviewResult;
exports.finalizeSegmentReview = finalizeSegmentReview;
exports.addSegmentIssue = addSegmentIssue;
exports.resolveSegmentIssue = resolveSegmentIssue;
exports.batchUpdateSegmentStatus = batchUpdateSegmentStatus;
exports.reviewTextDirectly = reviewTextDirectly;
exports.getSupportedReviewModels = getSupportedReviewModels;
exports.queueSegmentReview = queueSegmentReview;
exports.queueTextReview = queueTextReview;
exports.queueBatchSegmentReview = queueBatchSegmentReview;
exports.queueFileReview = queueFileReview;
exports.getReviewTaskStatus = getReviewTaskStatus;
exports.cancelReviewTask = cancelReviewTask;
exports.getReviewableSegments = getReviewableSegments;
exports.finalizeFileReview = finalizeFileReview;
const segment_model_1 = require("../models/segment.model");
const review_service_1 = require("../services/review.service");
const ai_review_service_1 = __importDefault(require("../services/ai-review.service"));
const errors_1 = require("../utils/errors");
const queue_task_interface_1 = require("../services/translation/queue/queue-task.interface");
const translation_queue_service_1 = require("../services/translation/queue/translation-queue.service");
const ai_service_types_1 = require("../types/ai-service.types");
const logger_1 = __importDefault(require("../utils/logger"));
const segment_model_2 = require("../models/segment.model");
const mongoose_1 = require("mongoose");
// 自定义错误类
class BadRequestError extends errors_1.AppError {
    constructor(message = '请求参数错误') {
        super(message, 400);
    }
}
/**
 * 请求段落审校
 * POST /api/review/segment
 */
async function requestSegmentReview(req, res) {
    try {
        const { segmentId, options } = req.body;
        if (!segmentId) {
            res.status(400).json({ error: '缺少段落ID' });
            return;
        }
        const userId = req.user?.id;
        const userRoles = req.user?.role ? [req.user.role] : []; // Extract roles
        if (!userId) {
            throw new errors_1.UnauthorizedError('未授权的访问');
        }
        // 如果传递了直接审校的选项，则直接调用审校服务执行审校
        if (options?.immediate) {
            const reviewOptions = {
                promptTemplateId: options.promptTemplateId,
                aiModel: options.model || options.aiModel || 'gpt-3.5-turbo'
            };
            logger_1.default.info(`Starting immediate segment review for segment ${segmentId}`);
            const segment = await review_service_1.reviewService.startAIReview(segmentId, userId, userRoles, reviewOptions);
            res.status(200).json({
                success: true,
                message: '段落审校已完成',
                data: segment
            });
        }
        else {
            // 否则加入到队列中
            const queueService = new translation_queue_service_1.TranslationQueueService({
                processInterval: 1000,
                maxConcurrent: 5,
                maxRetries: 3,
                retryDelay: 5000,
                timeout: 60000,
                priorityLevels: 5
            });
            const taskId = await queueService.addTask({
                type: queue_task_interface_1.QueueTaskType.REVIEW,
                priority: options?.priority || 1,
                data: {
                    taskType: 'segmentReview',
                    segmentId,
                    userId,
                    options: {
                        sourceLanguage: options?.sourceLanguage,
                        targetLanguage: options?.targetLanguage,
                        model: options?.model || 'gpt-3.5-turbo',
                        aiProvider: options?.provider || options?.aiProvider || 'openai',
                        customPrompt: options?.customPrompt,
                        contextSegments: options?.contextSegments
                    }
                }
            });
            res.status(202).json({
                success: true,
                message: '段落审校任务已提交到队列',
                taskId
            });
        }
    }
    catch (error) {
        logger_1.default.error('请求段落审校失败', { error });
        if (error.name === 'NotFoundError') {
            res.status(404).json({ error: error.message });
        }
        else if (error.name === 'UnauthorizedError') {
            res.status(401).json({ error: error.message });
        }
        else if (error.name === 'BadRequestError') {
            res.status(400).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error.message || '请求段落审校失败' });
        }
    }
}
/**
 * 完成段落审校
 * POST /api/review/segment/complete
 */
async function completeSegmentReview(req, res) {
    try {
        const { segmentId, finalTranslation, acceptedChanges, modificationDegree } = req.body;
        if (!segmentId || !finalTranslation) {
            res.status(400).json({ error: '缺少必要参数' });
            return;
        }
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.UnauthorizedError('未授权的访问');
        }
        const reviewData = {
            finalTranslation,
            acceptedChanges,
            modificationDegree
        };
        logger_1.default.info(`Completing segment review for segment ${segmentId}`);
        const segment = await review_service_1.reviewService.completeSegmentReview(segmentId, userId, reviewData);
        res.status(200).json({
            success: true,
            message: '段落审校已完成',
            data: segment
        });
    }
    catch (error) {
        logger_1.default.error('完成段落审校失败', { error });
        if (error.name === 'NotFoundError') {
            res.status(404).json({ error: error.message });
        }
        else if (error.name === 'UnauthorizedError') {
            res.status(401).json({ error: error.message });
        }
        else if (error.name === 'BadRequestError') {
            res.status(400).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error.message || '完成段落审校失败' });
        }
    }
}
/**
 * 获取段落审校结果
 * GET /api/review/segment/:segmentId
 */
async function getSegmentReviewResult(req, res) {
    try {
        const { segmentId } = req.params;
        if (!segmentId) {
            res.status(400).json({ error: '缺少段落ID' });
            return;
        }
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.UnauthorizedError('未授权的访问');
        }
        logger_1.default.info(`Getting segment review result for segment ${segmentId}`);
        const result = await review_service_1.reviewService.getSegmentReviewResult(segmentId, userId);
        res.status(200).json({
            success: true,
            data: result
        });
    }
    catch (error) {
        logger_1.default.error('获取段落审校结果失败', { error });
        if (error.name === 'NotFoundError') {
            res.status(404).json({ error: error.message });
        }
        else if (error.name === 'UnauthorizedError') {
            res.status(401).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error.message || '获取段落审校结果失败' });
        }
    }
}
/**
 * 确认段落审校
 * POST /api/review/segment/:segmentId/finalize
 */
async function finalizeSegmentReview(req, res, next) {
    try {
        const { segmentId } = req.params;
        if (!segmentId) {
            // Use next for consistency if preferred
            res.status(400).json({ error: '缺少段落ID' });
            return;
        }
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.UnauthorizedError('未授权的访问');
        }
        logger_1.default.info(`Finalizing segment review for segment ${segmentId}`);
        const segment = await review_service_1.reviewService.finalizeSegmentReview(segmentId, userId);
        res.status(200).json({
            success: true,
            message: '段落审校已确认',
            data: segment
        });
    }
    catch (error) {
        logger_1.default.error('确认段落审校失败', { error });
        next(error); // Pass to error handler
    }
}
/**
 * 添加段落问题
 * POST /api/review/segment/issue
 */
async function addSegmentIssue(req, res) {
    try {
        const { segmentId, type, description, position, suggestion, severity } = req.body;
        if (!segmentId || !type || !description || !severity) {
            res.status(400).json({ error: '缺少必要参数 (segmentId, type, description, severity)' });
            return;
        }
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.UnauthorizedError('未授权的访问');
        }
        const issueData = {
            type,
            description,
            position,
            suggestion,
            severity: severity,
            status: segment_model_2.IssueStatus.OPEN,
            createdBy: new mongoose_1.Types.ObjectId(userId),
            createdAt: new Date()
        };
        logger_1.default.info(`Adding issue to segment ${segmentId}`);
        const issue = await review_service_1.reviewService.addSegmentIssue(segmentId, userId, issueData);
        res.status(200).json({
            success: true,
            message: '问题已添加',
            data: issue
        });
    }
    catch (error) {
        logger_1.default.error('添加段落问题失败', { error });
        if (error.name === 'NotFoundError') {
            res.status(404).json({ error: error.message });
        }
        else if (error.name === 'UnauthorizedError') {
            res.status(401).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error.message || '添加段落问题失败' });
        }
    }
}
/**
 * 解决段落问题
 * PUT /api/review/segment/issue/:issueId/resolve
 */
async function resolveSegmentIssue(req, res) {
    try {
        const { segmentId, issueId } = req.params;
        const { resolution } = req.body;
        if (!segmentId || !issueId || !resolution) {
            res.status(400).json({ error: '缺少必要参数 (segmentId, issueId, resolution)' });
            return;
        }
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.UnauthorizedError('未授权的访问');
        }
        const issueIndex = parseInt(issueId, 10);
        if (isNaN(issueIndex)) {
            res.status(400).json({ error: '无效的 Issue ID (应为数字索引)' });
            return;
        }
        logger_1.default.info(`Resolving issue index ${issueIndex} for segment ${segmentId}`);
        const segment = await review_service_1.reviewService.resolveSegmentIssue(segmentId, issueIndex, userId, resolution);
        res.status(200).json({
            success: true,
            message: '问题已解决',
            data: segment
        });
    }
    catch (error) {
        logger_1.default.error('解决段落问题失败', { error });
        if (error.name === 'NotFoundError') {
            res.status(404).json({ error: error.message });
        }
        else if (error.name === 'UnauthorizedError') {
            res.status(401).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: error.message || '解决段落问题失败' });
        }
    }
}
/**
 * 批量更新段落状态
 * POST /api/review/segment/batch-status
 */
async function batchUpdateSegmentStatus(req, res, next) {
    const methodName = 'batchUpdateSegmentStatus';
    try {
        const { segmentIds, status } = req.body;
        if (!segmentIds || !Array.isArray(segmentIds) || segmentIds.length === 0 || !status) {
            return next(new BadRequestError('Missing required parameters (segmentIds, status)'));
        }
        if (!Object.values(segment_model_1.SegmentStatus).includes(status)) {
            return next(new BadRequestError(`Invalid segment status provided: ${status}`));
        }
        const userId = req.user?.id;
        if (!userId) {
            return next(new errors_1.UnauthorizedError('Authentication required'));
        }
        logger_1.default.info(`[${methodName}] Batch updating status for ${segmentIds.length} segments to ${status} by user ${userId}`);
        // Restore @ts-expect-error
        // @ts-expect-error // Linter fails to detect existing service method
        const result = await review_service_1.reviewService.batchUpdateSegmentStatus(segmentIds, userId, status);
        res.status(200).json({
            success: true,
            message: `Batch status update processed. ${result.modifiedCount} segment(s) updated.`,
            data: {
                requestedCount: segmentIds.length,
                updatedCount: result.modifiedCount,
            }
        });
    }
    catch (error) {
        logger_1.default.error(`Error in ${methodName}:`, { error });
        next(error);
    }
}
/**
 * 直接审校文本
 * POST /api/review/text
 */
async function reviewTextDirectly(req, res) {
    try {
        const { original, translation, sourceLanguage, targetLanguage, model, customPrompt } = req.body;
        if (!original || !translation) {
            res.status(400).json({ error: '缺少原文或译文' });
            return;
        }
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.UnauthorizedError('未授权的访问');
        }
        // 获取API密钥（在实际应用中应该有更安全的方式获取）
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('未配置API密钥');
        }
        // 使用AI审校服务直接审校文本
        logger_1.default.info('Starting direct text review');
        const reviewOptions = {
            sourceLanguage: sourceLanguage || 'en',
            targetLanguage: targetLanguage || 'zh-CN',
            model: model || 'gpt-3.5-turbo',
            provider: ai_service_types_1.AIProvider.OPENAI,
            apiKey,
            customPrompt: customPrompt
        };
        const result = await ai_review_service_1.default.reviewText(original, translation, reviewOptions);
        res.status(200).json({
            success: true,
            data: result
        });
    }
    catch (error) {
        logger_1.default.error('直接审校文本失败', { error });
        res.status(500).json({ error: error.message || '直接审校文本失败' });
    }
}
/**
 * 获取支持的审校模型
 * GET /api/review/models
 */
async function getSupportedReviewModels(req, res) {
    try {
        // 获取用户身份
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.UnauthorizedError('未授权的访问');
        }
        // 获取查询参数
        const provider = req.query.provider || 'openai';
        // 映射提供商字符串到枚举
        let aiProvider;
        switch (provider.toLowerCase()) {
            case 'openai':
                aiProvider = ai_service_types_1.AIProvider.OPENAI;
                break;
            case 'baidu':
                aiProvider = ai_service_types_1.AIProvider.BAIDU;
                break;
            case 'aliyun':
                aiProvider = ai_service_types_1.AIProvider.ALIYUN;
                break;
            default:
                aiProvider = ai_service_types_1.AIProvider.OPENAI;
        }
        // 使用AI审校服务获取支持的模型
        logger_1.default.info(`Getting supported models for provider: ${provider}`);
        const models = await ai_review_service_1.default.getSupportedModels(aiProvider);
        res.status(200).json({
            success: true,
            data: models
        });
    }
    catch (error) {
        logger_1.default.error('获取支持的审校模型失败', { error });
        res.status(500).json({ error: error.message || '获取支持的审校模型失败' });
    }
}
/**
 * 将段落提交到审校队列
 * POST /api/review/queue/segment
 */
async function queueSegmentReview(req, res) {
    try {
        const { segmentId, options } = req.body;
        if (!segmentId) {
            res.status(400).json({ error: '缺少段落ID' });
            return;
        }
        // Create an instance of the queue service for this request
        const queueService = new translation_queue_service_1.TranslationQueueService({
            processInterval: 1000,
            maxConcurrent: 5,
            maxRetries: 3,
            retryDelay: 5000,
            timeout: 60000,
            priorityLevels: 5
        });
        // 添加审校任务到队列
        const taskId = await queueService.addTask({
            type: queue_task_interface_1.QueueTaskType.REVIEW,
            priority: options?.priority || 1,
            data: {
                taskType: 'segmentReview',
                segmentId,
                options: {
                    sourceLanguage: options?.sourceLanguage,
                    targetLanguage: options?.targetLanguage,
                    model: options?.model || 'gpt-3.5-turbo',
                    aiProvider: options?.provider || options?.aiProvider || 'openai',
                    customPrompt: options?.customPrompt,
                    contextSegments: options?.contextSegments
                }
            }
        });
        res.status(202).json({
            message: '审校任务已提交到队列',
            taskId
        });
    }
    catch (error) {
        console.error('提交审校任务失败:', error);
        res.status(500).json({ error: error.message || '提交审校任务失败' });
    }
}
/**
 * 提交文本审校任务到队列
 * POST /api/review/queue/text
 */
async function queueTextReview(req, res) {
    try {
        const { originalText, translatedText, options } = req.body;
        if (!originalText || !translatedText) {
            res.status(400).json({ error: '原文和译文不能为空' });
            return;
        }
        // Create an instance of the queue service for this request
        const queueService = new translation_queue_service_1.TranslationQueueService({
            processInterval: 1000,
            maxConcurrent: 5,
            maxRetries: 3,
            retryDelay: 5000,
            timeout: 60000,
            priorityLevels: 5
        });
        // 添加文本审校任务到队列
        const taskId = await queueService.addTask({
            type: queue_task_interface_1.QueueTaskType.REVIEW,
            priority: options?.priority || 1,
            data: {
                taskType: 'textReview',
                originalText,
                translatedText,
                options: {
                    sourceLanguage: options?.sourceLanguage || 'auto',
                    targetLanguage: options?.targetLanguage || 'auto',
                    model: options?.model || 'gpt-3.5-turbo',
                    aiProvider: options?.provider || options?.aiProvider || 'openai',
                    customPrompt: options?.customPrompt
                }
            }
        });
        res.status(202).json({
            message: '文本审校任务已提交到队列',
            taskId
        });
    }
    catch (error) {
        console.error('提交文本审校任务失败:', error);
        res.status(500).json({ error: error.message || '提交文本审校任务失败' });
    }
}
/**
 * 提交批量段落审校任务到队列
 * POST /api/review/queue/batch
 */
async function queueBatchSegmentReview(req, res) {
    try {
        const { segmentIds, options } = req.body;
        if (!segmentIds || !Array.isArray(segmentIds) || segmentIds.length === 0) {
            res.status(400).json({ error: '缺少有效的段落ID列表' });
            return;
        }
        // Create an instance of the queue service for this request
        const queueService = new translation_queue_service_1.TranslationQueueService({
            processInterval: 1000,
            maxConcurrent: 5,
            maxRetries: 3,
            retryDelay: 5000,
            timeout: 60000,
            priorityLevels: 5
        });
        // 添加批量审校任务到队列
        const taskId = await queueService.addTask({
            type: queue_task_interface_1.QueueTaskType.REVIEW,
            priority: options?.priority || 1,
            data: {
                taskType: 'batchSegmentReview',
                segmentIds,
                options: {
                    sourceLanguage: options?.sourceLanguage,
                    targetLanguage: options?.targetLanguage,
                    model: options?.model || 'gpt-3.5-turbo',
                    aiProvider: options?.provider || options?.aiProvider || 'openai',
                    customPrompt: options?.customPrompt,
                    contextSegments: options?.contextSegments,
                    batchSize: options?.batchSize || 10,
                    concurrentLimit: options?.concurrentLimit || 5,
                    stopOnError: options?.stopOnError || false,
                    onlyNew: options?.onlyNew || false,
                    includeStatuses: options?.includeStatuses,
                    excludeStatuses: options?.excludeStatuses
                }
            }
        });
        res.status(202).json({
            message: `批量审校任务已提交到队列，共 ${segmentIds.length} 个段落`,
            taskId
        });
    }
    catch (error) {
        console.error('提交批量审校任务失败:', error);
        res.status(500).json({ error: error.message || '提交批量审校任务失败' });
    }
}
/**
 * 提交文件审校任务到队列
 * POST /api/review/queue/file
 */
async function queueFileReview(req, res) {
    try {
        const { fileId, options } = req.body;
        if (!fileId) {
            res.status(400).json({ error: '缺少文件ID' });
            return;
        }
        // Create an instance of the queue service for this request
        const queueService = new translation_queue_service_1.TranslationQueueService({
            processInterval: 1000,
            maxConcurrent: 5,
            maxRetries: 3,
            retryDelay: 5000,
            timeout: 60000,
            priorityLevels: 5
        });
        // 添加文件审校任务到队列
        const taskId = await queueService.addTask({
            type: queue_task_interface_1.QueueTaskType.REVIEW,
            priority: options?.priority || 1,
            data: {
                taskType: 'fileReview',
                fileId,
                options: {
                    sourceLanguage: options?.sourceLanguage,
                    targetLanguage: options?.targetLanguage,
                    model: options?.model || 'gpt-3.5-turbo',
                    aiProvider: options?.provider || options?.aiProvider || 'openai',
                    customPrompt: options?.customPrompt,
                    onlyNew: options?.onlyNew || true,
                    includeStatuses: options?.includeStatuses,
                    excludeStatuses: options?.excludeStatuses,
                    batchSize: options?.batchSize || 10,
                    concurrentLimit: options?.concurrentLimit || 5,
                    stopOnError: options?.stopOnError || false
                }
            }
        });
        res.status(202).json({
            message: '文件审校任务已提交到队列',
            taskId,
            fileId
        });
    }
    catch (error) {
        console.error('提交文件审校任务失败:', error);
        res.status(500).json({ error: error.message || '提交文件审校任务失败' });
    }
}
/**
 * 获取队列任务状态
 * GET /api/review/queue/status/:taskId
 */
async function getReviewTaskStatus(req, res) {
    try {
        const { taskId } = req.params;
        if (!taskId) {
            res.status(400).json({ error: '缺少任务ID' });
            return;
        }
        // Create an instance of the queue service for this request
        const queueService = new translation_queue_service_1.TranslationQueueService({
            processInterval: 1000,
            maxConcurrent: 5,
            maxRetries: 3,
            retryDelay: 5000,
            timeout: 60000,
            priorityLevels: 5
        });
        const task = await queueService.getTask(taskId);
        if (!task) {
            res.status(404).json({ error: '任务不存在' });
            return;
        }
        res.status(200).json({
            taskId: task.id,
            status: task.status,
            type: task.type,
            dataType: task.data.taskType,
            createdAt: task.createdAt,
            startedAt: task.startedAt,
            completedAt: task.completedAt,
            error: task.error,
            result: task.result
        });
    }
    catch (error) {
        console.error('获取任务状态失败:', error);
        res.status(500).json({ error: error.message || '获取任务状态失败' });
    }
}
/**
 * 取消队列任务
 * DELETE /api/review/queue/:taskId
 */
async function cancelReviewTask(req, res) {
    try {
        const { taskId } = req.params;
        if (!taskId) {
            res.status(400).json({ error: '缺少任务ID' });
            return;
        }
        // Create an instance of the queue service for this request
        const queueService = new translation_queue_service_1.TranslationQueueService({
            processInterval: 1000,
            maxConcurrent: 5,
            maxRetries: 3,
            retryDelay: 5000,
            timeout: 60000,
            priorityLevels: 5
        });
        await queueService.cancelTask(taskId);
        res.status(200).json({
            message: '任务已取消',
            taskId
        });
    }
    catch (error) {
        console.error('取消任务失败:', error);
        res.status(500).json({ error: error.message || '取消任务失败' });
    }
}
/**
 * 获取文件下待审校的段落列表 (支持分页)
 * GET /api/review/files/:fileId/segments
 */
async function getReviewableSegments(req, res, next) {
    const methodName = 'getReviewableSegments';
    try {
        const { fileId } = req.params;
        const userId = req.user?.id;
        if (!fileId) {
            return next(new BadRequestError('File ID is required in the URL path.'));
        }
        if (!userId) {
            return next(new errors_1.UnauthorizedError('Authentication required'));
        }
        // Extract and validate pagination parameters from query string
        const page = req.query.page ? parseInt(req.query.page, 10) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
        if (isNaN(page) || page < 1) {
            return next(new BadRequestError('Invalid page number provided.'));
        }
        if (isNaN(limit) || limit < 1 || limit > 100) { // Add max limit
            return next(new BadRequestError('Invalid limit provided (must be between 1 and 100).'));
        }
        const paginationOptions = { page, limit };
        logger_1.default.info(`[${methodName}] Fetching reviewable segments for file ${fileId}, page ${page}, limit ${limit} by user ${userId}`);
        // Restore @ts-expect-error
        // @ts-expect-error // Linter fails to detect existing service method
        const result_segments = await review_service_1.reviewService.getSegmentsForReview(fileId, userId, paginationOptions);
        res.status(200).json({
            success: true,
            message: 'Successfully retrieved reviewable segments',
            data: result_segments.segments,
            pagination: {
                total: result_segments.total,
                page: result_segments.page,
                limit: result_segments.limit,
                totalPages: Math.ceil(result_segments.total / result_segments.limit)
            }
        });
    }
    catch (error) {
        logger_1.default.error(`Error in ${methodName} for file ${req.params.fileId}:`, error);
        next(error); // Pass error to the central handler
    }
}
/**
 * 最终确认整个文件的审校 (Manager only)
 * POST /api/review/files/:fileId/finalize
 */
async function finalizeFileReview(req, res, next) {
    const methodName = 'finalizeFileReview';
    try {
        const { fileId } = req.params;
        const userId = req.user?.id;
        if (!fileId) {
            return next(new BadRequestError('File ID is required in the URL path.'));
        }
        if (!userId) {
            return next(new errors_1.UnauthorizedError('Authentication required'));
        }
        logger_1.default.info(`[${methodName}] User ${userId} attempting to finalize review for file ${fileId}`);
        // Assuming reviewService.finalizeFileReview exists and handles logic/errors
        const updatedFile = await review_service_1.reviewService.finalizeFileReview(fileId, userId);
        res.status(200).json({
            success: true,
            message: 'File review finalized successfully.',
            data: updatedFile // Return the updated file details
        });
    }
    catch (error) {
        logger_1.default.error(`Error in ${methodName} for file ${req.params.fileId}:`, error);
        next(error); // Pass error to the central handler
    }
}
