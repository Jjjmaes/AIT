import { TranslationService } from '../translation.service';
import { AIServiceFactory } from '../ai-adapters/ai-service.factory';
import { QueueTaskType, QueueTaskStatus, TaskMetrics } from '../queue/queue-task.interface';
import { AIServiceResponse, AIProvider } from '../../../types/ai-service.types';
import { TranslationOptions } from '../../../types/translation.types';
import { PerformanceMonitor } from '../monitoring/performance-monitor';
import { TranslationCacheService } from '../cache/translation-cache.service';
import { CacheKey } from '../cache/cache-keys.enum';

describe('TranslationService Performance Monitoring', () => {
  let service: TranslationService;
  let performanceMonitor: PerformanceMonitor;
  let mockCache: jest.Mocked<Partial<TranslationCacheService>>;
  let mockAdapter: any;

  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();

    // Create a mock cache service
    mockCache = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null)
    };

    // Create a real performance monitor with the mock cache
    performanceMonitor = new PerformanceMonitor(mockCache as unknown as TranslationCacheService);
    
    // Create mock adapter for AIService
    mockAdapter = {
      translateText: jest.fn().mockResolvedValue({
        translatedText: 'Hello',
        metadata: {
          processingTime: 100,
          model: 'test-model',
          provider: AIProvider.OPENAI,
          confidence: 0.95,
          wordCount: 1,
          characterCount: 5,
          tokens: {
            input: 1,
            output: 1
          }
        }
      })
    };

    // Mock AIServiceFactory
    jest.mock('../ai-adapters/ai-service.factory', () => ({
      AIServiceFactory: {
        getInstance: jest.fn().mockReturnValue({
          createAdapter: jest.fn().mockReturnValue(mockAdapter)
        })
      }
    }));

    // Create the service with mocked dependencies
    service = new TranslationService({
      provider: AIProvider.OPENAI,
      model: 'gpt-3.5-turbo',
      apiKey: 'test-api-key',
      enableCache: false,
      enableQueue: false
    });

    // Set the adapter manually (since mocking didn't fully work)
    Object.defineProperty(service, 'aiServiceFactory', {
      value: {
        createAdapter: jest.fn().mockReturnValue(mockAdapter)
      }
    });

    // Replace the service's performance monitor with our instance
    Object.defineProperty(service, 'performanceMonitor', {
      value: performanceMonitor
    });
  });

  it('should record performance metrics for successful translation', async () => {
    const result = await service.translateText('Hola', {
      sourceLanguage: 'es',
      targetLanguage: 'en'
    });

    expect(result.translatedText).toBe('Hello');
    const metrics = service.getPerformanceMetrics();
    expect(metrics.totalRequests).toBe(1);
    expect(metrics.successfulRequests).toBe(1);
    expect(metrics.failedRequests).toBe(0);
  });

  it('should record performance metrics for failed translation', async () => {
    // Override the mock for this test to simulate a failure
    mockAdapter.translateText.mockRejectedValueOnce(new Error('Translation failed'));

    await expect(service.translateText('Hola', {
      sourceLanguage: 'es',
      targetLanguage: 'en'
    })).rejects.toThrow('Translation failed');

    const metrics = service.getPerformanceMetrics();
    expect(metrics.totalRequests).toBe(1);
    expect(metrics.successfulRequests).toBe(0);
    expect(metrics.failedRequests).toBe(1);
  });

  it('should record task metrics', async () => {
    // Directly call the performance monitor method to simulate task completion
    await performanceMonitor.recordTaskCompletion(QueueTaskType.TRANSLATION, true, 100);

    const taskMetrics = service.getTaskMetrics();
    const translationMetrics = taskMetrics.find((m: TaskMetrics) => m.type === QueueTaskType.TRANSLATION);
    expect(translationMetrics).toBeDefined();
    expect(translationMetrics?.count).toBe(1);
    expect(translationMetrics?.successRate).toBe(1);
  });

  it('should record performance metrics for multiple segments translation', async () => {
    // Set up the mock to return different responses for each segment
    mockAdapter.translateText
      .mockResolvedValueOnce({
        translatedText: 'Hello',
        metadata: {
          processingTime: 100,
          model: 'test-model',
          provider: AIProvider.OPENAI,
          confidence: 0.95,
          wordCount: 1,
          characterCount: 5,
          tokens: {
            input: 1,
            output: 1
          }
        }
      })
      .mockResolvedValueOnce({
        translatedText: 'World',
        metadata: {
          processingTime: 100,
          model: 'test-model',
          provider: AIProvider.OPENAI,
          confidence: 0.95,
          wordCount: 1,
          characterCount: 5,
          tokens: {
            input: 1,
            output: 1
          }
        }
      });

    const result = await service.translateMultipleSegments(['Hola', 'Mundo'], {
      sourceLanguage: 'es',
      targetLanguage: 'en'
    });

    expect(result.translations[0].translatedText).toBe('Hello');
    expect(result.translations[1].translatedText).toBe('World');
    const metrics = service.getPerformanceMetrics();
    expect(metrics.totalRequests).toBe(1);
    expect(metrics.successfulRequests).toBe(1);
  });

  it('should record cache hits and misses', async () => {
    // Directly call the performance monitor methods
    await performanceMonitor.recordCacheAccess(false); // Cache miss
    await performanceMonitor.recordCacheAccess(true);  // Cache hit

    const metrics = service.getPerformanceMetrics();
    expect(metrics.cacheHits).toBe(1);
    expect(metrics.cacheMisses).toBe(1);
  });
});

describe('Performance Monitoring', () => {
  let performanceMonitor: PerformanceMonitor;
  const mockCache = {
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null)
  };

  beforeEach(() => {
    jest.clearAllMocks();
    performanceMonitor = new PerformanceMonitor(mockCache as any);
  });

  it('should record successful requests', async () => {
    await performanceMonitor.recordRequest(true, 100);
    
    const metrics = performanceMonitor.getMetrics();
    expect(metrics.totalRequests).toBe(1);
    expect(metrics.successfulRequests).toBe(1);
    expect(metrics.failedRequests).toBe(0);
    expect(metrics.averageProcessingTime).toBe(100);
  });

  it('should record failed requests', async () => {
    await performanceMonitor.recordRequest(false, 100);
    
    const metrics = performanceMonitor.getMetrics();
    expect(metrics.totalRequests).toBe(1);
    expect(metrics.successfulRequests).toBe(0);
    expect(metrics.failedRequests).toBe(1);
  });

  it('should record cache hits and misses', async () => {
    await performanceMonitor.recordCacheAccess(true);
    await performanceMonitor.recordCacheAccess(false);
    
    const metrics = performanceMonitor.getMetrics();
    expect(metrics.cacheHits).toBe(1);
    expect(metrics.cacheMisses).toBe(1);
  });

  it('should record queue metrics', async () => {
    await performanceMonitor.recordQueueMetrics(5, 2);
    
    const metrics = performanceMonitor.getMetrics();
    expect(metrics.queueSize).toBe(5);
    expect(metrics.activeTasks).toBe(2);
  });

  it('should record task completion metrics', async () => {
    await performanceMonitor.recordTaskCompletion(QueueTaskType.TRANSLATION, true, 100);
    await performanceMonitor.recordTaskCompletion(QueueTaskType.TRANSLATION, false, 200);
    
    const taskMetrics = performanceMonitor.getTaskMetrics();
    const translationMetrics = taskMetrics.find(m => m.type === QueueTaskType.TRANSLATION);
    
    expect(translationMetrics).toBeDefined();
    expect(translationMetrics?.count).toBe(2);
    expect(translationMetrics?.successRate).toBeGreaterThan(0);
    expect(translationMetrics?.failureRate).toBeGreaterThan(0);
    expect(translationMetrics?.averageProcessingTime).toBe(150); // (100 + 200) / 2
  });

  it('should record retry counts', async () => {
    await performanceMonitor.recordRetry();
    await performanceMonitor.recordRetry();
    
    const metrics = performanceMonitor.getMetrics();
    expect(metrics.retryCount).toBe(2);
  });

  it('should reset metrics', async () => {
    await performanceMonitor.recordRequest(true, 100);
    await performanceMonitor.recordCacheAccess(true);
    await performanceMonitor.recordTaskCompletion(QueueTaskType.TRANSLATION, true, 100);
    
    await performanceMonitor.resetMetrics();
    
    const metrics = performanceMonitor.getMetrics();
    expect(metrics.totalRequests).toBe(0);
    expect(metrics.successfulRequests).toBe(0);
    expect(metrics.cacheHits).toBe(0);
    
    const taskMetrics = performanceMonitor.getTaskMetrics();
    const translationMetrics = taskMetrics.find(m => m.type === QueueTaskType.TRANSLATION);
    expect(translationMetrics?.count).toBe(0);
  });
}); 