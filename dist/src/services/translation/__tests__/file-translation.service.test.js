"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const file_translation_service_1 = require("../file-translation.service");
const translation_types_1 = require("../../../types/translation.types");
const ai_service_types_1 = require("../../../types/ai-service.types");
const mongoose_1 = require("mongoose");
// Mock TranslationService
jest.mock('../translation.service');
describe('FileTranslationService', () => {
    let fileTranslationService;
    let mockTranslationService;
    let mockFileId;
    let mockProjectId;
    let mockOptions;
    beforeEach(() => {
        // 创建 mock IDs
        mockFileId = new mongoose_1.Types.ObjectId();
        mockProjectId = new mongoose_1.Types.ObjectId();
        // 创建 mock 选项
        mockOptions = {
            sourceLanguage: 'en',
            targetLanguage: 'zh',
            preserveFormatting: true
        };
        // 创建 mock TranslationService
        mockTranslationService = {
            translateText: jest.fn(),
            translateMultipleSegments: jest.fn(),
            validateApiKey: jest.fn(),
            getAvailableModels: jest.fn(),
            getModelInfo: jest.fn(),
            getPricing: jest.fn()
        };
        fileTranslationService = new file_translation_service_1.FileTranslationService(mockTranslationService, mockFileId, mockProjectId, mockOptions);
    });
    describe('initialize', () => {
        it('should initialize translation tasks', async () => {
            const segments = ['Hello', 'World'];
            await fileTranslationService.initialize(segments);
            const tasks = fileTranslationService.getTasks();
            expect(tasks).toHaveLength(2);
            expect(tasks[0]).toMatchObject({
                projectId: mockProjectId,
                fileId: mockFileId,
                status: translation_types_1.TranslationStatus.PENDING,
                options: mockOptions
            });
        });
        it('should handle initialization errors', async () => {
            const segments = null;
            const error = new Error('Cannot read properties of null');
            await expect(fileTranslationService.initialize(segments)).rejects.toThrow();
        });
    });
    describe('translate', () => {
        it('should successfully translate all segments', async () => {
            const segments = ['Hello', 'World'];
            await fileTranslationService.initialize(segments);
            const mockResponse1 = {
                translatedText: '你好',
                metadata: {
                    provider: ai_service_types_1.AIProvider.OPENAI,
                    model: 'gpt-3.5-turbo',
                    processingTime: 50,
                    confidence: 0.95,
                    wordCount: 1,
                    characterCount: 2,
                    tokens: {
                        input: 2,
                        output: 1
                    }
                }
            };
            const mockResponse2 = {
                translatedText: '世界',
                metadata: {
                    provider: ai_service_types_1.AIProvider.OPENAI,
                    model: 'gpt-3.5-turbo',
                    processingTime: 50,
                    confidence: 0.95,
                    wordCount: 1,
                    characterCount: 2,
                    tokens: {
                        input: 2,
                        output: 1
                    }
                }
            };
            mockTranslationService.translateText
                .mockResolvedValueOnce(mockResponse1)
                .mockResolvedValueOnce(mockResponse2);
            await fileTranslationService.translate();
            const progress = fileTranslationService.getProgress();
            expect(progress.status).toBe(translation_types_1.TranslationStatus.COMPLETED);
            expect(progress.completedSegments).toBe(2);
            expect(progress.failedSegments).toBe(0);
        });
        it('should handle translation errors', async () => {
            const segments = ['Hello', 'World'];
            await fileTranslationService.initialize(segments);
            const mockResponse = {
                translatedText: '你好',
                metadata: {
                    provider: ai_service_types_1.AIProvider.OPENAI,
                    model: 'gpt-3.5-turbo',
                    processingTime: 50,
                    confidence: 0.95,
                    wordCount: 1,
                    characterCount: 2,
                    tokens: {
                        input: 2,
                        output: 1
                    }
                }
            };
            mockTranslationService.translateText
                .mockResolvedValueOnce(mockResponse)
                .mockRejectedValueOnce(new Error('Translation failed'));
            await expect(fileTranslationService.translate()).rejects.toThrow('Translation failed');
            const progress = fileTranslationService.getProgress();
            expect(progress.status).toBe(translation_types_1.TranslationStatus.FAILED);
            expect(progress.completedSegments).toBe(1);
            expect(progress.failedSegments).toBe(1);
        });
    });
    describe('cancel', () => {
        it('should cancel all pending tasks', async () => {
            const segments = ['Hello', 'World'];
            await fileTranslationService.initialize(segments);
            fileTranslationService.cancel();
            const tasks = fileTranslationService.getTasks();
            expect(tasks.every(task => task.status === translation_types_1.TranslationStatus.CANCELLED)).toBe(true);
            const progress = fileTranslationService.getProgress();
            expect(progress.status).toBe(translation_types_1.TranslationStatus.CANCELLED);
        });
    });
    describe('getProgress', () => {
        it('should return current progress', async () => {
            const segments = ['Hello', 'World'];
            await fileTranslationService.initialize(segments);
            const progress = fileTranslationService.getProgress();
            expect(progress).toMatchObject({
                projectId: mockProjectId,
                fileId: mockFileId,
                totalSegments: 2,
                processedSegments: 0,
                completedSegments: 0,
                failedSegments: 0,
                progress: 0,
                status: translation_types_1.TranslationStatus.PENDING
            });
        });
    });
    describe('getTasks', () => {
        it('should return all tasks', async () => {
            const segments = ['Hello', 'World'];
            await fileTranslationService.initialize(segments);
            const tasks = fileTranslationService.getTasks();
            expect(tasks).toHaveLength(2);
            expect(tasks[0]).toMatchObject({
                projectId: mockProjectId,
                fileId: mockFileId,
                status: translation_types_1.TranslationStatus.PENDING
            });
        });
    });
});
