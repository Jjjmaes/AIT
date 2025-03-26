import { AIServiceFactory } from './ai-adapters/ai-service.factory';
import { AIServiceConfig, AIProvider } from '../../types/ai-service.types';
import { TranslationOptions } from '../../types/translation.types';
import { AIServiceResponse } from '../../types/ai-service.types';
import { TranslationQueueService } from './queue/translation-queue.service';
import { TranslationCacheService } from './cache/translation-cache.service';
import { QueueTaskType, QueueTaskStatus } from './queue/queue-task.interface';
import { CacheKey } from './cache/cache-keys.enum';
import logger from '../../utils/logger';
import { PerformanceMonitor } from './monitoring/performance-monitor';

export interface TranslationServiceConfig extends AIServiceConfig {
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 是否启用任务队列 */
  enableQueue?: boolean;
  /** 缓存配置 */
  cacheConfig?: {
    ttl: number;
    maxSize: number;
    cleanupInterval: number;
  };
  /** 队列配置 */
  queueConfig?: {
    maxRetries: number;
    retryDelay: number;
    timeout: number;
    maxConcurrent: number;
    priorityLevels: number;
  };
}

export class TranslationService {
  private aiServiceFactory: AIServiceFactory;
  private config: TranslationServiceConfig;
  private queueService?: TranslationQueueService;
  private cacheService?: TranslationCacheService;
  private performanceMonitor: PerformanceMonitor;

  constructor(config: TranslationServiceConfig) {
    this.config = config;
    this.aiServiceFactory = AIServiceFactory.getInstance();
    
    // 初始化缓存服务
    if (config.enableCache && config.cacheConfig) {
      this.cacheService = new TranslationCacheService(config.cacheConfig);
    }
    
    // 初始化队列服务
    if (config.enableQueue && config.queueConfig) {
      this.queueService = new TranslationQueueService(config.queueConfig);
    }

    this.performanceMonitor = new PerformanceMonitor(this.cacheService!);
  }

  async translateText(sourceText: string, options: TranslationOptions): Promise<AIServiceResponse> {
    const startTime = Date.now();
    try {
      // 检查缓存
      if (this.cacheService) {
        const cacheKey = this.generateCacheKey(sourceText, options);
        const cachedResult = await this.cacheService.get<AIServiceResponse>(cacheKey);
        if (cachedResult) {
          await this.performanceMonitor.recordCacheAccess(true);
          logger.info('Translation result retrieved from cache', {
            provider: this.config.provider,
            model: this.config.model
          });
          return cachedResult;
        }
        await this.performanceMonitor.recordCacheAccess(false);
      }

      // 如果启用了队列服务，将任务添加到队列
      if (this.queueService) {
        const taskId = await this.queueService.addTask({
          type: QueueTaskType.TRANSLATION,
          priority: 1,
          data: {
            text: sourceText,
            options
          },
          metadata: {
            provider: this.config.provider,
            model: this.config.model
          }
        });

        // 等待任务完成
        let taskStatus = await this.queueService.getTaskStatus(taskId);
        while (taskStatus === QueueTaskStatus.PENDING || taskStatus === QueueTaskStatus.PROCESSING) {
          await new Promise(resolve => setTimeout(resolve, 100));
          taskStatus = await this.queueService.getTaskStatus(taskId);
        }

        const task = await this.queueService.getTask(taskId);
        if (!task || task.status !== QueueTaskStatus.COMPLETED) {
          throw new Error(task?.error || 'Translation task failed');
        }

        const result = task.result as AIServiceResponse;
        
        // 缓存结果
        if (this.cacheService) {
          const cacheKey = this.generateCacheKey(sourceText, options);
          await this.cacheService.set(cacheKey, result);
        }

        await this.performanceMonitor.recordTaskCompletion(
          QueueTaskType.TRANSLATION,
          true,
          Date.now() - startTime
        );
        return result;
      }

      // 如果没有使用队列，直接执行翻译
      const adapter = this.aiServiceFactory.createAdapter(this.config);
      const result = await adapter.translateText(sourceText, options);

      // 缓存结果
      if (this.cacheService) {
        const cacheKey = this.generateCacheKey(sourceText, options);
        await this.cacheService.set(cacheKey, result);
      }

      // 记录翻译结果
      logger.info('Translation completed', {
        provider: this.config.provider,
        model: this.config.model,
        sourceLength: sourceText.length,
        targetLength: result.translatedText.length,
        processingTime: result.metadata.processingTime
      });

      await this.performanceMonitor.recordRequest(true, Date.now() - startTime);
      return result;
    } catch (error) {
      await this.performanceMonitor.recordRequest(false, Date.now() - startTime);
      logger.error('Translation failed', {
        provider: this.config.provider,
        model: this.config.model,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async translateMultipleSegments(segments: string[], options: TranslationOptions): Promise<{ 
    translations: {
      originalText: string;
      translatedText: string;
      metadata: Record<string, any>;
    }[];
    metadata: {
      totalProcessingTime: number;
      totalSegments: number;
      model: string;
      provider: string;
      sourceLanguage: string;
      targetLanguage: string;
    };
  }> {
    const startTime = Date.now();
    try {
      // 如果启用了队列服务，将任务添加到队列
      if (this.queueService) {
        const taskId = await this.queueService.addTask({
          type: QueueTaskType.TRANSLATION,
          priority: 1,
          data: {
            segments,
            options
          },
          metadata: {
            provider: this.config.provider,
            model: this.config.model
          }
        });

        // 等待任务完成
        let taskStatus = await this.queueService.getTaskStatus(taskId);
        while (taskStatus === QueueTaskStatus.PENDING || taskStatus === QueueTaskStatus.PROCESSING) {
          await new Promise(resolve => setTimeout(resolve, 100));
          taskStatus = await this.queueService.getTaskStatus(taskId);
        }

        const task = await this.queueService.getTask(taskId);
        if (!task || task.status !== QueueTaskStatus.COMPLETED) {
          throw new Error(task?.error || 'Multiple segments translation task failed');
        }

        const resultsArray = task.result as AIServiceResponse[];
        
        // 组装结果为预期格式
        const translations = segments.map((text, index) => {
          const result = resultsArray && Array.isArray(resultsArray) && index < resultsArray.length ? 
            resultsArray[index] : null;
          return {
            originalText: text,
            translatedText: result?.translatedText || '',
            metadata: result?.metadata || {}
          };
        });
        
        const totalProcessingTime = resultsArray && Array.isArray(resultsArray) ? 
          resultsArray.reduce((sum, result) => sum + (result?.metadata?.processingTime || 0), 0) : 0;
        
        // 记录翻译结果
        logger.info('Multiple segments translation completed', {
          provider: this.config.provider,
          model: this.config.model,
          segmentCount: segments.length,
          totalProcessingTime
        });

        await this.performanceMonitor.recordTaskCompletion(
          QueueTaskType.TRANSLATION,
          true,
          Date.now() - startTime
        );
        
        return {
          translations,
          metadata: {
            totalProcessingTime,
            totalSegments: segments.length,
            model: this.config.model,
            provider: this.config.provider,
            sourceLanguage: options.sourceLanguage,
            targetLanguage: options.targetLanguage
          }
        };
      }

      // 如果没有使用队列，直接执行翻译
      const adapter = this.aiServiceFactory.createAdapter(this.config);
      const translationPromises = segments.map(segment =>
        adapter.translateText(segment, options)
      );

      const resultsArray = await Promise.all(translationPromises);
      
      // 组装结果为预期格式
      const translations = segments.map((text, index) => {
        const result = resultsArray && Array.isArray(resultsArray) && index < resultsArray.length ? 
          resultsArray[index] : null;
        return {
          originalText: text,
          translatedText: result?.translatedText || '',
          metadata: result?.metadata || {}
        };
      });
      
      const totalProcessingTime = resultsArray && Array.isArray(resultsArray) ? 
        resultsArray.reduce((sum, result) => sum + (result?.metadata?.processingTime || 0), 0) : 0;

      // 记录翻译结果
      logger.info('Multiple segments translation completed', {
        provider: this.config.provider,
        model: this.config.model,
        segmentCount: segments.length,
        totalProcessingTime
      });

      await this.performanceMonitor.recordRequest(true, Date.now() - startTime);
      
      return {
        translations,
        metadata: {
          totalProcessingTime,
          totalSegments: segments.length,
          model: this.config.model,
          provider: this.config.provider,
          sourceLanguage: options.sourceLanguage,
          targetLanguage: options.targetLanguage
        }
      };
    } catch (error) {
      await this.performanceMonitor.recordRequest(false, Date.now() - startTime);
      logger.error('Multiple segments translation failed', {
        provider: this.config.provider,
        model: this.config.model,
        segmentCount: segments.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async validateApiKey(): Promise<boolean> {
    const startTime = Date.now();
    try {
      // 检查缓存
      if (this.cacheService) {
        const cacheKey = 'API_KEY_VALIDATION';
        const cachedResult = await this.cacheService.get<boolean>(cacheKey);
        if (cachedResult !== null) {
          await this.performanceMonitor.recordCacheAccess(true);
          return cachedResult === true;
        }
        await this.performanceMonitor.recordCacheAccess(false);
      }

      const adapter = this.aiServiceFactory.createAdapter(this.config);
      const isValid = await adapter.validateApiKey();

      // 缓存结果
      if (this.cacheService) {
        const cacheKey = 'API_KEY_VALIDATION';
        await this.cacheService.set(cacheKey, isValid);
      }

      await this.performanceMonitor.recordRequest(true, Date.now() - startTime);
      return isValid === true;
    } catch (error) {
      await this.performanceMonitor.recordRequest(false, Date.now() - startTime);
      logger.error('API key validation failed', {
        provider: this.config.provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    const startTime = Date.now();
    try {
      // 检查缓存
      if (this.cacheService) {
        const cacheKey = CacheKey.MODEL_LIST;
        const cachedResult = await this.cacheService.get<string[]>(cacheKey);
        if (cachedResult) {
          await this.performanceMonitor.recordCacheAccess(true);
          return cachedResult;
        }
        await this.performanceMonitor.recordCacheAccess(false);
      }

      const adapter = this.aiServiceFactory.createAdapter(this.config);
      const models = await adapter.getAvailableModels();
      const modelIds = models.map(model => model.id);

      // 缓存结果
      if (this.cacheService) {
        const cacheKey = CacheKey.MODEL_LIST;
        await this.cacheService.set(cacheKey, modelIds);
      }

      await this.performanceMonitor.recordRequest(true, Date.now() - startTime);
      return modelIds;
    } catch (error) {
      await this.performanceMonitor.recordRequest(false, Date.now() - startTime);
      logger.error('Failed to get available models', {
        provider: this.config.provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getModelInfo(modelId: string): Promise<any> {
    const startTime = Date.now();
    try {
      // 检查缓存
      if (this.cacheService) {
        const cacheKey = `${CacheKey.MODEL_INFO}:${modelId}`;
        const cachedResult = await this.cacheService.get(cacheKey);
        if (cachedResult) {
          await this.performanceMonitor.recordCacheAccess(true);
          return cachedResult;
        }
        await this.performanceMonitor.recordCacheAccess(false);
      }

      const adapter = this.aiServiceFactory.createAdapter(this.config);
      const modelInfo = await adapter.getModelInfo(modelId);

      // 缓存结果
      if (this.cacheService) {
        const cacheKey = `${CacheKey.MODEL_INFO}:${modelId}`;
        await this.cacheService.set(cacheKey, modelInfo);
      }

      await this.performanceMonitor.recordRequest(true, Date.now() - startTime);
      return modelInfo;
    } catch (error) {
      await this.performanceMonitor.recordRequest(false, Date.now() - startTime);
      logger.error('Failed to get model info', {
        provider: this.config.provider,
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getPricing(modelId: string): Promise<{ input: number; output: number }> {
    const startTime = Date.now();
    try {
      // 检查缓存
      if (this.cacheService) {
        const cacheKey = `${CacheKey.PRICING_INFO}:${modelId}`;
        const cachedResult = await this.cacheService.get<{ input: number; output: number }>(cacheKey);
        if (cachedResult) {
          await this.performanceMonitor.recordCacheAccess(true);
          return cachedResult;
        }
        await this.performanceMonitor.recordCacheAccess(false);
      }

      const adapter = this.aiServiceFactory.createAdapter(this.config);
      const pricing = await adapter.getPricing(modelId);

      // 缓存结果
      if (this.cacheService) {
        const cacheKey = `${CacheKey.PRICING_INFO}:${modelId}`;
        await this.cacheService.set(cacheKey, pricing);
      }

      await this.performanceMonitor.recordRequest(true, Date.now() - startTime);
      return pricing;
    } catch (error) {
      await this.performanceMonitor.recordRequest(false, Date.now() - startTime);
      logger.error('Failed to get pricing', {
        provider: this.config.provider,
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private generateCacheKey(sourceText: string, options: TranslationOptions): string {
    const keyParts = [
      CacheKey.TRANSLATION_RESULT,
      this.config.provider,
      this.config.model,
      options.sourceLanguage,
      options.targetLanguage,
      sourceText
    ];
    return keyParts.join(':');
  }

  async shutdown(): Promise<void> {
    if (this.queueService) {
      await this.queueService.shutdown();
    }
    if (this.cacheService) {
      await this.cacheService.shutdown();
    }
  }

  public getPerformanceMetrics() {
    return this.performanceMonitor.getMetrics();
  }

  public getTaskMetrics() {
    return this.performanceMonitor.getTaskMetrics();
  }
} 