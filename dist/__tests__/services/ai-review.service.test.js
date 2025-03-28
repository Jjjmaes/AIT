"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ai_review_service_1 = require("../../services/ai-review.service");
const ai_adapters_1 = require("../../services/translation/ai-adapters");
const ai_service_types_1 = require("../../types/ai-service.types");
const segment_model_1 = require("../../models/segment.model");
const logger_1 = __importDefault(require("../../utils/logger"));
// Mock dependencies
jest.mock('../../services/translation/ai-adapters');
jest.mock('../../utils/logger');
describe('AIReviewService', () => {
    let aiReviewService;
    let mockReviewAdapter;
    let mockAIServiceFactory;
    const mockApiKey = 'test-api-key';
    const mockOriginalText = 'This is the original text in English.';
    const mockTranslatedText = '这是英文的原始文本。';
    const mockReviewResponse = {
        suggestedTranslation: '这是英语的原始文本。',
        issues: [
            {
                type: segment_model_1.IssueType.TERMINOLOGY,
                description: 'Translation mistake for "English"',
                position: { start: 4, end: 6 },
                suggestion: '英语'
            }
        ],
        scores: [
            {
                type: segment_model_1.ReviewScoreType.ACCURACY,
                score: 85,
                details: 'Good accuracy, minor terminology issues'
            },
            {
                type: segment_model_1.ReviewScoreType.FLUENCY,
                score: 92,
                details: 'Natural flow in target language'
            }
        ],
        metadata: {
            provider: ai_service_types_1.AIProvider.OPENAI,
            model: 'gpt-4',
            processingTime: 1200,
            confidence: 0.92,
            wordCount: 8,
            characterCount: 38,
            tokens: {
                input: 15,
                output: 20
            },
            modificationDegree: 0.15
        }
    };
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        // Setup the review adapter mock
        mockReviewAdapter = {
            reviewText: jest.fn().mockResolvedValue(mockReviewResponse)
        };
        // Setup the AIServiceFactory mock
        mockAIServiceFactory = {
            createReviewAdapter: jest.fn().mockReturnValue(mockReviewAdapter)
        };
        ai_adapters_1.AIServiceFactory.getInstance.mockReturnValue(mockAIServiceFactory);
        // Create the service instance
        aiReviewService = new ai_review_service_1.AIReviewService();
        // Set environment variables
        process.env.OPENAI_API_KEY = mockApiKey;
    });
    afterEach(() => {
        // Clean up environment variables
        delete process.env.OPENAI_API_KEY;
    });
    describe('reviewTranslation', () => {
        it('should throw error if no API key is provided', async () => {
            // Arrange
            delete process.env.OPENAI_API_KEY;
            // Act & Assert
            await expect(aiReviewService.reviewTranslation(mockOriginalText, mockTranslatedText, {
                sourceLanguage: 'en',
                targetLanguage: 'zh-CN'
            })).rejects.toThrow('AI审校失败: 未配置API密钥');
        });
        it('should use correct default values when minimal options are provided', async () => {
            // Arrange
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'zh-CN'
            };
            // Act
            await aiReviewService.reviewTranslation(mockOriginalText, mockTranslatedText, options);
            // Assert
            expect(mockAIServiceFactory.createReviewAdapter).toHaveBeenCalledWith(expect.objectContaining({
                provider: ai_service_types_1.AIProvider.OPENAI,
                apiKey: mockApiKey,
                model: 'gpt-3.5-turbo',
                temperature: 0.3,
                maxTokens: 4000
            }));
            expect(mockReviewAdapter.reviewText).toHaveBeenCalledWith(expect.objectContaining({
                sourceLanguage: 'en',
                targetLanguage: 'zh-CN',
                originalContent: mockOriginalText,
                translatedContent: mockTranslatedText
            }));
            expect(logger_1.default.info).toHaveBeenCalledWith(expect.stringContaining(`Starting AI review using ${ai_service_types_1.AIProvider.OPENAI} model gpt-3.5-turbo`));
        });
        it('should use custom values when provided in options', async () => {
            // Arrange
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'zh-CN',
                provider: ai_service_types_1.AIProvider.BAIDU,
                model: 'ernie-bot',
                apiKey: 'custom-api-key',
                customPrompt: 'Custom review prompt',
                requestedScores: [segment_model_1.ReviewScoreType.ACCURACY, segment_model_1.ReviewScoreType.FLUENCY],
                checkIssueTypes: [segment_model_1.IssueType.TERMINOLOGY, segment_model_1.IssueType.GRAMMAR],
                contextSegments: [
                    {
                        original: 'Context before',
                        translation: '上下文之前'
                    }
                ]
            };
            // Act
            await aiReviewService.reviewTranslation(mockOriginalText, mockTranslatedText, options);
            // Assert
            expect(mockAIServiceFactory.createReviewAdapter).toHaveBeenCalledWith(expect.objectContaining({
                provider: ai_service_types_1.AIProvider.BAIDU,
                apiKey: 'custom-api-key',
                model: 'ernie-bot'
            }));
            expect(mockReviewAdapter.reviewText).toHaveBeenCalledWith(expect.objectContaining({
                sourceLanguage: 'en',
                targetLanguage: 'zh-CN',
                originalContent: mockOriginalText,
                translatedContent: mockTranslatedText,
                customPrompt: 'Custom review prompt',
                requestedScores: [segment_model_1.ReviewScoreType.ACCURACY, segment_model_1.ReviewScoreType.FLUENCY],
                checkIssueTypes: [segment_model_1.IssueType.TERMINOLOGY, segment_model_1.IssueType.GRAMMAR],
                contextSegments: [
                    {
                        original: 'Context before',
                        translation: '上下文之前'
                    }
                ]
            }));
            expect(logger_1.default.info).toHaveBeenCalledWith(expect.stringContaining(`Starting AI review using ${ai_service_types_1.AIProvider.BAIDU} model ernie-bot`));
        });
        it('should handle and rethrow review adapter errors with custom message', async () => {
            // Arrange
            mockReviewAdapter.reviewText = jest.fn().mockRejectedValue(new Error('Adapter failure'));
            // Act & Assert
            await expect(aiReviewService.reviewTranslation(mockOriginalText, mockTranslatedText, {
                sourceLanguage: 'en',
                targetLanguage: 'zh-CN'
            })).rejects.toThrow('AI审校失败: Adapter failure');
            expect(logger_1.default.error).toHaveBeenCalledWith('AI review failed', expect.objectContaining({
                error: expect.any(Error)
            }));
        });
        it('should return the review response on successful review', async () => {
            // Act
            const result = await aiReviewService.reviewTranslation(mockOriginalText, mockTranslatedText, {
                sourceLanguage: 'en',
                targetLanguage: 'zh-CN'
            });
            // Assert
            expect(result).toEqual(mockReviewResponse);
            expect(logger_1.default.info).toHaveBeenCalledWith('AI review completed successfully');
        });
    });
    describe('reviewText', () => {
        it('should call reviewTranslation with the same parameters', async () => {
            // Arrange
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'zh-CN',
                model: 'gpt-4',
                customPrompt: 'Test prompt'
            };
            // Spy on reviewTranslation
            const reviewTranslationSpy = jest.spyOn(aiReviewService, 'reviewTranslation').mockResolvedValue(mockReviewResponse);
            // Act
            const result = await aiReviewService.reviewText(mockOriginalText, mockTranslatedText, options);
            // Assert
            expect(reviewTranslationSpy).toHaveBeenCalledWith(mockOriginalText, mockTranslatedText, options);
            expect(result).toEqual(mockReviewResponse);
            // Restore the spy
            reviewTranslationSpy.mockRestore();
        });
    });
});
