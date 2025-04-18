"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const project_translation_service_1 = require("../project-translation.service");
const translation_types_1 = require("../../../types/translation.types");
const file_translation_service_1 = require("../file-translation.service");
const translation_service_1 = require("../translation.service");
jest.mock('../file-translation.service');
jest.mock('../translation.service');
describe('ProjectTranslationService', () => {
    let projectTranslationService;
    let mockFileTranslationService;
    let mockTranslationService;
    beforeEach(() => {
        jest.clearAllMocks();
        mockTranslationService = {
            translateText: jest.fn(),
        };
        mockFileTranslationService = {
            initialize: jest.fn(),
            translate: jest.fn(),
            cancel: jest.fn(),
            getResult: jest.fn().mockResolvedValue({
                segments: []
            })
        };
        file_translation_service_1.FileTranslationService.mockImplementation(() => mockFileTranslationService);
        translation_service_1.TranslationService.mockImplementation(() => mockTranslationService);
        projectTranslationService = new project_translation_service_1.ProjectTranslationService({
            maxConcurrentFiles: 2,
            retryCount: 3,
            retryDelay: 1000,
            timeout: 30000
        });
    });
    describe('initializeProject', () => {
        it('should initialize a project translation task', async () => {
            const files = [
                { id: 'file1', content: ['Hello', 'World'] },
                { id: 'file2', content: ['Goodbye', 'World'] }
            ];
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'es',
                preserveFormatting: true
            };
            const projectId = await projectTranslationService.initializeProject('Test Project', 'Test Description', files, options);
            expect(projectId).toBeDefined();
            expect(mockFileTranslationService.initialize).toHaveBeenCalledTimes(2);
            expect(mockFileTranslationService.initialize).toHaveBeenCalledWith(['Hello', 'World']);
            expect(mockFileTranslationService.initialize).toHaveBeenCalledWith(['Goodbye', 'World']);
        });
        it('should handle initialization errors', async () => {
            const files = [
                { id: 'file1', content: ['Hello', 'World'] }
            ];
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'es',
                preserveFormatting: true
            };
            mockFileTranslationService.initialize.mockRejectedValueOnce(new Error('Initialization failed'));
            await expect(projectTranslationService.initializeProject('Test Project', 'Test Description', files, options)).rejects.toThrow('Initialization failed');
        });
    });
    describe('translateProject', () => {
        it('should translate all files in the project', async () => {
            const files = [
                { id: 'file1', content: ['Hello', 'World'] },
                { id: 'file2', content: ['Goodbye', 'World'] }
            ];
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'es',
                preserveFormatting: true
            };
            const projectId = await projectTranslationService.initializeProject('Test Project', 'Test Description', files, options);
            await projectTranslationService.translateProject(projectId);
            expect(mockFileTranslationService.translate).toHaveBeenCalledTimes(2);
        });
        it('should handle translation errors', async () => {
            const files = [
                { id: 'file1', content: ['Hello', 'World'] }
            ];
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'es',
                preserveFormatting: true
            };
            const projectId = await projectTranslationService.initializeProject('Test Project', 'Test Description', files, options);
            mockFileTranslationService.translate.mockRejectedValueOnce(new Error('Translation failed'));
            await projectTranslationService.translateProject(projectId);
            const result = await projectTranslationService.getProjectResult(projectId);
            expect(result.files[0].status).toBe(translation_types_1.TranslationStatus.FAILED);
        });
    });
    describe('cancelProject', () => {
        it('should cancel all ongoing translations', async () => {
            const files = [
                { id: 'file1', content: ['Hello', 'World'] },
                { id: 'file2', content: ['Goodbye', 'World'] }
            ];
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'es',
                preserveFormatting: true
            };
            const projectId = await projectTranslationService.initializeProject('Test Project', 'Test Description', files, options);
            // 设置文件状态为 PROCESSING
            const task = projectTranslationService['tasks'].get(projectId);
            if (task) {
                task.files.forEach(file => {
                    file.status = translation_types_1.TranslationStatus.PROCESSING;
                });
            }
            await projectTranslationService.cancelProject(projectId);
            expect(mockFileTranslationService.cancel).toHaveBeenCalledTimes(2);
        });
        it('should handle cancellation errors', async () => {
            const files = [
                { id: 'file1', content: ['Hello', 'World'] }
            ];
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'es',
                preserveFormatting: true
            };
            const projectId = await projectTranslationService.initializeProject('Test Project', 'Test Description', files, options);
            // 设置文件状态为 PROCESSING
            const task = projectTranslationService['tasks'].get(projectId);
            if (task) {
                task.files.forEach(file => {
                    file.status = translation_types_1.TranslationStatus.PROCESSING;
                });
            }
            mockFileTranslationService.cancel.mockRejectedValueOnce(new Error('Cancellation failed'));
            await expect(projectTranslationService.cancelProject(projectId)).rejects.toThrow('Cancellation failed');
        });
    });
    describe('getProjectProgress', () => {
        it('should return the current progress of the project', async () => {
            const files = [
                { id: 'file1', content: ['Hello', 'World'] },
                { id: 'file2', content: ['Goodbye', 'World'] }
            ];
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'es',
                preserveFormatting: true
            };
            const projectId = await projectTranslationService.initializeProject('Test Project', 'Test Description', files, options);
            const progress = await projectTranslationService.getProjectProgress(projectId);
            expect(progress).toEqual({
                totalFiles: 2,
                completedFiles: 0,
                totalSegments: 4,
                completedSegments: 0,
                failedSegments: 0,
                percentage: 0
            });
        });
    });
    describe('getProjectResult', () => {
        it('should return the translation results for all files', async () => {
            const files = [
                { id: 'file1', content: ['Hello', 'World'] },
                { id: 'file2', content: ['Goodbye', 'World'] }
            ];
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'es',
                preserveFormatting: true
            };
            const projectId = await projectTranslationService.initializeProject('Test Project', 'Test Description', files, options);
            mockFileTranslationService.getResult.mockResolvedValue({
                segments: [
                    {
                        id: 'segment1',
                        originalText: 'Hello',
                        translatedText: 'Hola',
                        status: translation_types_1.TranslationStatus.COMPLETED,
                        metadata: {
                            aiProvider: 'openai',
                            model: 'gpt-3.5-turbo',
                            processingTime: 1000,
                            wordCount: 1,
                            characterCount: 5,
                            tokens: {
                                input: 1,
                                output: 1
                            },
                            cost: 0.0001
                        }
                    }
                ]
            });
            const result = await projectTranslationService.getProjectResult(projectId);
            expect(result).toEqual({
                projectId,
                status: translation_types_1.TranslationStatus.PENDING,
                files: [
                    {
                        fileId: 'file1',
                        status: translation_types_1.TranslationStatus.PENDING,
                        segments: [
                            {
                                id: 'segment1',
                                originalText: 'Hello',
                                translatedText: 'Hola',
                                status: translation_types_1.TranslationStatus.COMPLETED,
                                metadata: {
                                    aiProvider: 'openai',
                                    model: 'gpt-3.5-turbo',
                                    processingTime: 1000,
                                    wordCount: 1,
                                    characterCount: 5,
                                    tokens: {
                                        input: 1,
                                        output: 1
                                    },
                                    cost: 0.0001
                                }
                            }
                        ]
                    },
                    {
                        fileId: 'file2',
                        status: translation_types_1.TranslationStatus.PENDING,
                        segments: [
                            {
                                id: 'segment1',
                                originalText: 'Hello',
                                translatedText: 'Hola',
                                status: translation_types_1.TranslationStatus.COMPLETED,
                                metadata: {
                                    aiProvider: 'openai',
                                    model: 'gpt-3.5-turbo',
                                    processingTime: 1000,
                                    wordCount: 1,
                                    characterCount: 5,
                                    tokens: {
                                        input: 1,
                                        output: 1
                                    },
                                    cost: 0.0001
                                }
                            }
                        ]
                    }
                ],
                summary: {
                    totalFiles: 2,
                    completedFiles: 0,
                    failedFiles: 0,
                    totalSegments: 2,
                    completedSegments: 2,
                    failedSegments: 0,
                    totalTokens: 4,
                    totalCost: 0.0002,
                    averageQuality: 1,
                    processingTime: 2000
                }
            });
        });
    });
});
