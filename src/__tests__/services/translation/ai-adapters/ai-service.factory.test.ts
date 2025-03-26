import { AIServiceFactory } from '../../../../services/translation/ai-adapters/ai-service.factory';
import { AIServiceConfig, AIProvider } from '../../../../types/ai-service.types';
import { OpenAIAdapter } from '../../../../services/translation/ai-adapters/openai.adapter';

// Mock OpenAIAdapter
jest.mock('../../../../services/translation/ai-adapters/openai.adapter');

describe('AIServiceFactory', () => {
  let factory: AIServiceFactory;

  beforeEach(() => {
    // 重置单例
    (AIServiceFactory as any).instance = undefined;
    factory = AIServiceFactory.getInstance();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = AIServiceFactory.getInstance();
      const instance2 = AIServiceFactory.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('createAdapter', () => {
    const mockConfig: AIServiceConfig = {
      provider: AIProvider.OPENAI,
      apiKey: 'test-api-key',
      model: 'gpt-4'
    };

    it('should create OpenAI adapter', () => {
      const adapter = factory.createAdapter(mockConfig);

      expect(adapter).toBeInstanceOf(OpenAIAdapter);
      expect(OpenAIAdapter).toHaveBeenCalledWith(mockConfig);
    });

    it('should reuse existing adapter instance', () => {
      const adapter1 = factory.createAdapter(mockConfig);
      const adapter2 = factory.createAdapter(mockConfig);

      expect(adapter1).toBe(adapter2);
    });

    it('should throw error for unsupported provider', () => {
      const invalidConfig: AIServiceConfig = {
        ...mockConfig,
        provider: 'invalid-provider' as AIProvider
      };

      expect(() => factory.createAdapter(invalidConfig))
        .toThrow('Unsupported AI provider: invalid-provider');
    });
  });

  describe('removeAdapter', () => {
    const mockConfig: AIServiceConfig = {
      provider: AIProvider.OPENAI,
      apiKey: 'test-api-key',
      model: 'gpt-4'
    };

    it('should remove adapter and allow creating new instance', () => {
      // 创建适配器
      const adapter1 = factory.createAdapter(mockConfig);

      // 移除适配器
      factory.removeAdapter(AIProvider.OPENAI);

      // 创建新的适配器
      const adapter2 = factory.createAdapter(mockConfig);

      // 验证是不同的实例
      expect(adapter1).not.toBe(adapter2);
    });
  });

  describe('getAdapter', () => {
    const mockConfig: AIServiceConfig = {
      provider: AIProvider.OPENAI,
      apiKey: 'test-api-key',
      model: 'gpt-4'
    };

    it('should return undefined for non-existent adapter', () => {
      const adapter = factory.getAdapter(AIProvider.OPENAI);
      expect(adapter).toBeUndefined();
    });

    it('should return existing adapter', () => {
      const createdAdapter = factory.createAdapter(mockConfig);
      const retrievedAdapter = factory.getAdapter(AIProvider.OPENAI);

      expect(retrievedAdapter).toBe(createdAdapter);
    });
  });
}); 