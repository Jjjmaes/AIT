import { Service } from 'typedi';
import { 
  AIServiceConfig, 
  AIProvider, 
  IAIServiceAdapter 
} from '../../../types/ai-service.types';
import { BaseAIServiceAdapter } from './base.adapter';
import { OpenAIAdapter } from './openai.adapter';
import { GrokAdapter } from './grok.adapter';
import { ReviewAdapter } from './review.adapter';
import logger from '../../../utils/logger';

/**
 * AI服务工厂类 - 单例模式 (Managed by TypeDI)
 */
@Service()
export class AIServiceFactory {
  private adapters: Map<AIProvider, BaseAIServiceAdapter>;
  private reviewAdapters: Map<AIProvider, ReviewAdapter>;

  constructor() {
    this.adapters = new Map();
    this.reviewAdapters = new Map();
    logger.info('[AIServiceFactory] Instance created by TypeDI.');
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
  public getAdapter(provider: AIProvider, config?: AIServiceConfig): BaseAIServiceAdapter {
    // If config is provided, always create a new instance
    if (config) {
        logger.info(`Creating new adapter instance for ${provider} with specific config.`);
        config.provider = provider; // Ensure provider is set in config
        switch (provider) {
            case AIProvider.OPENAI:
                return new OpenAIAdapter(config);
            case AIProvider.GROK: // Added Grok case
                return new GrokAdapter(config);
            // Add cases for other providers like GOOGLE, DEEPSEEK etc.
            default:
                throw new Error(`Unsupported AI provider for specific config creation: ${provider}`);
        }
    }

    // Use singleton based on provider type if no specific config
    if (!this.adapters.has(provider)) {
        logger.info(`Creating singleton adapter instance for ${provider}.`);
        // Load default config for the provider (logic might vary)
        // This assumes a mechanism to load default API keys etc.
        const defaultConfig = this.loadDefaultConfigForProvider(provider);
        
        let adapter: BaseAIServiceAdapter;
        switch (provider) {
            case AIProvider.OPENAI:
                adapter = new OpenAIAdapter(defaultConfig);
                break;
            case AIProvider.GROK: // Added Grok case
                 adapter = new GrokAdapter(defaultConfig);
                 break;
            // Add cases for other providers
            default:
                throw new Error(`Unsupported AI provider for singleton creation: ${provider}`);
        }
        this.adapters.set(provider, adapter);
    }

    const adapterInstance = this.adapters.get(provider);
    if (!adapterInstance) {
         // This should theoretically not happen if the above logic is sound
        throw new Error(`Failed to get or create adapter instance for ${provider}`);
    }
    return adapterInstance;
  }

  // Placeholder for loading default config - implement based on your config strategy
  private loadDefaultConfigForProvider(provider: AIProvider): AIServiceConfig {
      logger.warn(`[AIServiceFactory] loadDefaultConfigForProvider called for ${provider}. Using potentially insecure defaults or environment variables.`);
      // Example: Load from environment variables or a config file
      // IMPORTANT: Securely manage API keys (e.g., use process.env)
      let apiKey: string | undefined;
      let defaultModel: string | undefined;

      switch (provider) {
          case AIProvider.OPENAI:
              apiKey = process.env.OPENAI_API_KEY;
              defaultModel = process.env.OPENAI_DEFAULT_MODEL || 'gpt-3.5-turbo';
              break;
          case AIProvider.GROK:
              apiKey = process.env.GROK_API_KEY; // Use GROK_API_KEY from env
              defaultModel = process.env.GROK_DEFAULT_MODEL || 'grok-3-latest';
              break;
          // Add cases for other providers
          default:
              throw new Error(`Default configuration loading not implemented for provider: ${provider}`);
      }

      if (!apiKey) {
           throw new Error(`API key environment variable not found for provider: ${provider}`);
      }

      return {
          provider,
          apiKey,
          defaultModel
      };
  }

  /**
   * 获取审校适配器
   */
  public getReviewAdapter(provider: AIProvider): ReviewAdapter | undefined {
    return this.reviewAdapters.get(provider);
  }
}