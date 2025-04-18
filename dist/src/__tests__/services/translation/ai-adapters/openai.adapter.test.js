"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const openai_1 = __importDefault(require("openai"));
const openai_adapter_1 = require("../../../../services/translation/ai-adapters/openai.adapter");
const ai_service_types_1 = require("../../../../types/ai-service.types");
const errors_1 = require("../../../../utils/errors");
// Mock OpenAI library
globals_1.jest.mock('openai');
// Explicitly type the mock constructor
const MockedOpenAI = openai_1.default;
describe('OpenAIAdapter', () => {
    let adapter;
    let mockConfig;
    // Define a simple mock client structure
    let mockSimpleClient;
    const mockSourceText = 'Hello';
    const mockOptions = { sourceLanguage: 'en', targetLanguage: 'es' };
    const mockPromptData = {
        systemInstruction: 'System instruction',
        userPrompt: 'User prompt for {{input}}'
    };
    // Ensure mockApiResponse matches the ChatCompletion type structure
    const mockApiResponse = {
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-4-mock',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: 'Hola',
                    refusal: null
                },
                finish_reason: 'stop',
                logprobs: null, // Add required logprobs field
            }
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        // Change system_fingerprint to undefined
        system_fingerprint: undefined,
    };
    beforeEach(() => {
        globals_1.jest.clearAllMocks();
        mockConfig = {
            provider: ai_service_types_1.AIProvider.OPENAI,
            apiKey: 'test-key',
            aiModel: 'gpt-4-turbo'
        };
        // Instantiate the adapter normally
        adapter = new openai_adapter_1.OpenAIAdapter(mockConfig);
        // Explicitly type the mock function
        const mockCreate = globals_1.jest.fn()
            .mockResolvedValue(mockApiResponse);
        mockSimpleClient = {
            chat: {
                completions: {
                    create: mockCreate
                }
            }
        };
        // Spy on the adapter's internal method (assuming it's named getClient) 
        // and make it return the simple mock
        globals_1.jest.spyOn(adapter, 'getClient').mockReturnValue(mockSimpleClient);
    });
    describe('translateText', () => {
        it('should call OpenAI API and return response', async () => {
            const result = await adapter.translateText(mockSourceText, mockPromptData, mockOptions);
            // Expect the *simple mock client's* method to have been called
            expect(mockSimpleClient.chat.completions.create).toHaveBeenCalledWith({
                model: mockConfig.aiModel,
                messages: [
                    { role: 'system', content: mockPromptData.systemInstruction },
                    { role: 'user', content: mockPromptData.userPrompt }
                ],
                temperature: expect.any(Number),
            });
            expect(result.translatedText).toBe('Hola');
            expect(result.modelInfo).toEqual({ provider: 'openai', model: 'gpt-4-mock' });
            expect(result.tokenCount).toEqual({ input: 10, output: 5, total: 15 });
        });
        it('should use model from options if provided', async () => {
            const optionsWithModel = { ...mockOptions, aiModel: 'gpt-3.5-turbo' };
            await adapter.translateText(mockSourceText, mockPromptData, optionsWithModel);
            expect(mockSimpleClient.chat.completions.create).toHaveBeenCalledWith(expect.objectContaining({
                model: 'gpt-3.5-turbo'
            }));
        });
        it('should handle API errors', async () => {
            const apiError = new Error('API Failed');
            // Explicitly type the mock rejection
            mockSimpleClient.chat.completions.create.mockRejectedValue(apiError);
            await expect(adapter.translateText(mockSourceText, mockPromptData, mockOptions))
                .rejects.toThrow(errors_1.AppError); // Expect AppError
        });
    });
    // Removed tests for non-existent methods
    /*
    describe('getModelInfo', () => {
      // ... tests removed ...
    });
  
    describe('getPricing', () => {
      // ... tests removed ...
    });
    */
});
