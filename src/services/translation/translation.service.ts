import { AIServiceFactory } from './ai-adapters/ai-service.factory';
import { AIServiceConfig, AIProvider } from '../../types/ai-service.types';
import { TranslationOptions } from '../../types/translation.types';
import { AIServiceResponse } from '../../types/ai-service.types';
import logger from '../../utils/logger';

export class TranslationService {
  private aiServiceFactory: AIServiceFactory;
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.aiServiceFactory = AIServiceFactory.getInstance();
  }

  async translateText(sourceText: string, options: TranslationOptions): Promise<AIServiceResponse> {
    try {
      // 获取 AI 服务适配器
      const adapter = this.aiServiceFactory.createAdapter(this.config);

      // 执行翻译
      const result = await adapter.translateText(sourceText, options);

      // 记录翻译结果
      logger.info('Translation completed', {
        provider: this.config.provider,
        model: this.config.model,
        sourceLength: sourceText.length,
        targetLength: result.translatedText.length,
        processingTime: result.metadata.processingTime
      });

      return result;
    } catch (error) {
      logger.error('Translation failed', {
        provider: this.config.provider,
        model: this.config.model,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async translateMultipleSegments(segments: string[], options: TranslationOptions): Promise<AIServiceResponse[]> {
    try {
      // 获取 AI 服务适配器
      const adapter = this.aiServiceFactory.createAdapter(this.config);

      // 并行翻译所有段落
      const translationPromises = segments.map(segment =>
        adapter.translateText(segment, options)
      );

      const results = await Promise.all(translationPromises);

      // 记录翻译结果
      logger.info('Multiple segments translation completed', {
        provider: this.config.provider,
        model: this.config.model,
        segmentCount: segments.length,
        totalProcessingTime: results.reduce((sum, result) => sum + result.metadata.processingTime, 0)
      });

      return results;
    } catch (error) {
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
    try {
      const adapter = this.aiServiceFactory.createAdapter(this.config);
      return await adapter.validateApiKey();
    } catch (error) {
      logger.error('API key validation failed', {
        provider: this.config.provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const adapter = this.aiServiceFactory.createAdapter(this.config);
      const models = await adapter.getAvailableModels();
      return models.map(model => model.id);
    } catch (error) {
      logger.error('Failed to get available models', {
        provider: this.config.provider,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getModelInfo(modelId: string): Promise<any> {
    try {
      const adapter = this.aiServiceFactory.createAdapter(this.config);
      return await adapter.getModelInfo(modelId);
    } catch (error) {
      logger.error('Failed to get model info', {
        provider: this.config.provider,
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getPricing(modelId: string): Promise<{ input: number; output: number }> {
    try {
      const adapter = this.aiServiceFactory.createAdapter(this.config);
      return await adapter.getPricing(modelId);
    } catch (error) {
      logger.error('Failed to get pricing', {
        provider: this.config.provider,
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
} 