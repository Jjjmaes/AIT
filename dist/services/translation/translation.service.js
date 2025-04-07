"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationService = void 0;
const ai_service_factory_1 = require("./ai-adapters/ai-service.factory");
const translation_queue_service_1 = require("./queue/translation-queue.service");
const translation_cache_service_1 = require("./cache/translation-cache.service");
const queue_task_interface_1 = require("./queue/queue-task.interface");
const cache_keys_enum_1 = require("./cache/cache-keys.enum");
const logger_1 = __importDefault(require("../../utils/logger"));
const performance_monitor_1 = require("./monitoring/performance-monitor");
const promptProcessor_1 = require("../../utils/promptProcessor");
class TranslationService {
    constructor(config) {
        this.config = config;
        this.aiServiceFactory = ai_service_factory_1.AIServiceFactory.getInstance();
        // 初始化缓存服务
        if (config.enableCache && config.cacheConfig) {
            this.cacheService = new translation_cache_service_1.TranslationCacheService(config.cacheConfig);
        }
        // 初始化队列服务
        if (config.enableQueue && config.queueConfig) {
            this.queueService = new translation_queue_service_1.TranslationQueueService(config.queueConfig);
        }
        this.performanceMonitor = new performance_monitor_1.PerformanceMonitor(this.cacheService);
    }
    async translateText(sourceText, options) {
        const startTime = Date.now();
        try {
            // 检查缓存
            if (this.cacheService) {
                const cacheKey = this.generateCacheKey(sourceText, options);
                const cachedResult = await this.cacheService.get(cacheKey);
                if (cachedResult) {
                    await this.performanceMonitor.recordCacheAccess(true);
                    logger_1.default.info('Translation result retrieved from cache', {
                        provider: this.config.provider,
                        model: this.config.model
                    });
                    return cachedResult;
                }
                await this.performanceMonitor.recordCacheAccess(false);
            }
            // 如果启用了队列服务，将任务添加到队列
            if (this.queueService) {
                const taskId = await this.queueService.addTask({
                    type: queue_task_interface_1.QueueTaskType.TRANSLATION,
                    priority: 1,
                    data: {
                        text: sourceText,
                        options
                    },
                    metadata: {
                        provider: this.config.provider,
                        model: this.config.model
                    }
                });
                // 等待任务完成
                let taskStatus = await this.queueService.getTaskStatus(taskId);
                while (taskStatus === queue_task_interface_1.QueueTaskStatus.PENDING || taskStatus === queue_task_interface_1.QueueTaskStatus.PROCESSING) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    taskStatus = await this.queueService.getTaskStatus(taskId);
                }
                const task = await this.queueService.getTask(taskId);
                if (!task || task.status !== queue_task_interface_1.QueueTaskStatus.COMPLETED) {
                    throw new Error(task?.error || 'Translation task failed');
                }
                const result = task.result;
                // 缓存结果
                if (this.cacheService) {
                    const cacheKey = this.generateCacheKey(sourceText, options);
                    await this.cacheService.set(cacheKey, result);
                }
                await this.performanceMonitor.recordTaskCompletion(queue_task_interface_1.QueueTaskType.TRANSLATION, true, Date.now() - startTime);
                return result;
            }
            // 如果没有使用队列，直接执行翻译
            const adapter = this.aiServiceFactory.createAdapter(this.config);
            const response = await adapter.translateText(sourceText, options);
            // Construct AIServiceResponse
            const result = {
                translatedText: response.translatedText,
                metadata: {
                    provider: response.modelInfo.provider,
                    model: response.modelInfo.model,
                    processingTime: response.processingTime ?? 0,
                    tokens: {
                        input: response.tokenCount?.input ?? 0,
                        output: response.tokenCount?.output ?? 0,
                    },
                    confidence: 0.95,
                    wordCount: response.translatedText.split(/\s+/).filter(Boolean).length,
                    characterCount: response.translatedText.length
                }
            };
            // Cache the constructed result
            if (this.cacheService) {
                const cacheKey = this.generateCacheKey(sourceText, options);
                await this.cacheService.set(cacheKey, result);
            }
            // Log using constructed result
            logger_1.default.info('Translation completed', {
                provider: result.metadata.provider,
                model: result.metadata.model,
                sourceLength: sourceText.length,
                targetLength: result.translatedText.length,
                processingTime: result.metadata.processingTime
            });
            await this.performanceMonitor.recordRequest(true, Date.now() - startTime);
            return result;
        }
        catch (error) {
            await this.performanceMonitor.recordRequest(false, Date.now() - startTime);
            logger_1.default.error('Translation failed', {
                provider: this.config.provider,
                model: this.config.model,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async translateMultipleSegments(segments, options) {
        const startTime = Date.now();
        try {
            // 如果启用了队列服务，将任务添加到队列
            if (this.queueService) {
                const taskId = await this.queueService.addTask({
                    type: queue_task_interface_1.QueueTaskType.TRANSLATION,
                    priority: 1,
                    data: {
                        segments,
                        options
                    },
                    metadata: {
                        provider: this.config.provider,
                        model: this.config.model
                    }
                });
                // 等待任务完成
                let taskStatus = await this.queueService.getTaskStatus(taskId);
                while (taskStatus === queue_task_interface_1.QueueTaskStatus.PENDING || taskStatus === queue_task_interface_1.QueueTaskStatus.PROCESSING) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    taskStatus = await this.queueService.getTaskStatus(taskId);
                }
                const task = await this.queueService.getTask(taskId);
                if (!task || task.status !== queue_task_interface_1.QueueTaskStatus.COMPLETED) {
                    throw new Error(task?.error || 'Multiple segments translation task failed');
                }
                const resultsArray = task.result;
                // 组装结果为预期格式
                const translations = segments.map((text, index) => {
                    const result = resultsArray && Array.isArray(resultsArray) && index < resultsArray.length ?
                        resultsArray[index] : null;
                    return {
                        originalText: text,
                        translatedText: result?.translatedText || '',
                        metadata: result?.metadata || {}
                    };
                });
                const totalProcessingTime = resultsArray && Array.isArray(resultsArray) ?
                    resultsArray.reduce((sum, result) => sum + (result?.metadata?.processingTime || 0), 0) : 0;
                // 记录翻译结果
                logger_1.default.info('Multiple segments translation completed', {
                    provider: this.config.provider,
                    model: this.config.model,
                    segmentCount: segments.length,
                    totalProcessingTime
                });
                await this.performanceMonitor.recordTaskCompletion(queue_task_interface_1.QueueTaskType.TRANSLATION, true, Date.now() - startTime);
                return {
                    translations,
                    metadata: {
                        totalProcessingTime,
                        totalSegments: segments.length,
                        model: this.config.model,
                        provider: this.config.provider,
                        sourceLanguage: options.sourceLanguage,
                        targetLanguage: options.targetLanguage
                    }
                };
            }
            // 如果没有使用队列，直接执行翻译
            const adapter = this.aiServiceFactory.createAdapter(this.config);
            const translationPromises = segments.map(async (segment) => {
                const promptData = await promptProcessor_1.promptProcessor.buildTranslationPrompt(segment, {
                    sourceLanguage: options.sourceLanguage,
                    targetLanguage: options.targetLanguage,
                });
                return adapter.translateText(segment, promptData, options);
            });
            const resultsArray = await Promise.all(translationPromises);
            // Construct the final response structure with metadata
            const translations = segments.map((text, index) => {
                const response = resultsArray && Array.isArray(resultsArray) && index < resultsArray.length ?
                    resultsArray[index] : null;
                return {
                    originalText: text,
                    translatedText: response?.translatedText || '',
                    metadata: response ? {
                        provider: response.modelInfo.provider,
                        model: response.modelInfo.model,
                        processingTime: response.processingTime ?? 0,
                        tokens: {
                            input: response.tokenCount?.input ?? 0,
                            output: response.tokenCount?.output ?? 0,
                        },
                        confidence: 0.95,
                        wordCount: (response.translatedText || '').split(/\s+/).filter(Boolean).length,
                        characterCount: (response.translatedText || '').length
                    } : {}
                };
            });
            // Provide default for reduce initial value or check response?.processingTime validity
            const totalProcessingTime = resultsArray && Array.isArray(resultsArray) ?
                resultsArray.reduce((sum, response) => sum + (response?.processingTime ?? 0), 0) : 0;
            // Log using constructed result data
            logger_1.default.info('Multiple segments translation completed', {
                provider: this.config.provider,
                model: this.config.model,
                segmentCount: segments.length,
                totalProcessingTime
            });
            await this.performanceMonitor.recordRequest(true, Date.now() - startTime);
            return {
                translations,
                metadata: {
                    totalProcessingTime,
                    totalSegments: segments.length,
                    model: this.config.model,
                    provider: this.config.provider,
                    sourceLanguage: options.sourceLanguage,
                    targetLanguage: options.targetLanguage
                }
            };
        }
        catch (error) {
            await this.performanceMonitor.recordRequest(false, Date.now() - startTime);
            logger_1.default.error('Multiple segments translation failed', {
                provider: this.config.provider,
                model: this.config.model,
                segmentCount: segments.length,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async validateApiKey() {
        const startTime = Date.now();
        try {
            // 检查缓存
            if (this.cacheService) {
                const cacheKey = 'API_KEY_VALIDATION';
                const cachedResult = await this.cacheService.get(cacheKey);
                if (cachedResult !== null) {
                    await this.performanceMonitor.recordCacheAccess(true);
                    return cachedResult === true;
                }
                await this.performanceMonitor.recordCacheAccess(false);
            }
            const adapter = this.aiServiceFactory.createAdapter(this.config);
            const isValid = await adapter.validateApiKey();
            // 缓存结果
            if (this.cacheService) {
                const cacheKey = 'API_KEY_VALIDATION';
                await this.cacheService.set(cacheKey, isValid);
            }
            await this.performanceMonitor.recordRequest(true, Date.now() - startTime);
            return isValid === true;
        }
        catch (error) {
            await this.performanceMonitor.recordRequest(false, Date.now() - startTime);
            logger_1.default.error('API key validation failed', {
                provider: this.config.provider,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async getAvailableModels() {
        const startTime = Date.now();
        try {
            // 检查缓存
            if (this.cacheService) {
                const cacheKey = cache_keys_enum_1.CacheKey.MODEL_LIST;
                const cachedResult = await this.cacheService.get(cacheKey);
                if (cachedResult) {
                    await this.performanceMonitor.recordCacheAccess(true);
                    return cachedResult;
                }
                await this.performanceMonitor.recordCacheAccess(false);
            }
            const adapter = this.aiServiceFactory.createAdapter(this.config);
            const models = await adapter.getAvailableModels();
            const modelIds = models.map(model => model.id);
            // 缓存结果
            if (this.cacheService) {
                const cacheKey = cache_keys_enum_1.CacheKey.MODEL_LIST;
                await this.cacheService.set(cacheKey, modelIds);
            }
            await this.performanceMonitor.recordRequest(true, Date.now() - startTime);
            return modelIds;
        }
        catch (error) {
            await this.performanceMonitor.recordRequest(false, Date.now() - startTime);
            logger_1.default.error('Failed to get available models', {
                provider: this.config.provider,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    generateCacheKey(sourceText, options) {
        const keyParts = [
            cache_keys_enum_1.CacheKey.TRANSLATION_RESULT,
            this.config.provider,
            this.config.model,
            options.sourceLanguage,
            options.targetLanguage,
            sourceText
        ];
        return keyParts.join(':');
    }
    async shutdown() {
        if (this.queueService) {
            await this.queueService.shutdown();
        }
        if (this.cacheService) {
            await this.cacheService.shutdown();
        }
    }
    getPerformanceMetrics() {
        return this.performanceMonitor.getMetrics();
    }
    getTaskMetrics() {
        return this.performanceMonitor.getTaskMetrics();
    }
}
exports.TranslationService = TranslationService;
