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
const promptTemplate_service_1 = require("../../services/promptTemplate.service");
const promptTemplate_model_1 = require("../../models/promptTemplate.model");
// Import services and types needed for new tests
const project_service_1 = require("../../services/project.service");
const terminology_service_1 = require("../../services/terminology.service");
const mongoose_1 = require("mongoose");
// Mock dependencies
jest.mock('../../services/translation/ai-adapters');
jest.mock('../../utils/logger');
jest.mock('../../services/promptTemplate.service');
jest.mock('../../services/project.service'); // Mock ProjectService
jest.mock('../../services/terminology.service'); // Mock TerminologyService
describe('AIReviewService', () => {
    let aiReviewService;
    let mockReviewAdapter;
    let mockAIServiceFactory;
    let mockPromptTemplateService;
    let mockProjectService; // Add mock instance type
    let mockTerminologyService; // Add mock instance type
    const mockApiKey = 'test-api-key';
    const mockOriginalText = 'This is the original text in English.';
    const mockTranslatedText = '这是英文的原始文本。';
    const mockReviewResponse = {
        suggestedTranslation: '这是英语的原始文本。',
        issues: [
            {
                type: segment_model_1.IssueType.TERMINOLOGY,
                description: 'Translation mistake for \"English\"' /* eslint-disable-line @typescript-eslint/quotes */,
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
            reviewText: jest.fn().mockResolvedValue(mockReviewResponse),
            getAvailableModels: jest.fn(),
            validateApiKey: jest.fn()
        };
        // Setup the AIServiceFactory mock
        mockAIServiceFactory = {
            createReviewAdapter: jest.fn().mockReturnValue(mockReviewAdapter)
        };
        ai_adapters_1.AIServiceFactory.getInstance.mockReturnValue(mockAIServiceFactory);
        // Setup PromptTemplateService mock
        mockPromptTemplateService = promptTemplate_service_1.promptTemplateService;
        mockPromptTemplateService.getTemplateById.mockResolvedValue(null); // Default to null
        // Setup ProjectService mock
        mockProjectService = project_service_1.projectService;
        mockProjectService.getProjectById.mockResolvedValue(null); // Default to null
        // Setup TerminologyService mock
        mockTerminologyService = terminology_service_1.terminologyService;
        mockTerminologyService.getTerminologyById.mockResolvedValue(null); // Default to null
        // Create the service instance, injecting all mocks
        aiReviewService = new ai_review_service_1.AIReviewService(mockPromptTemplateService, mockAIServiceFactory, mockTerminologyService, mockProjectService);
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
        it('should fetch and use prompt template if promptTemplateId is provided', async () => {
            // Arrange
            const templateId = 'review-template-123';
            const mockTemplate = {
                _id: templateId,
                name: 'Standard Review Template',
                userPrompt: 'Review this: {ORIGINAL_CONTENT} -> {TRANSLATED_CONTENT}',
                taskType: promptTemplate_model_1.PromptTaskType.REVIEW
            };
            mockPromptTemplateService.getTemplateById.mockResolvedValue(mockTemplate);
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'zh-CN',
                promptTemplateId: templateId
            };
            const expectedRenderedPrompt = `Review this: ${mockOriginalText} -> ${mockTranslatedText}`;
            // Act
            await aiReviewService.reviewTranslation(mockOriginalText, mockTranslatedText, options);
            // Assert
            expect(mockPromptTemplateService.getTemplateById).toHaveBeenCalledWith(templateId);
            expect(mockReviewAdapter.reviewText).toHaveBeenCalledWith(expect.objectContaining({
                customPrompt: expectedRenderedPrompt
            }));
            expect(logger_1.default.info).toHaveBeenCalledWith(expect.stringContaining(`Using prompt template ID: ${templateId}`));
        });
        it('should use customPrompt if both customPrompt and promptTemplateId are provided', async () => {
            // Arrange
            const templateId = 'review-template-123';
            const customPromptString = 'Use this specific prompt instead.';
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'zh-CN',
                promptTemplateId: templateId,
                customPrompt: customPromptString
            };
            // Act
            await aiReviewService.reviewTranslation(mockOriginalText, mockTranslatedText, options);
            // Assert
            expect(mockPromptTemplateService.getTemplateById).not.toHaveBeenCalled(); // Should not fetch template
            expect(mockReviewAdapter.reviewText).toHaveBeenCalledWith(expect.objectContaining({
                customPrompt: customPromptString // Should use the direct custom prompt
            }));
            expect(logger_1.default.debug).toHaveBeenCalledWith(expect.stringContaining('Using provided customPrompt string.'));
        });
        it('should fallback if prompt template is not found', async () => {
            // Arrange
            const templateId = 'non-existent-template';
            mockPromptTemplateService.getTemplateById.mockResolvedValue(null);
            const options = { sourceLanguage: 'en', targetLanguage: 'zh-CN', promptTemplateId: templateId };
            // Act
            await aiReviewService.reviewTranslation(mockOriginalText, mockTranslatedText, options);
            // Assert
            expect(mockPromptTemplateService.getTemplateById).toHaveBeenCalledWith(templateId);
            expect(mockReviewAdapter.reviewText).toHaveBeenCalledWith(expect.objectContaining({ customPrompt: undefined }) // Fallback: no custom prompt
            );
            expect(logger_1.default.warn).toHaveBeenCalledWith(expect.stringContaining(`Prompt template ${templateId} not found`));
        });
        it('should fallback if fetched template is not a REVIEW template', async () => {
            // Arrange
            const templateId = 'translation-template-456';
            const mockTemplate = {
                _id: templateId,
                name: 'Translation Template',
                userPrompt: 'Translate this: {ORIGINAL_CONTENT}',
                taskType: promptTemplate_model_1.PromptTaskType.TRANSLATION // Incorrect type
            };
            mockPromptTemplateService.getTemplateById.mockResolvedValue(mockTemplate);
            const options = { sourceLanguage: 'en', targetLanguage: 'zh-CN', promptTemplateId: templateId };
            // Act
            await aiReviewService.reviewTranslation(mockOriginalText, mockTranslatedText, options);
            // Assert
            expect(mockReviewAdapter.reviewText).toHaveBeenCalledWith(expect.objectContaining({ customPrompt: undefined }) // Fallback
            );
            expect(logger_1.default.warn).toHaveBeenCalledWith(expect.stringContaining(`not a REVIEW template`));
        });
        it('should fallback if fetching template fails', async () => {
            // Arrange
            const templateId = 'error-template-789';
            const fetchError = new Error('Database connection failed');
            mockPromptTemplateService.getTemplateById.mockRejectedValue(fetchError);
            const options = { sourceLanguage: 'en', targetLanguage: 'zh-CN', promptTemplateId: templateId };
            // Act
            await aiReviewService.reviewTranslation(mockOriginalText, mockTranslatedText, options);
            // Assert
            expect(mockReviewAdapter.reviewText).toHaveBeenCalledWith(expect.objectContaining({ customPrompt: undefined }) // Fallback
            );
            expect(logger_1.default.error).toHaveBeenCalledWith(expect.stringContaining(`Error fetching prompt template ${templateId}`), expect.objectContaining({ error: fetchError }));
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
    // --- Tests for Terminology Integration ---
    describe('reviewTranslation with Terminology', () => {
        // Define mock data at the describe level
        const projectId = new mongoose_1.Types.ObjectId().toString();
        const userId = new mongoose_1.Types.ObjectId().toString();
        const terminologyId = new mongoose_1.Types.ObjectId();
        const mockUserIdObj = new mongoose_1.Types.ObjectId(); // Dummy user ID
        const mockTerms = [
            {
                source: 'Hello',
                target: 'Bonjour',
                createdBy: mockUserIdObj,
                createdAt: new Date()
            },
            {
                source: 'World',
                target: 'Monde',
                domain: 'general',
                createdBy: mockUserIdObj,
                createdAt: new Date()
            }
        ];
        const mockProjectWithTerms = {
            _id: new mongoose_1.Types.ObjectId(projectId),
            terminology: terminologyId
        };
        const mockTerminologyList = {
            _id: terminologyId,
            terms: mockTerms
        };
        it('should fetch project and terms if projectId and userId are provided', async () => {
            // Arrange
            mockProjectService.getProjectById.mockResolvedValue(mockProjectWithTerms);
            mockTerminologyService.getTerminologyById.mockResolvedValue(mockTerminologyList);
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'fr',
                projectId: projectId,
                userId: userId
            };
            // Act
            await aiReviewService.reviewTranslation('Hello World', 'Salut le Monde', options);
            // Assert
            expect(mockProjectService.getProjectById).toHaveBeenCalledWith(projectId, userId);
            expect(mockTerminologyService.getTerminologyById).toHaveBeenCalledWith(terminologyId.toString());
        });
        it('should prepend terminology instruction to prompt when no specific template is used', async () => {
            // Arrange
            mockProjectService.getProjectById.mockResolvedValue(mockProjectWithTerms);
            mockTerminologyService.getTerminologyById.mockResolvedValue(mockTerminologyList);
            mockPromptTemplateService.getTemplateById.mockResolvedValue(null); // Ensure no template is found
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'fr',
                projectId: projectId,
                userId: userId
            };
            const expectedTermString = `[${mockTerms[0].source} -> ${mockTerms[0].target}], [${mockTerms[1].source} -> ${mockTerms[1].target}]`;
            const expectedInstructionPrefix = `Strictly adhere to the following terminology: ${expectedTermString}.\\n\\n`;
            // Act
            await aiReviewService.reviewTranslation('Hello World', 'Salut le Monde', options);
            // Assert
            expect(mockReviewAdapter.reviewText).toHaveBeenCalledTimes(1);
            const passedOptions = mockReviewAdapter.reviewText.mock.calls[0][0];
            expect(passedOptions.customPrompt).toBeDefined();
            // Check that the custom prompt includes the terminology instruction
            expect(passedOptions.customPrompt).toContain(`Strictly adhere to the following terminology: ${expectedTermString}`);
            // Optionally, check that it prepends correctly (might be brittle if base prompt changes significantly)
            // Find the base prompt generated by the adapter when no template is used
            // const basePrompt = mockReviewAdapter.buildReviewPrompt({ ...options, customPrompt: undefined }); // Need access to adapter's build method or its output
            // expect(passedOptions.customPrompt).toBe(expectedInstructionPrefix + basePrompt);
        });
        it('should replace {TERMINOLOGY_LIST} placeholder in prompt template', async () => {
            // Arrange
            const templateId = 'review-template-with-placeholder';
            const mockTemplateWithPlaceholder = {
                _id: templateId,
                name: 'Review Template With Term Placeholder',
                // Include the placeholder in the prompt text
                userPrompt: 'Review this: {ORIGINAL_CONTENT} -> {TRANSLATED_CONTENT}. Use terms: {TERMINOLOGY_LIST}',
                taskType: promptTemplate_model_1.PromptTaskType.REVIEW
            };
            mockPromptTemplateService.getTemplateById.mockResolvedValue(mockTemplateWithPlaceholder);
            mockProjectService.getProjectById.mockResolvedValue(mockProjectWithTerms);
            mockTerminologyService.getTerminologyById.mockResolvedValue(mockTerminologyList);
            const options = {
                sourceLanguage: 'en',
                targetLanguage: 'fr',
                projectId: projectId,
                userId: userId,
                promptTemplateId: templateId
            };
            const expectedTermString = `[${mockTerms[0].source} -> ${mockTerms[0].target}], [${mockTerms[1].source} -> ${mockTerms[1].target}]`;
            const expectedRenderedPrompt = `Review this: ${mockOriginalText} -> ${mockTranslatedText}. Use terms: ${expectedTermString}`;
            // Act
            await aiReviewService.reviewTranslation(mockOriginalText, // Use the globally defined mock text
            mockTranslatedText, options);
            // Assert
            expect(mockReviewAdapter.reviewText).toHaveBeenCalledTimes(1);
            const passedOptions = mockReviewAdapter.reviewText.mock.calls[0][0];
            expect(passedOptions.customPrompt).toBeDefined();
            expect(passedOptions.customPrompt).toBe(expectedRenderedPrompt); // Exact match after replacement
            expect(passedOptions.customPrompt).not.toContain('{TERMINOLOGY_LIST}');
            expect(passedOptions.customPrompt).not.toContain('Strictly adhere'); // Should not prepend if placeholder exists
        });
        it('should NOT add terminology if project has no linked terminology', async () => {
            // Arrange
            const projectWithoutTerms = {
                _id: new mongoose_1.Types.ObjectId(projectId),
                terminology: undefined // Use undefined instead of null
            };
            mockProjectService.getProjectById.mockResolvedValue(projectWithoutTerms);
            mockPromptTemplateService.getTemplateById.mockResolvedValue(null);
            const options = { sourceLanguage: 'en', targetLanguage: 'fr', projectId: projectId, userId: userId };
            // Act
            await aiReviewService.reviewTranslation('Text', 'Texte', options);
            // Assert
            expect(mockTerminologyService.getTerminologyById).not.toHaveBeenCalled();
            const passedOptions = mockReviewAdapter.reviewText.mock.calls[0][0];
            expect(passedOptions.customPrompt).not.toContain('Strictly adhere');
        });
        it('should NOT add terminology if fetching project fails', async () => {
            // Arrange
            const fetchError = new Error('Project DB error');
            mockProjectService.getProjectById.mockRejectedValue(fetchError);
            mockPromptTemplateService.getTemplateById.mockResolvedValue(null);
            const options = { sourceLanguage: 'en', targetLanguage: 'fr', projectId: projectId, userId: userId };
            // Act
            await aiReviewService.reviewTranslation('Text', 'Texte', options);
            // Assert
            expect(mockTerminologyService.getTerminologyById).not.toHaveBeenCalled();
            const passedOptions = mockReviewAdapter.reviewText.mock.calls[0][0];
            expect(passedOptions.customPrompt).not.toContain('Strictly adhere');
            expect(logger_1.default.error).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch project or terminology'), expect.any(Object));
        });
        it('should NOT add terminology if fetching terminology list fails', async () => {
            // Arrange
            const fetchError = new Error('Term DB error');
            mockProjectService.getProjectById.mockResolvedValue(mockProjectWithTerms); // Project found
            mockTerminologyService.getTerminologyById.mockRejectedValue(fetchError); // Terminology fetch fails
            mockPromptTemplateService.getTemplateById.mockResolvedValue(null);
            const options = { sourceLanguage: 'en', targetLanguage: 'fr', projectId: projectId, userId: userId };
            // Act
            await aiReviewService.reviewTranslation('Text', 'Texte', options);
            // Assert
            expect(mockProjectService.getProjectById).toHaveBeenCalledWith(projectId, userId);
            expect(mockTerminologyService.getTerminologyById).toHaveBeenCalledWith(terminologyId.toString());
            const passedOptions = mockReviewAdapter.reviewText.mock.calls[0][0];
            expect(passedOptions.customPrompt).not.toContain('Strictly adhere');
            expect(logger_1.default.error).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch project or terminology'), expect.any(Object));
        });
    }); // End of describe block
    describe('getSupportedModels', () => {
        const mockModels = [
            {
                id: 'gpt-4-review',
                name: 'GPT-4 Review',
                provider: ai_service_types_1.AIProvider.OPENAI,
                maxTokens: 8000,
                capabilities: ['review', 'translation'],
                pricing: { input: 0.03, output: 0.06 }
            },
            {
                id: 'gpt-3.5-translate',
                name: 'GPT-3.5 Translate Only',
                provider: ai_service_types_1.AIProvider.OPENAI,
                maxTokens: 4000,
                capabilities: ['translation'],
                pricing: { input: 0.001, output: 0.002 }
            },
            {
                id: 'some-other-model',
                name: 'Other Review Model',
                provider: ai_service_types_1.AIProvider.OPENAI,
                maxTokens: 16000,
                capabilities: ['review'],
                pricing: { input: 0.01, output: 0.02 }
            }
        ];
        beforeEach(() => {
            // Ensure the adapter mock exists and setup getAvailableModels
            if (!mockReviewAdapter) {
                mockReviewAdapter = { reviewText: jest.fn(), getAvailableModels: jest.fn(), validateApiKey: jest.fn() };
                mockAIServiceFactory.createReviewAdapter.mockReturnValue(mockReviewAdapter);
            }
            mockReviewAdapter.getAvailableModels.mockResolvedValue(mockModels);
        });
        it('should return models with review capability', async () => {
            // Act
            const result = await aiReviewService.getSupportedModels();
            // Assert
            expect(mockReviewAdapter.getAvailableModels).toHaveBeenCalled();
            expect(result).toHaveLength(2);
            expect(result.map(m => m.id)).toEqual(expect.arrayContaining(['gpt-4-review', 'some-other-model']));
            expect(result.map(m => m.id)).not.toContain('gpt-3.5-translate');
        });
        it('should use provided API key when calling adapter factory', async () => {
            // Arrange
            const customKey = 'my-special-key';
            // Act
            await aiReviewService.getSupportedModels(ai_service_types_1.AIProvider.OPENAI, customKey);
            // Assert
            expect(mockAIServiceFactory.createReviewAdapter).toHaveBeenCalledWith(expect.objectContaining({
                apiKey: customKey,
                provider: ai_service_types_1.AIProvider.OPENAI
            }));
        });
        it('should use environment API key if no key is provided', async () => {
            // Act
            await aiReviewService.getSupportedModels();
            // Assert
            expect(mockAIServiceFactory.createReviewAdapter).toHaveBeenCalledWith(expect.objectContaining({
                apiKey: mockApiKey, // From process.env setup in global beforeEach
                provider: ai_service_types_1.AIProvider.OPENAI
            }));
        });
        it('should throw error if no API key is available', async () => {
            // Arrange
            delete process.env.OPENAI_API_KEY;
            // Act & Assert
            await expect(aiReviewService.getSupportedModels()).rejects.toThrow('获取支持的模型失败: 未配置API密钥');
        });
        it('should handle adapter errors when getting models', async () => {
            // Arrange
            const adapterError = new Error('Failed to fetch models from API');
            mockReviewAdapter.getAvailableModels.mockRejectedValue(adapterError);
            // Act & Assert
            await expect(aiReviewService.getSupportedModels()).rejects.toThrow('获取支持的模型失败: Failed to fetch models from API');
            expect(logger_1.default.error).toHaveBeenCalledWith('Failed to get supported models', expect.objectContaining({ error: adapterError }));
        });
    });
    describe('validateApiKey', () => {
        beforeEach(() => {
            // Ensure the adapter mock exists and setup validateApiKey
            if (!mockReviewAdapter) {
                mockReviewAdapter = { reviewText: jest.fn(), getAvailableModels: jest.fn(), validateApiKey: jest.fn() };
                mockAIServiceFactory.createReviewAdapter.mockReturnValue(mockReviewAdapter);
            }
            // Default mock to resolve true
            mockReviewAdapter.validateApiKey.mockResolvedValue(true);
        });
        it('should return true for a valid API key', async () => {
            // Arrange
            const apiKey = 'valid-key';
            mockReviewAdapter.validateApiKey.mockResolvedValue(true);
            // Act
            const result = await aiReviewService.validateApiKey(ai_service_types_1.AIProvider.OPENAI, apiKey);
            // Assert
            expect(result).toBe(true);
            expect(mockAIServiceFactory.createReviewAdapter).toHaveBeenCalledWith(expect.objectContaining({ provider: ai_service_types_1.AIProvider.OPENAI, apiKey }));
            expect(mockReviewAdapter.validateApiKey).toHaveBeenCalled();
        });
        it('should return false for an invalid API key', async () => {
            // Arrange
            const apiKey = 'invalid-key';
            mockReviewAdapter.validateApiKey.mockResolvedValue(false);
            // Act
            const result = await aiReviewService.validateApiKey(ai_service_types_1.AIProvider.OPENAI, apiKey);
            // Assert
            expect(result).toBe(false);
            expect(mockReviewAdapter.validateApiKey).toHaveBeenCalled();
        });
        it('should return false and log error if adapter throws an error', async () => {
            // Arrange
            const apiKey = 'error-key';
            const adapterError = new Error('Network Error during validation');
            mockReviewAdapter.validateApiKey.mockRejectedValue(adapterError);
            // Act
            const result = await aiReviewService.validateApiKey(ai_service_types_1.AIProvider.OPENAI, apiKey);
            // Assert
            expect(result).toBe(false);
            expect(logger_1.default.error).toHaveBeenCalledWith('API key validation failed', expect.objectContaining({ error: adapterError }));
        });
    });
});
