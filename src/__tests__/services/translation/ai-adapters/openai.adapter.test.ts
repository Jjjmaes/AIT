import { jest } from '@jest/globals';
import OpenAI, { ClientOptions } from 'openai';
import * as OpenAIResources from 'openai/resources';
import { OpenAIAdapter } from '../../../../services/translation/ai-adapters/openai.adapter';
import { TranslationOptions } from '../../../../types/translation.types';
import { AIProvider } from '../../../../types/ai-service.types';
import { AppError } from '../../../../utils/errors';
// Import ProcessedPrompt
import { ProcessedPrompt } from '../../../../utils/promptProcessor';
import { AIServiceConfig } from '../../../../types/ai-service.types';

// Mock OpenAI library
jest.mock('openai');

// Explicitly type the mock constructor
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI & (new (opts?: ClientOptions) => jest.Mocked<OpenAI>)>;

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;
  let mockConfig: AIServiceConfig;
  // Define a simple mock client structure
  let mockSimpleClient: { 
    chat: { 
      completions: { 
        create: jest.Mock<() => Promise<OpenAIResources.Chat.Completions.ChatCompletion>> } 
    } 
  };
  const mockSourceText = 'Hello';
  const mockOptions: TranslationOptions = { sourceLanguage: 'en', targetLanguage: 'es' };
  const mockPromptData: ProcessedPrompt = { 
    systemInstruction: 'System instruction',
    userPrompt: 'User prompt for {{input}}'
  };
  // Ensure mockApiResponse matches the ChatCompletion type structure
  const mockApiResponse: OpenAIResources.Chat.Completions.ChatCompletion = { 
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
    jest.clearAllMocks();

    mockConfig = { 
      provider: AIProvider.OPENAI,
      apiKey: 'test-key',
      aiModel: 'gpt-4-turbo'
    };

    // Instantiate the adapter normally
    adapter = new OpenAIAdapter(mockConfig);

    // Explicitly type the mock function
    const mockCreate = jest.fn<() => Promise<OpenAIResources.Chat.Completions.ChatCompletion>>()
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
    jest.spyOn(adapter as any, 'getClient').mockReturnValue(mockSimpleClient);
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
      const optionsWithModel: TranslationOptions = { ...mockOptions, aiModel: 'gpt-3.5-turbo' };
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
        .rejects.toThrow(AppError); // Expect AppError
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