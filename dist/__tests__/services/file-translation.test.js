"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const file_translation_service_1 = require("../../services/translation/file-translation.service");
const translation_types_1 = require("../../types/translation.types");
const mongoose_1 = require("mongoose");
const ai_service_types_1 = require("../../types/ai-service.types");
const globals_1 = require("@jest/globals");
const translationQueue_service_1 = require("../../services/translationQueue.service");
// 模拟依赖
globals_1.jest.mock('../../services/translation/translation.service');
globals_1.jest.mock('../../utils/logger');
globals_1.jest.mock('../../services/translationQueue.service', () => ({
    translationQueueService: {
        addFileTranslationJob: globals_1.jest.fn(),
    }
}));
// Define userId
const userId = 'mock-user-id';
describe('FileTranslationService', () => {
    let mockTranslationService;
    let fileTranslationService;
    let mockQueueAddJob;
    const projectId = new mongoose_1.Types.ObjectId();
    const fileId = new mongoose_1.Types.ObjectId();
    const mockTranslationOptions = {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        preserveFormatting: true
    };
    const mockSegments = [
        'This is the first segment.',
        'This is the second segment.',
        'This is the third segment.'
    ];
    beforeEach(() => {
        globals_1.jest.clearAllMocks();
        mockTranslationService = {
            translateText: globals_1.jest.fn(),
            validateApiKey: globals_1.jest.fn(),
            getAvailableModels: globals_1.jest.fn(),
            getModelInfo: globals_1.jest.fn(),
            getModelPricing: globals_1.jest.fn(),
            translateMultipleSegments: globals_1.jest.fn(),
            validateAndNormalizeConfig: globals_1.jest.fn(),
            aiServiceFactory: {
                createAdapter: globals_1.jest.fn(),
                getInstance: globals_1.jest.fn(),
                removeAdapter: globals_1.jest.fn(),
                getAdapter: globals_1.jest.fn()
            },
            config: {},
            performanceMonitor: {
                recordRequest: globals_1.jest.fn(),
                recordCacheAccess: globals_1.jest.fn(),
                recordQueueMetrics: globals_1.jest.fn(),
                recordTaskCompletion: globals_1.jest.fn(),
                recordRetry: globals_1.jest.fn(),
                resetMetrics: globals_1.jest.fn(),
                getMetrics: globals_1.jest.fn(),
                getTaskMetrics: globals_1.jest.fn()
            }
        };
        fileTranslationService = new file_translation_service_1.FileTranslationService(mockTranslationService, fileId, projectId, mockTranslationOptions);
        mockQueueAddJob = translationQueue_service_1.translationQueueService.addFileTranslationJob;
    });
    describe('initialize', () => {
        it('应该正确初始化段落', async () => {
            const segments = ['First segment', 'Second segment'];
            await fileTranslationService.initialize(segments);
            const tasks = fileTranslationService.getTasks();
            expect(tasks).toHaveLength(2);
            expect(tasks[0].status).toBe(translation_types_1.TranslationStatus.PENDING);
            expect(tasks[1].status).toBe(translation_types_1.TranslationStatus.PENDING);
        });
    });
    describe('translate', () => {
        it('应该成功翻译所有段落', async () => {
            // 初始化段落
            await fileTranslationService.initialize(['First segment', 'Second segment']);
            // 设置翻译成功的 mock
            mockTranslationService.translateText
                .mockResolvedValueOnce({
                translatedText: 'First translated segment',
                metadata: {
                    provider: ai_service_types_1.AIProvider.OPENAI,
                    model: 'gpt-3.5-turbo',
                    processingTime: 100,
                    confidence: 0.95,
                    wordCount: 3,
                    characterCount: 20,
                    tokens: { input: 10, output: 15 }
                }
            })
                .mockResolvedValueOnce({
                translatedText: 'Second translated segment',
                metadata: {
                    provider: ai_service_types_1.AIProvider.OPENAI,
                    model: 'gpt-3.5-turbo',
                    processingTime: 100,
                    confidence: 0.95,
                    wordCount: 3,
                    characterCount: 20,
                    tokens: { input: 10, output: 15 }
                }
            });
            // 执行翻译
            await fileTranslationService.translate();
            // 验证任务状态
            const tasks = fileTranslationService.getTasks();
            expect(tasks[0].status).toBe(translation_types_1.TranslationStatus.COMPLETED);
            expect(tasks[1].status).toBe(translation_types_1.TranslationStatus.COMPLETED);
            // 验证进度
            const progress = fileTranslationService.getProgress();
            expect(progress.status).toBe(translation_types_1.TranslationStatus.COMPLETED);
            expect(progress.completedSegments).toBe(2);
        });
        it('应该处理翻译失败的情况', async () => {
            // 初始化段落
            await fileTranslationService.initialize(['First paragraph', 'Second paragraph']);
            // 设置翻译失败的 mock
            mockTranslationService.translateText
                .mockRejectedValueOnce(new Error('Translation failed'));
            // 执行翻译
            await fileTranslationService.translate();
            // 验证任务状态
            const tasks = fileTranslationService.getTasks();
            expect(tasks[0].status).toBe(translation_types_1.TranslationStatus.FAILED);
            expect(tasks[0].error).toBe('Translation failed');
            // 验证进度
            const progress = fileTranslationService.getProgress();
            expect(progress.status).toBe(translation_types_1.TranslationStatus.FAILED);
            expect(progress.failedSegments).toBe(1);
        });
        it('应该支持翻译任务的重试机制', async () => {
            // 初始化段落
            await fileTranslationService.initialize(['Test segment']);
            // 设置前两次失败，第三次成功的 mock
            mockTranslationService.translateText
                .mockRejectedValueOnce(new Error('First attempt failed'))
                .mockRejectedValueOnce(new Error('Second attempt failed'))
                .mockResolvedValueOnce({
                translatedText: 'Successfully translated',
                metadata: {
                    provider: ai_service_types_1.AIProvider.OPENAI,
                    model: 'gpt-3.5-turbo',
                    processingTime: 100,
                    confidence: 0.95,
                    wordCount: 2,
                    characterCount: 18,
                    tokens: { input: 10, output: 15 }
                }
            });
            // 执行翻译
            await fileTranslationService.translate();
            // 验证调用次数
            expect(mockTranslationService.translateText).toHaveBeenCalledTimes(3);
            // 验证最终状态
            const tasks = fileTranslationService.getTasks();
            expect(tasks[0].status).toBe(translation_types_1.TranslationStatus.COMPLETED);
        });
    });
    describe('cancel', () => {
        it('应该取消所有待处理的任务', async () => {
            // 初始化段落
            await fileTranslationService.initialize(['First segment', 'Second segment']);
            // 取消翻译
            await fileTranslationService.cancel();
            // 验证任务状态
            const tasks = fileTranslationService.getTasks();
            expect(tasks[0].status).toBe(translation_types_1.TranslationStatus.CANCELLED);
            expect(tasks[1].status).toBe(translation_types_1.TranslationStatus.CANCELLED);
            // 验证进度
            const progress = fileTranslationService.getProgress();
            expect(progress.status).toBe(translation_types_1.TranslationStatus.CANCELLED);
        });
    });
    it('should add a file translation job to the queue', async () => {
        mockQueueAddJob.mockResolvedValue('job-123');
        await translationQueue_service_1.translationQueueService.addFileTranslationJob(projectId.toString(), fileId.toString(), mockTranslationOptions, userId, ['admin']);
        expect(mockQueueAddJob).toHaveBeenCalledWith(projectId.toString(), fileId.toString(), mockTranslationOptions, userId, ['admin']);
    });
});
