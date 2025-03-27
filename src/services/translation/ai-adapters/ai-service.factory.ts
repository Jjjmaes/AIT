import { 
  AIServiceConfig, 
  AIProvider, 
  IAIServiceAdapter 
} from '../../../types/ai-service.types';
import { BaseAIServiceAdapter } from './base.adapter';
import { OpenAIAdapter } from './openai.adapter';
import { ReviewAdapter } from './review.adapter';
import logger from '../../../utils/logger';

/**
 * AI服务工厂类 - 单例模式
 */
export class AIServiceFactory {
  private static instance: AIServiceFactory;
  private adapters: Map<AIProvider, BaseAIServiceAdapter>;
  private reviewAdapters: Map<AIProvider, ReviewAdapter>;

  private constructor() {
    this.adapters = new Map();
    this.reviewAdapters = new Map();
  }

  public static getInstance(): AIServiceFactory {
    if (!AIServiceFactory.instance) {
      AIServiceFactory.instance = new AIServiceFactory();
    }
    return AIServiceFactory.instance;
  }

  /**
   * 创建或获取AI服务适配器
   */
  public createAdapter(config: AIServiceConfig): BaseAIServiceAdapter {
    const { provider } = config;
    
    // 检查是否已有该提供商的适配器实例
    if (this.adapters.has(provider)) {
      const adapter = this.adapters.get(provider);
      if (adapter) {
        logger.info(`Using existing AI adapter for provider: ${provider}`);
        return adapter;
      }
    }
    
    // 创建新的适配器实例
    let adapter: BaseAIServiceAdapter;
    
    switch (provider) {
      case AIProvider.OPENAI:
        adapter = new OpenAIAdapter(config);
        break;
      // 后续可以添加其他AI服务提供商的支持
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
    
    // 存储适配器实例
    this.adapters.set(provider, adapter);
    logger.info(`Created new AI adapter for provider: ${provider}`);
    
    return adapter;
  }

  /**
   * 创建或获取AI审校适配器
   */
  public createReviewAdapter(config: AIServiceConfig): ReviewAdapter {
    const { provider } = config;
    
    // 检查是否已有该提供商的审校适配器实例
    if (this.reviewAdapters.has(provider)) {
      const adapter = this.reviewAdapters.get(provider);
      if (adapter) {
        logger.info(`Using existing AI review adapter for provider: ${provider}`);
        return adapter;
      }
    }
    
    // 创建新的审校适配器实例
    let adapter: ReviewAdapter;
    
    switch (provider) {
      case AIProvider.OPENAI:
        adapter = new ReviewAdapter(config);
        break;
      // 后续可以添加其他AI服务提供商的支持
      default:
        throw new Error(`Unsupported AI provider for review: ${provider}`);
    }
    
    // 存储适配器实例
    this.reviewAdapters.set(provider, adapter);
    logger.info(`Created new AI review adapter for provider: ${provider}`);
    
    return adapter;
  }

  /**
   * 移除适配器
   */
  public removeAdapter(provider: AIProvider): void {
    if (this.adapters.has(provider)) {
      this.adapters.delete(provider);
      logger.info(`Removed AI adapter for provider: ${provider}`);
    }
    
    if (this.reviewAdapters.has(provider)) {
      this.reviewAdapters.delete(provider);
      logger.info(`Removed AI review adapter for provider: ${provider}`);
    }
  }

  /**
   * 获取适配器
   */
  public getAdapter(provider: AIProvider): BaseAIServiceAdapter | undefined {
    return this.adapters.get(provider);
  }

  /**
   * 获取审校适配器
   */
  public getReviewAdapter(provider: AIProvider): ReviewAdapter | undefined {
    return this.reviewAdapters.get(provider);
  }
} 