import { TranslationService } from "../translation.service";
import { AIProvider } from "../../../types/ai-service.types";
import { AIServiceFactory } from "../ai-adapters/ai-service.factory";
import { TranslationCacheService } from "../cache/translation-cache.service";

jest.mock("../ai-adapters/ai-service.factory");
jest.mock("../cache/translation-cache.service");
jest.mock("../monitoring/performance-monitor", () => {
  return {
    PerformanceMonitor: jest.fn().mockImplementation(() => {
      return {
        recordRequest: jest.fn(),
        recordCacheAccess: jest.fn(),
        recordTaskCompletion: jest.fn(),
      };
    })
  };
});

describe("TranslationService Error Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle translation errors", async () => {
    const errorAdapter = {
      translateText: jest.fn().mockRejectedValue(new Error("Translation failed")),
      validateApiKey: jest.fn().mockResolvedValue(true),
      getAvailableModels: jest.fn().mockResolvedValue([]),
      getModelInfo: jest.fn().mockResolvedValue({}),
      getPricing: jest.fn().mockResolvedValue({})
    };

    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      createAdapter: jest.fn().mockReturnValue(errorAdapter)
    });

    const mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(true),
      clear: jest.fn().mockResolvedValue(true),
      has: jest.fn().mockResolvedValue(false)
    };
    
    (TranslationCacheService as jest.Mock).mockImplementation(() => mockCacheService);

    const errorService = new TranslationService({
      provider: AIProvider.OPENAI,
      model: 'test-model',
      apiKey: 'test-api-key',
      enableCache: true,
      cacheConfig: {
        ttl: 3600,
        maxSize: 100,
        cleanupInterval: 300
      }
    });

    await expect(errorService.translateText('Hola', {
      sourceLanguage: 'es',
      targetLanguage: 'en'
    })).rejects.toThrow('Translation failed');
  });

  it("should handle API key validation errors", async () => {
    const errorAdapter = {
      translateText: jest.fn(),
      validateApiKey: jest.fn().mockRejectedValue(new Error("Invalid API key")),
      getAvailableModels: jest.fn().mockResolvedValue([]),
      getModelInfo: jest.fn().mockResolvedValue({}),
      getPricing: jest.fn().mockResolvedValue({})
    };

    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      createAdapter: jest.fn().mockReturnValue(errorAdapter)
    });

    const mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(true),
      clear: jest.fn().mockResolvedValue(true),
      has: jest.fn().mockResolvedValue(false)
    };
    
    (TranslationCacheService as jest.Mock).mockImplementation(() => mockCacheService);

    const errorService = new TranslationService({
      provider: AIProvider.OPENAI,
      model: 'test-model',
      apiKey: 'invalid-api-key',
      enableCache: true,
      cacheConfig: {
        ttl: 3600,
        maxSize: 100,
        cleanupInterval: 300
      }
    });

    const result = await errorService.validateApiKey();
    expect(result).toBe(false);
    expect(errorAdapter.validateApiKey).toHaveBeenCalled();
  });

  it("should handle model info retrieval errors", async () => {
    const errorAdapter = {
      translateText: jest.fn(),
      validateApiKey: jest.fn().mockResolvedValue(true),
      getAvailableModels: jest.fn().mockResolvedValue([]),
      getModelInfo: jest.fn().mockRejectedValue(new Error("Model info retrieval failed")),
      getPricing: jest.fn().mockResolvedValue({})
    };

    (AIServiceFactory.getInstance as jest.Mock).mockReturnValue({
      createAdapter: jest.fn().mockReturnValue(errorAdapter)
    });

    const mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(true),
      clear: jest.fn().mockResolvedValue(true),
      has: jest.fn().mockResolvedValue(false)
    };
    
    (TranslationCacheService as jest.Mock).mockImplementation(() => mockCacheService);

    const errorService = new TranslationService({
      provider: AIProvider.OPENAI,
      model: 'test-model',
      apiKey: 'test-api-key',
      enableCache: true,
      cacheConfig: {
        ttl: 3600,
        maxSize: 100,
        cleanupInterval: 300
      }
    });

    await expect(errorService.getModelInfo('test-model')).rejects.toThrow('Model info retrieval failed');
  });
});
