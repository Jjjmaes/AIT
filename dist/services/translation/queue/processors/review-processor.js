"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewTaskProcessor = void 0;
const logger_1 = __importDefault(require("../../../../utils/logger"));
const ai_review_service_1 = __importDefault(require("../../../../services/ai-review.service"));
const segment_model_1 = require("../../../../models/segment.model");
const ai_service_types_1 = require("../../../../types/ai-service.types");
const mongoose_1 = __importDefault(require("mongoose"));
const file_model_1 = require("../../../../models/file.model");
/**
 * 审校任务处理器
 * 负责处理队列中的审校任务
 */
class ReviewTaskProcessor {
    constructor() {
        // 处理任务时的默认批量大小
        this.DEFAULT_BATCH_SIZE = 10;
        // 默认并发数
        this.DEFAULT_CONCURRENT_LIMIT = 5;
        // 最大重试次数
        this.MAX_RETRIES = 3;
    }
    /**
     * 处理队列中的审校任务
     */
    async process(task) {
        logger_1.default.info(`Processing review task: ${task.id}`, {
            taskId: task.id,
            taskType: task.type,
            dataType: task.data.taskType
        });
        const startTime = Date.now();
        try {
            let result;
            switch (task.data.taskType) {
                case 'segmentReview':
                    result = await this.processSegmentReview(task);
                    break;
                case 'batchSegmentReview':
                    result = await this.processBatchSegmentReview(task);
                    break;
                case 'fileReview':
                    result = await this.processFileReview(task);
                    break;
                case 'textReview':
                    result = await this.processTextReview(task);
                    break;
                default:
                    throw new Error(`Unsupported review task type: ${task.data.taskType}`);
            }
            const duration = Date.now() - startTime;
            logger_1.default.info(`Review task ${task.id} processed successfully in ${duration}ms`, {
                taskId: task.id,
                duration,
                result: typeof result === 'object' ? '(object)' : result
            });
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            logger_1.default.error(`Review task processing failed: ${task.id} after ${duration}ms`, {
                taskId: task.id,
                error: error.message,
                stack: error.stack,
                duration
            });
            // 重新抛出错误，让队列系统处理重试逻辑
            throw error;
        }
        finally {
            logger_1.default.debug(`Review task ${task.id} processing completed in ${Date.now() - startTime}ms`);
        }
    }
    /**
     * 处理段落审校任务
     */
    async processSegmentReview(task) {
        const { segmentId, options } = task.data;
        const reviewOptions = options || {
            sourceLanguage: '',
            targetLanguage: ''
        };
        // 输入验证
        if (!segmentId || !mongoose_1.default.isValidObjectId(segmentId)) {
            throw new Error(`Invalid segment ID: ${segmentId}`);
        }
        logger_1.default.debug(`Starting review for segment: ${segmentId}`, { segmentId, options: reviewOptions });
        // 查找段落
        const segment = await segment_model_1.Segment.findById(segmentId).exec();
        if (!segment) {
            logger_1.default.error(`Review Task: Segment ${segmentId} not found.`);
            throw new Error(`Segment ${segmentId} not found`);
        }
        // 确保段落状态正确
        if (this.isInvalidSegmentStatus(segment.status)) {
            throw new Error(`Invalid segment status for review: ${segment.status}`);
        }
        // 确保段落有内容和翻译
        if (!segment.sourceText) {
            logger_1.default.error(`Review Task: Segment ${segmentId} has no source text.`);
            throw new Error(`Segment ${segmentId} has no source text`);
        }
        if (!segment.translation) {
            throw new Error(`Segment ${segmentId} has no translation to review`);
        }
        // 更新段落状态为审校中
        const previousStatus = segment.status;
        segment.status = segment_model_1.SegmentStatus.REVIEW_IN_PROGRESS;
        await segment.save();
        try {
            // 执行AI审校
            logger_1.default.info(`Starting AI review for segment ${segmentId} using model ${reviewOptions.model || 'default'}`);
            const reviewResult = await ai_review_service_1.default.reviewTranslation(segment.sourceText, segment.translation || '', {
                sourceLanguage: reviewOptions.sourceLanguage || '',
                targetLanguage: reviewOptions.targetLanguage || '',
                model: reviewOptions.model,
                provider: (reviewOptions.provider || getProviderFromString(reviewOptions.aiProvider)) || ai_service_types_1.AIProvider.OPENAI,
                customPrompt: reviewOptions.customPrompt,
                contextSegments: reviewOptions.contextSegments
            });
            // 保存审校结果
            await this.saveReviewResult(segment, reviewResult);
            logger_1.default.info(`AI review completed for segment ${segmentId}`);
            return {
                segmentId: segment._id,
                status: segment.status,
                issuesCount: segment.issues?.length || 0
            };
        }
        catch (error) {
            // 发生错误时更新段落状态
            segment.status = segment_model_1.SegmentStatus.REVIEW_FAILED;
            segment.error = error.message;
            await segment.save();
            logger_1.default.error(`Error reviewing segment ${segmentId}: ${error.message}`, {
                segmentId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    /**
     * 处理批量段落审校任务
     */
    async processBatchSegmentReview(task) {
        const { segmentIds, options } = task.data;
        const reviewOptions = options || {
            sourceLanguage: '',
            targetLanguage: ''
        };
        // 批量大小和并发限制
        const batchSize = reviewOptions.batchSize || this.DEFAULT_BATCH_SIZE;
        const concurrentLimit = reviewOptions.concurrentLimit || this.DEFAULT_CONCURRENT_LIMIT;
        const stopOnError = reviewOptions.stopOnError === true;
        if (!Array.isArray(segmentIds) || segmentIds.length === 0) {
            throw new Error('No segment IDs provided for batch review');
        }
        logger_1.default.info(`Starting batch review for ${segmentIds.length} segments`, {
            segmentCount: segmentIds.length,
            batchSize,
            concurrentLimit
        });
        // 结果和错误收集
        const results = [];
        const errors = [];
        // 分批处理
        for (let i = 0; i < segmentIds.length; i += batchSize) {
            const batch = segmentIds.slice(i, i + batchSize);
            logger_1.default.debug(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(segmentIds.length / batchSize)}`);
            try {
                // 创建批次内的并发任务
                const batchPromises = batch.map(segmentId => {
                    return this.processSegmentReviewWithRetry({
                        ...task,
                        data: {
                            segmentId,
                            options: reviewOptions,
                            taskType: 'segmentReview'
                        }
                    }).catch(error => {
                        if (stopOnError) {
                            throw error;
                        }
                        errors.push({ segmentId, error: error.message });
                        return null;
                    });
                });
                // 限制并发执行
                const batchResults = await this.executeConcurrently(batchPromises, concurrentLimit);
                results.push(...batchResults.filter(Boolean));
            }
            catch (error) {
                if (stopOnError) {
                    logger_1.default.error(`Stopping batch processing due to error: ${error.message}`);
                    throw error;
                }
            }
        }
        logger_1.default.info(`Batch review completed: ${results.length} succeeded, ${errors.length} failed`);
        return {
            totalSegments: segmentIds.length,
            successCount: results.length,
            errorCount: errors.length,
            results,
            errors: errors.length > 0 ? errors : undefined
        };
    }
    /**
     * 处理文件审校任务
     */
    async processFileReview(task) {
        const { fileId, options } = task.data;
        const reviewOptions = options || {
            sourceLanguage: '',
            targetLanguage: ''
        };
        if (!fileId || !mongoose_1.default.isValidObjectId(fileId)) {
            throw new Error(`Invalid file ID: ${fileId}`);
        }
        logger_1.default.info(`Starting review for file: ${fileId}`);
        // 获取文件信息
        const file = await file_model_1.File.findById(fileId);
        if (!file) {
            throw new Error(`File not found: ${fileId}`);
        }
        // 更新文件状态
        const previousStatus = file.status;
        file.status = file_model_1.FileStatus.REVIEWING;
        await file.save();
        try {
            // 获取文件中的所有段落
            const query = { fileId };
            // 添加状态过滤
            if (reviewOptions.includeStatuses && reviewOptions.includeStatuses.length > 0) {
                query.status = { $in: reviewOptions.includeStatuses };
            }
            else if (reviewOptions.excludeStatuses && reviewOptions.excludeStatuses.length > 0) {
                query.status = { $nin: reviewOptions.excludeStatuses };
            }
            else if (reviewOptions.onlyNew) {
                // 如果只审校新的段落，排除已经审校过的段落
                query.status = {
                    $nin: [
                        segment_model_1.SegmentStatus.REVIEW_COMPLETED,
                        segment_model_1.SegmentStatus.REVIEW_FAILED,
                        segment_model_1.SegmentStatus.COMPLETED
                    ]
                };
            }
            // 只审校有翻译的段落
            query.translation = { $exists: true, $ne: "" };
            const segments = await segment_model_1.Segment.find(query).select('_id');
            if (segments.length === 0) {
                logger_1.default.warn(`No segments found to review in file: ${fileId}`);
                file.status = previousStatus;
                await file.save();
                return { message: 'No segments to review', fileId };
            }
            logger_1.default.info(`Found ${segments.length} segments to review in file: ${fileId}`);
            // 创建批量审校任务
            const batchTask = {
                ...task,
                data: {
                    taskType: 'batchSegmentReview',
                    segmentIds: segments.map(s => s._id.toString()),
                    options: reviewOptions
                }
            };
            // 处理批量审校
            const result = await this.processBatchSegmentReview(batchTask);
            // 更新文件状态
            file.status = file_model_1.FileStatus.COMPLETED;
            await file.save();
            return {
                fileId,
                fileName: file.fileName,
                totalSegments: segments.length,
                reviewedSegments: result.successCount,
                failedSegments: result.errorCount,
                status: file.status
            };
        }
        catch (error) {
            // 更新文件状态为失败
            file.status = file_model_1.FileStatus.ERROR;
            await file.save();
            logger_1.default.error(`Error reviewing file ${fileId}: ${error.message}`, {
                fileId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    /**
     * 处理直接文本审校任务
     */
    async processTextReview(task) {
        const { originalText, translatedText, options } = task.data;
        const reviewOptions = options || {
            sourceLanguage: 'auto',
            targetLanguage: 'auto'
        };
        // 输入验证
        if (!originalText || typeof originalText !== 'string') {
            throw new Error('Original text is required');
        }
        if (!translatedText || typeof translatedText !== 'string') {
            throw new Error('Translated text is required');
        }
        try {
            // 执行AI审校
            logger_1.default.info(`Starting direct text AI review using model ${reviewOptions.model || 'default'}`);
            const reviewResult = await ai_review_service_1.default.reviewTranslation(originalText, translatedText, {
                sourceLanguage: reviewOptions.sourceLanguage || 'auto',
                targetLanguage: reviewOptions.targetLanguage || 'auto',
                model: reviewOptions.model,
                provider: (reviewOptions.provider || getProviderFromString(reviewOptions.aiProvider)) || ai_service_types_1.AIProvider.OPENAI,
                customPrompt: reviewOptions.customPrompt,
                contextSegments: reviewOptions.contextSegments
            });
            // 统计和分析
            const issueCount = reviewResult.issues.length;
            const overallScore = this.getOverallScore(reviewResult.scores);
            const modificationDegree = reviewResult.metadata.modificationDegree;
            logger_1.default.info(`Direct text AI review completed successfully`, {
                issueCount,
                overallScore,
                modificationDegree
            });
            return {
                ...reviewResult,
                statistics: {
                    originalLength: originalText.length,
                    translatedLength: translatedText.length,
                    suggestedLength: reviewResult.suggestedTranslation.length,
                    issueCount,
                    overallScore,
                    modificationDegree
                }
            };
        }
        catch (error) {
            logger_1.default.error(`Direct text AI review failed: ${error.message}`, {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    /**
     * 保存审校结果到段落
     */
    async saveReviewResult(segment, reviewResult) {
        // 保存建议的翻译到 segment.review
        segment.review = reviewResult.suggestedTranslation;
        // 保存评分 as issues
        const scores = reviewResult.scores || [];
        const issuesFromScores = scores.map((score) => ({
            type: segment_model_1.IssueType.OTHER, // Represent score as a generic issue type
            // Add severity based on score
            severity: this.mapScoreToSeverity(score.score),
            description: `AI Score (${score.type}): ${score.score}/100. ${score.details || ''}`,
            status: segment_model_1.IssueStatus.OPEN,
            createdAt: new Date(),
            // createdBy: ?? // Needs user context if available
        }));
        // Save AI-detected issues
        const issuesFromAI = (reviewResult.issues || []).map((issueData) => ({
            type: issueData.type || segment_model_1.IssueType.OTHER,
            // Add severity if missing, default to MEDIUM
            severity: issueData.severity || segment_model_1.IssueSeverity.MEDIUM,
            description: issueData.description,
            position: issueData.position,
            suggestion: issueData.suggestion,
            status: segment_model_1.IssueStatus.OPEN, // Default status
            createdAt: new Date(),
            // createdBy: ?? // Needs user context if available
        }));
        // Combine issues
        segment.issues = [...(segment.issues || []), ...issuesFromAI, ...issuesFromScores];
        segment.markModified('issues'); // Ensure array modification is saved
        // Update review metadata (no scores field here)
        segment.reviewMetadata = {
            ...(segment.reviewMetadata || {}), // Preserve existing metadata if any
            aiModel: reviewResult.metadata?.model,
            // promptTemplateId: ??? // Needs context
            tokenCount: (reviewResult.metadata?.tokens?.input ?? 0) + (reviewResult.metadata?.tokens?.output ?? 0),
            processingTime: reviewResult.metadata?.processingTime,
            modificationDegree: reviewResult.metadata?.modificationDegree
        };
        segment.markModified('reviewMetadata');
        // 更新段落状态
        segment.status = segment_model_1.SegmentStatus.REVIEW_PENDING; // Status indicates AI review done, pending human
        await segment.save();
    }
    /**
     * 判断段落状态是否不适合审校
     */
    isInvalidSegmentStatus(status) {
        const validStatuses = [
            segment_model_1.SegmentStatus.TRANSLATED,
            segment_model_1.SegmentStatus.REVIEW_PENDING,
            segment_model_1.SegmentStatus.REVIEW_FAILED
        ];
        return !validStatuses.includes(status);
    }
    /**
     * 从评分中获取总体评分
     */
    getOverallScore(scores) {
        const overallScore = scores.find(s => s.type === 'overall');
        return overallScore ? overallScore.score : this.calculateAverageScore(scores);
    }
    /**
     * 计算平均评分
     */
    calculateAverageScore(scores) {
        if (!scores || scores.length === 0)
            return 0;
        const sum = scores.reduce((total, score) => total + score.score, 0);
        return Math.round(sum / scores.length);
    }
    /**
     * 带重试功能的段落审校处理
     */
    async processSegmentReviewWithRetry(task, retries = 0) {
        try {
            return await this.processSegmentReview(task);
        }
        catch (error) {
            if (retries < this.MAX_RETRIES) {
                // 指数退避策略
                const delayMs = Math.pow(2, retries) * 1000;
                logger_1.default.warn(`Retrying segment review after ${delayMs}ms (attempt ${retries + 1}/${this.MAX_RETRIES})`, {
                    segmentId: task.data.segmentId,
                    error: error.message
                });
                await new Promise(resolve => setTimeout(resolve, delayMs));
                return this.processSegmentReviewWithRetry(task, retries + 1);
            }
            throw error;
        }
    }
    /**
     * 控制并发执行promises
     */
    async executeConcurrently(promises, limit) {
        const results = [];
        const executing = [];
        for (const promise of promises) {
            const p = Promise.resolve(promise).then(result => {
                results.push(result);
                executing.splice(executing.indexOf(p), 1);
            });
            executing.push(p);
            if (executing.length >= limit) {
                await Promise.race(executing);
            }
        }
        await Promise.all(executing);
        return results;
    }
    /**
     * 将评分映射为问题严重性
     */
    mapScoreToSeverity(score) {
        if (score >= 90)
            return segment_model_1.IssueSeverity.HIGH;
        if (score >= 70)
            return segment_model_1.IssueSeverity.MEDIUM;
        if (score >= 50)
            return segment_model_1.IssueSeverity.LOW;
        return segment_model_1.IssueSeverity.LOW;
    }
}
exports.ReviewTaskProcessor = ReviewTaskProcessor;
/**
 * 将字符串转换为AIProvider枚举
 */
function getProviderFromString(provider) {
    if (!provider)
        return undefined;
    switch (provider.toLowerCase()) {
        case 'openai':
            return ai_service_types_1.AIProvider.OPENAI;
        case 'grok':
            return ai_service_types_1.AIProvider.GROK;
        case 'deepseek':
            return ai_service_types_1.AIProvider.DEEPSEEK;
        default:
            return undefined;
    }
}
