import { OpenAIAdapter } from '../../services/translation/ai-adapters/openai.adapter';
import { AIProvider } from '../../types/ai-service.types';
import { TranslationOptions } from '../../types/translation.types';
import OpenAI from 'openai';
import { ChatCompletion, Model } from 'openai/resources';
import { jest } from '@jest/globals';
import { AppError } from '../../utils/errors';
import { ProcessedPrompt } from '../../utils/promptProcessor';

// 模拟 OpenAI 包
jest.mock('openai');
jest.mock('../../utils/logger');

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;
  let mockOpenAI: jest.Mocked<OpenAI>;
  let mockCreateCompletion: any;
  let mockListModels: any;
  
  const mockSourceText = 'Hello, world!';
  const mockOptions: TranslationOptions = {
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    aiModel: 'gpt-4'
  };
  const mockPromptData: ProcessedPrompt = {
    systemInstruction: 'You are a professional translator.',
    userPrompt: 'Translate the following text from en to zh. Text: Hello, world!'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 创建 OpenAI 客户端模拟
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      },
      models: {
        list: jest.fn()
      }
    } as any;

    // 设置 mock 函数
    mockCreateCompletion = jest.spyOn(mockOpenAI.chat.completions, 'create');
    mockListModels = jest.spyOn(mockOpenAI.models, 'list');

    // 设置返回值
    mockCreateCompletion.mockResolvedValue({
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-3.5-turbo',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: '你好世界'
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      }
    });

    mockListModels.mockResolvedValue({
      data: [
        { id: 'gpt-3.5-turbo', object: 'model', owned_by: 'openai' },
        { id: 'gpt-4', object: 'model', owned_by: 'openai' },
        { id: 'gpt-4-vision', object: 'model', owned_by: 'openai' }
      ]
    });

    // 创建适配器实例
    adapter = new OpenAIAdapter({
      apiKey: 'test-key',
      provider: AIProvider.OPENAI,
      model: 'gpt-3.5-turbo'
    });
    (adapter as any).client = mockOpenAI;
  });

  describe('translateText', () => {
    it('应该成功翻译文本', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '你好，世界！'
            }
          }
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 30
        }
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse as any);

      const result = await adapter.translateText(mockSourceText, mockPromptData, mockOptions);

      expect(result.translatedText).toBe('你好，世界！');
      expect(result.modelInfo).toEqual({ provider: 'openai', model: 'gpt-4-mock' });
      expect(result.tokenCount).toEqual({ input: 50, output: 30, total: 80 });
      expect(result.processingTime).toBeGreaterThanOrEqual(0);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: mockOptions.aiModel,
        messages: [
          {
            role: 'system',
            content: mockPromptData.systemInstruction
          },
          {
            role: 'user',
            content: mockPromptData.userPrompt
          }
        ],
        temperature: 0.3,
      });
    });

    it('处理 API 调用失败', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));

      await expect(adapter.translateText(mockSourceText, mockPromptData, mockOptions))
        .rejects
        .toThrow('API Error');
    });

    it('should handle API errors', async () => {
      const apiError = new Error('API Error');
      mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

      await expect(adapter.translateText(mockSourceText, mockPromptData, mockOptions))
        .rejects.toThrow(AppError);
    });
  });

  describe('validateApiKey', () => {
    it('有效的 API 密钥应该返回 true', async () => {
      mockOpenAI.models.list.mockResolvedValueOnce({ data: [] } as any);
      const result = await adapter.validateApiKey();
      expect(result).toBe(true);
    });

    it('无效的 API 密钥应该返回 false', async () => {
      mockOpenAI.models.list.mockRejectedValueOnce(new Error('Invalid API key'));
      const result = await adapter.validateApiKey();
      expect(result).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    it('应该返回过滤后的模型列表', async () => {
      mockOpenAI.models.list.mockResolvedValueOnce({
        data: [
          { id: 'gpt-4', root: 'gpt-4' },
          { id: 'gpt-3.5-turbo', root: 'gpt-3.5-turbo' },
          { id: 'text-davinci-003', root: 'text-davinci' }
        ]
      } as any);

      const models = await adapter.getAvailableModels();

      expect(models).toEqual(['gpt-4', 'gpt-3.5-turbo']);
    });

    it('API 调用失败时应该返回硬编码模型列表', async () => {
      mockOpenAI.models.list.mockRejectedValueOnce(new Error('API Error'));

      const models = await adapter.getAvailableModels();

      expect(models).toEqual(['gpt-4', 'gpt-3.5-turbo']);
    });
  });
}); 