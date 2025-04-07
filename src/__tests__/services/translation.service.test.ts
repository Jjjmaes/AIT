import { jest } from '@jest/globals';
import { TranslationService } from '../../services/translation/translation.service';
import { AIProvider } from '../../types/ai-service.types';
import { TranslationOptions } from '../../types/translation.types';
import { AIServiceFactory } from '../../services/translation/ai-adapters/ai-service.factory';
import { TranslationQueueService } from '../../services/translation/queue/translation-queue.service';
import { QueueTaskStatus } from '../../services/translation/queue/queue-task.interface';
import { BaseAIServiceAdapter } from '../../services/translation/ai-adapters/base.adapter';
import { TranslationCacheService } from '../../services/translation/cache/translation-cache.service';
import { AIServiceConfig } from '../../types/ai-service.types';
import { AIModelInfo } from '../../types/ai-service.types';

// 模拟依赖
jest.mock('../../services/translation/ai-adapters/ai-service.factory');
jest.mock('../../services/translation/cache/translation-cache.service');
jest.mock('../../services/translation/queue/translation-queue.service');
jest.mock('../../services/translation/monitoring/performance-monitor');
jest.mock('../../utils/logger');

describe('TranslationService', () => {
  let service: TranslationService;
  let mockAdapter: any;
  let mockFactoryInstance: any;
  let originalGetInstance: any;
  let mockQueueService: any;
  let mockAIAdapter: jest.Mocked<BaseAIServiceAdapter>;
  let mockCacheService: jest.Mocked<TranslationCacheService>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 创建适配器模拟
    mockAdapter = {
      translateText: jest.fn(),
      validateApiKey: jest.fn(),
      getAvailableModels: jest.fn(),
    };

    // 设置各个方法的默认行为
    mockAdapter.translateText.mockImplementation((text: any) => {
      const textStr = String(text);
      return Promise.resolve({
        translatedText: `模拟翻译: ${textStr}`,
        metadata: {
          provider: AIProvider.OPENAI,
          model: 'gpt-3.5-turbo',
          processingTime: 100,
          confidence: 0.9,
          wordCount: textStr.split(' ').length,
          characterCount: textStr.length,
          tokens: { input: 5, output: 10 }
        }
      });
    });
    
    mockAdapter.validateApiKey.mockImplementation(() => {
      return Promise.resolve(true);
    });
    
    mockAdapter.getAvailableModels.mockImplementation(() => {
      return Promise.resolve(['gpt-3.5-turbo', 'gpt-4']);
    });
    
    // 模拟队列服务
    mockQueueService = {
      addTask: jest.fn(),
      getTaskStatus: jest.fn(),
      getTask: jest.fn()
    };
    
    mockQueueService.addTask.mockImplementation(() => Promise.resolve('task-123'));
    
    mockQueueService.getTaskStatus.mockImplementation(() => {
      return Promise.resolve(QueueTaskStatus.COMPLETED);
    });
    
    mockQueueService.getTask.mockImplementation((taskId: any) => {
      return Promise.resolve({
        id: taskId,
        status: QueueTaskStatus.COMPLETED,
        result: mockAdapter.translateText.mock.results[0]?.value || {
          translatedText: '模拟队列翻译结果',
          metadata: {
            provider: AIProvider.OPENAI,
            model: 'gpt-3.5-turbo',
            processingTime: 100,
            confidence: 0.95,
            wordCount: 5,
            characterCount: 10,
            tokens: { input: 5, output: 10 }
          }
        }
      });
    });
    
    // 修改 TranslationQueueService 构造函数的行为
    (TranslationQueueService as any).mockImplementation(() => mockQueueService);
    
    // 设置 AIServiceFactory 模拟
    mockFactoryInstance = {
      createAdapter: jest.fn(() => mockAdapter)
    };
    
    // 保存原始方法并设置模拟
    originalGetInstance = AIServiceFactory.getInstance;
    // @ts-ignore
    AIServiceFactory.getInstance = jest.fn(() => mockFactoryInstance);
    
    // 创建服务实例
    service = new TranslationService({
      provider: AIProvider.OPENAI,
      apiKey: 'test-api-key',
      model: 'gpt-3.5-turbo',
      enableQueue: true
    });

    // Mock AI Adapter
    mockAIAdapter = {
      translateText: jest.fn(),
      validateApiKey: jest.fn(),
      getAvailableModels: jest.fn(),
    } as any;

    // Mock AIServiceFactory to return the mock adapter
    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      createAdapter: jest.fn().mockReturnValue(mockAIAdapter),
    });

    // Mock Cache Service
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      shutdown: jest.fn(),
      getStats: jest.fn(),
    } as any;

    // Manually assign the mocked cache service if constructor doesn't allow injection
    (service as any).cacheService = mockCacheService;
  });
  
  // 在测试完成后恢复原始方法
  afterAll(() => {
    AIServiceFactory.getInstance = originalGetInstance;
  });
  
  // 测试配置验证
  test('构造函数应验证必需的配置', () => {
    expect(() => new TranslationService({} as any)).toThrow('Translation service provider is required');
    expect(() => new TranslationService({ provider: AIProvider.OPENAI } as any)).toThrow('API key is required');
    expect(() => new TranslationService({ provider: AIProvider.OPENAI, apiKey: 'test' } as any)).toThrow('Model is required');
  });
  
  // 测试文本翻译
  test('translateText 应正确翻译文本', async () => {
    const options: TranslationOptions = {
      sourceLanguage: 'en',
      targetLanguage: 'zh'
    };
    
    const result = await service.translateText('Hello world', options);
    
    expect(mockQueueService.addTask).toHaveBeenCalled();
    expect(mockQueueService.getTaskStatus).toHaveBeenCalled();
    expect(mockQueueService.getTask).toHaveBeenCalled();
    expect(result.translatedText).toBe('模拟队列翻译结果');
  });
  
  // 测试不使用队列的翻译
  test('translateText 在禁用队列时应使用适配器直接翻译', async () => {
    // 创建一个不使用队列的服务实例
    const directService = new TranslationService({
      provider: AIProvider.OPENAI,
      apiKey: 'test-api-key',
      model: 'gpt-3.5-turbo',
      enableQueue: false
    });
    
    const options: TranslationOptions = {
      sourceLanguage: 'en',
      targetLanguage: 'zh'
    };
    
    const result = await directService.translateText('Direct translation', options);
    
    expect(mockFactoryInstance.createAdapter).toHaveBeenCalled();
    expect(mockAdapter.translateText).toHaveBeenCalledWith('Direct translation', options);
    expect(result.translatedText).toBe('模拟翻译: Direct translation');
  });
  
  // 测试多段文本翻译
  test('translateMultipleSegments 应正确翻译多个文本段落', async () => {
    const options: TranslationOptions = {
      sourceLanguage: 'en',
      targetLanguage: 'zh'
    };
    
    // 为多段落翻译准备模拟队列
    mockQueueService.getTask.mockImplementationOnce(() => {
      return Promise.resolve({
        id: 'task-123',
        status: QueueTaskStatus.COMPLETED,
        result: [
          {
            translatedText: '模拟翻译: Hello',
            metadata: {
              provider: AIProvider.OPENAI,
              model: 'gpt-3.5-turbo',
              processingTime: 50,
              confidence: 0.95,
              wordCount: 1,
              characterCount: 5,
              tokens: { input: 1, output: 2 }
            }
          },
          {
            translatedText: '模拟翻译: World',
            metadata: {
              provider: AIProvider.OPENAI,
              model: 'gpt-3.5-turbo',
              processingTime: 50,
              confidence: 0.95,
              wordCount: 1,
              characterCount: 5,
              tokens: { input: 1, output: 2 }
            }
          }
        ]
      });
    });
    
    const segments = ['Hello', 'World'];
    const result = await service.translateMultipleSegments(segments, options);
    
    expect(mockQueueService.addTask).toHaveBeenCalled();
    expect(result.translations.length).toBe(2);
    expect(result.translations[0].translatedText).toBe('模拟翻译: Hello');
    expect(result.translations[1].translatedText).toBe('模拟翻译: World');
    expect(result.metadata.totalSegments).toBe(2);
  });
  
  // 测试 API 密钥验证
  test('validateApiKey 应正确验证 API 密钥', async () => {
    // 创建一个不使用缓存的服务实例，以确保调用实际的验证方法
    const noCache = new TranslationService({
      provider: AIProvider.OPENAI,
      apiKey: 'test-api-key',
      model: 'gpt-3.5-turbo',
      enableQueue: false,
      enableCache: false
    });
    
    const result = await noCache.validateApiKey();
    
    expect(mockAdapter.validateApiKey).toHaveBeenCalled();
    expect(result).toBe(true);
  });
  
  // 测试获取可用模型
  test('getAvailableModels 应返回可用的模型列表', async () => {
    const result = await service.getAvailableModels();
    
    expect(mockAdapter.getAvailableModels).toHaveBeenCalled();
    expect(result).toEqual(['gpt-3.5-turbo', 'gpt-4']);
  });

  describe('getAvailableModels', () => {
    it('should retrieve available models from adapter', async () => {
      // Provide full AIModelInfo structure
      const mockModels: AIModelInfo[] = [
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5', provider: AIProvider.OPENAI, maxTokens: 4096, capabilities: [], pricing: { input: 0, output: 0 } }, 
        { id: 'gpt-4', name: 'GPT-4', provider: AIProvider.OPENAI, maxTokens: 8192, capabilities: [], pricing: { input: 0, output: 0 } }
      ];
      mockAIAdapter.getAvailableModels.mockResolvedValue(mockModels);
      const models = await service.getAvailableModels();
      // Expect only the IDs
      expect(models).toEqual(['gpt-3.5-turbo', 'gpt-4']); 
      expect(mockAIAdapter.getAvailableModels).toHaveBeenCalled();
    });

    it('should cache available models', async () => {
      // Provide full AIModelInfo structure
      const mockModels: AIModelInfo[] = [
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5', provider: AIProvider.OPENAI, maxTokens: 4096, capabilities: [], pricing: { input: 0, output: 0 } }
      ];
      mockAIAdapter.getAvailableModels.mockResolvedValue(mockModels);
      mockCacheService.get.mockResolvedValue(null); // Cache miss first time

      const models1 = await service.getAvailableModels();
      // Expect only the IDs in the cache
      expect(mockCacheService.set).toHaveBeenCalledWith('MODEL_LIST', ['gpt-3.5-turbo']); 

      mockCacheService.get.mockResolvedValue(['gpt-3.5-turbo']); // Cache hit second time
      const models2 = await service.getAvailableModels();
      expect(models1).toEqual(models2);
      expect(mockAIAdapter.getAvailableModels).toHaveBeenCalledTimes(1); // Should only be called once
    });

    it('should handle adapter failure', async () => {
      mockAIAdapter.getAvailableModels.mockRejectedValue(new Error('API Error'));
      await expect(service.getAvailableModels()).rejects.toThrow('API Error');
    });
  });
}); 