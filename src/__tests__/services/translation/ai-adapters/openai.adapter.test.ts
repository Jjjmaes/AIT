import { OpenAIAdapter } from '../../../../services/translation/ai-adapters/openai.adapter';
import { AIServiceConfig, AIProvider } from '../../../../types/ai-service.types';
import { TranslationOptions } from '../../../../types/translation.types';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai');

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;
  let mockConfig: AIServiceConfig;
  let mockOpenAI: {
    chat: {
      completions: {
        create: jest.Mock;
      };
    };
    models: {
      list: jest.Mock;
    };
  };

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();

    // 创建模拟配置
    mockConfig = {
      provider: AIProvider.OPENAI,
      apiKey: 'test-api-key',
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 2000
    };

    // 创建模拟 OpenAI 客户端
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      },
      models: {
        list: jest.fn()
      }
    };

    // 设置 OpenAI 构造函数返回模拟实例
    (OpenAI as unknown as jest.Mock).mockImplementation(() => mockOpenAI);

    // 创建适配器实例
    adapter = new OpenAIAdapter(mockConfig);
  });

  describe('translateText', () => {
    const mockSourceText = 'Hello, world!';
    const mockOptions: TranslationOptions = {
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      preserveFormatting: true,
      useTerminology: true
    };

    const mockCompletion = {
      choices: [{
        message: {
          content: '你好，世界！'
        }
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5
      }
    };

    it('should translate text successfully', async () => {
      // 设置模拟响应
      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue(mockCompletion);

      // 执行翻译
      const result = await adapter.translateText(mockSourceText, mockOptions);

      // 验证结果
      expect(result.translatedText).toBe('你好，世界！');
      expect(result.metadata.provider).toBe(AIProvider.OPENAI);
      expect(result.metadata.model).toBe('gpt-4');
      expect(result.metadata.tokens).toEqual({
        input: 10,
        output: 5
      });

      // 验证 OpenAI 调用
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('professional translator')
          }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Translate the following text')
          })
        ]),
        temperature: 0.3,
        max_tokens: 2000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      });
    });

    it('should handle API errors', async () => {
      // 设置模拟错误
      const mockError = new Error('API Error');
      (mockOpenAI.chat.completions.create as jest.Mock).mockRejectedValue(mockError);

      // 执行翻译并验证错误
      await expect(adapter.translateText(mockSourceText, mockOptions))
        .rejects
        .toThrow('An unknown error occurred during translation');
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid API key', async () => {
      // 设置模拟成功响应
      (mockOpenAI.models.list as jest.Mock).mockResolvedValue([]);

      // 验证 API 密钥
      const result = await adapter.validateApiKey();

      // 验证结果
      expect(result).toBe(true);
      expect(mockOpenAI.models.list).toHaveBeenCalled();
    });

    it('should return false for invalid API key', async () => {
      // 设置模拟错误
      const mockError = new Error('Invalid API key');
      (mockOpenAI.models.list as jest.Mock).mockRejectedValue(mockError);

      // 验证 API 密钥
      const result = await adapter.validateApiKey();

      // 验证结果
      expect(result).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    it('should return available models', async () => {
      // 获取可用模型
      const models = await adapter.getAvailableModels();

      // 验证结果
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('gpt-4');
      expect(models[1].id).toBe('gpt-3.5-turbo');
    });
  });

  describe('getModelInfo', () => {
    it('should return model info for valid model ID', async () => {
      // 获取模型信息
      const modelInfo = await adapter.getModelInfo('gpt-4');

      // 验证结果
      expect(modelInfo.id).toBe('gpt-4');
      expect(modelInfo.provider).toBe(AIProvider.OPENAI);
      expect(modelInfo.maxTokens).toBe(8192);
    });

    it('should throw error for invalid model ID', async () => {
      // 验证错误
      await expect(adapter.getModelInfo('invalid-model'))
        .rejects
        .toThrow('Model invalid-model not found');
    });
  });

  describe('getPricing', () => {
    it('should return pricing for valid model ID', async () => {
      // 获取定价信息
      const pricing = await adapter.getPricing('gpt-4');

      // 验证结果
      expect(pricing).toEqual({
        input: 0.03,
        output: 0.06
      });
    });

    it('should throw error for invalid model ID', async () => {
      // 验证错误
      await expect(adapter.getPricing('invalid-model'))
        .rejects
        .toThrow('Model invalid-model not found');
    });
  });
}); 