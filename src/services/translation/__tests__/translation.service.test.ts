import { TranslationService } from '../translation.service';
import { AIServiceFactory } from '../ai-adapters/ai-service.factory';
import { AIServiceConfig, AIProvider } from '../../../types/ai-service.types';
import { TranslationOptions } from '../../../types/translation.types';
import { AIServiceResponse } from '../../../types/translation.types';

// Mock AIServiceFactory
jest.mock('../ai-adapters/ai-service.factory');

describe('TranslationService', () => {
  let translationService: TranslationService;
  let mockConfig: AIServiceConfig;
  let mockAdapter: any;

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();

    // 创建测试配置
    mockConfig = {
      provider: AIProvider.OPENAI,
      apiKey: 'test-api-key',
      model: 'gpt-3.5-turbo',
      maxTokens: 1000,
      temperature: 0.7
    };

    // 创建 mock adapter
    mockAdapter = {
      translateText: jest.fn(),
      validateApiKey: jest.fn(),
      getAvailableModels: jest.fn(),
      getModelInfo: jest.fn(),
      getPricing: jest.fn()
    };

    // 设置 AIServiceFactory 的 mock
    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      createAdapter: jest.fn().mockReturnValue(mockAdapter)
    });

    translationService = new TranslationService(mockConfig);
  });

  describe('translateText', () => {
    it('should successfully translate text', async () => {
      const sourceText = 'Hello, world!';
      const options: TranslationOptions = {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        preserveFormatting: true
      };

      const mockResponse: AIServiceResponse = {
        translatedText: '你好，世界！',
        metadata: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          processingTime: 100,
          confidence: 0.95,
          wordCount: 2,
          characterCount: 5
        }
      };

      mockAdapter.translateText.mockResolvedValue(mockResponse);

      const result = await translationService.translateText(sourceText, options);

      expect(result).toEqual(mockResponse);
      expect(mockAdapter.translateText).toHaveBeenCalledWith(sourceText, options);
    });

    it('should handle translation errors', async () => {
      const sourceText = 'Hello, world!';
      const options: TranslationOptions = {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        preserveFormatting: true
      };

      mockAdapter.translateText.mockRejectedValue(new Error('Translation failed'));

      await expect(translationService.translateText(sourceText, options))
        .rejects
        .toThrow('Translation failed');
    });
  });

  describe('translateMultipleSegments', () => {
    it('should successfully translate multiple segments', async () => {
      const segments = ['Hello', 'World'];
      const options: TranslationOptions = {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        preserveFormatting: true
      };

      const mockResponses: AIServiceResponse[] = [
        {
          translatedText: '你好',
          metadata: {
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            processingTime: 50,
            confidence: 0.95,
            wordCount: 1,
            characterCount: 2
          }
        },
        {
          translatedText: '世界',
          metadata: {
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            processingTime: 50,
            confidence: 0.95,
            wordCount: 1,
            characterCount: 2
          }
        }
      ];

      mockAdapter.translateText
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1]);

      const results = await translationService.translateMultipleSegments(segments, options);

      expect(results).toEqual(mockResponses);
      expect(mockAdapter.translateText).toHaveBeenCalledTimes(2);
    });

    it('should handle errors in multiple segments translation', async () => {
      const segments = ['Hello', 'World'];
      const options: TranslationOptions = {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        preserveFormatting: true
      };

      mockAdapter.translateText.mockRejectedValue(new Error('Translation failed'));

      await expect(translationService.translateMultipleSegments(segments, options))
        .rejects
        .toThrow('Translation failed');
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid API key', async () => {
      mockAdapter.validateApiKey.mockResolvedValue(true);

      const result = await translationService.validateApiKey();

      expect(result).toBe(true);
      expect(mockAdapter.validateApiKey).toHaveBeenCalled();
    });

    it('should return false for invalid API key', async () => {
      mockAdapter.validateApiKey.mockResolvedValue(false);

      const result = await translationService.validateApiKey();

      expect(result).toBe(false);
      expect(mockAdapter.validateApiKey).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      mockAdapter.validateApiKey.mockRejectedValue(new Error('Validation failed'));

      const result = await translationService.validateApiKey();

      expect(result).toBe(false);
      expect(mockAdapter.validateApiKey).toHaveBeenCalled();
    });
  });

  describe('getAvailableModels', () => {
    it('should return list of available models', async () => {
      const mockModels = [
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        { id: 'gpt-4', name: 'GPT-4' }
      ];

      mockAdapter.getAvailableModels.mockResolvedValue(mockModels);

      const result = await translationService.getAvailableModels();

      expect(result).toEqual(['gpt-3.5-turbo', 'gpt-4']);
      expect(mockAdapter.getAvailableModels).toHaveBeenCalled();
    });

    it('should handle errors when getting models', async () => {
      mockAdapter.getAvailableModels.mockRejectedValue(new Error('Failed to get models'));

      await expect(translationService.getAvailableModels())
        .rejects
        .toThrow('Failed to get models');
    });
  });

  describe('getModelInfo', () => {
    it('should return model information', async () => {
      const modelId = 'gpt-3.5-turbo';
      const mockInfo = {
        name: 'GPT-3.5 Turbo',
        description: 'Fast and efficient model',
        capabilities: ['translation', 'text-generation']
      };

      mockAdapter.getModelInfo.mockResolvedValue(mockInfo);

      const result = await translationService.getModelInfo(modelId);

      expect(result).toEqual(mockInfo);
      expect(mockAdapter.getModelInfo).toHaveBeenCalledWith(modelId);
    });

    it('should handle errors when getting model info', async () => {
      const modelId = 'gpt-3.5-turbo';
      mockAdapter.getModelInfo.mockRejectedValue(new Error('Failed to get model info'));

      await expect(translationService.getModelInfo(modelId))
        .rejects
        .toThrow('Failed to get model info');
    });
  });

  describe('getPricing', () => {
    it('should return model pricing information', async () => {
      const modelId = 'gpt-3.5-turbo';
      const mockPricing = {
        input: 0.0015,
        output: 0.002
      };

      mockAdapter.getPricing.mockResolvedValue(mockPricing);

      const result = await translationService.getPricing(modelId);

      expect(result).toEqual(mockPricing);
      expect(mockAdapter.getPricing).toHaveBeenCalledWith(modelId);
    });

    it('should handle errors when getting pricing', async () => {
      const modelId = 'gpt-3.5-turbo';
      mockAdapter.getPricing.mockRejectedValue(new Error('Failed to get pricing'));

      await expect(translationService.getPricing(modelId))
        .rejects
        .toThrow('Failed to get pricing');
    });
  });
}); 