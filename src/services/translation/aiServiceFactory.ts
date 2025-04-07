import { AIServiceConfig, AIProvider } from '../../types/ai-service.types';
import { BaseAIServiceAdapter, ITranslationServiceAdapter } from './ai-adapters/base.adapter';
import { OpenAIAdapter } from './ai-adapters/openai.adapter';
// Import other adapters as needed
import { ReviewAdapter as IReviewAdapter } from './ai-adapters/review.adapter'; // Import the ReviewAdapter interface
import logger from '../../utils/logger';
import process from 'process'; // Import process for env vars

// Combined type for adapters that handle both
// Note: Ensure OpenAIAdapter actually implements all methods from both interfaces
type TranslationAndReviewAdapter = ITranslationServiceAdapter & IReviewAdapter;

export interface IAIServiceFactory {
  getTranslationAdapter(provider?: AIProvider | string, config?: AIServiceConfig): ITranslationServiceAdapter;
  getReviewAdapter(provider?: AIProvider | string, config?: AIServiceConfig): IReviewAdapter;
}

class AIServiceFactory implements IAIServiceFactory {
  private static instance: AIServiceFactory;
  // Use a single map storing the combined type
  private adapters: Map<string, TranslationAndReviewAdapter> = new Map();

  private constructor() { }

  public static getInstance(): AIServiceFactory {
    if (!AIServiceFactory.instance) {
      AIServiceFactory.instance = new AIServiceFactory();
    }
    return AIServiceFactory.instance;
  }

  // Adjust constructor type to expect the combined type
  private getOrCreateAdapter(
    provider: AIProvider,
    adapterMap: Map<string, TranslationAndReviewAdapter>,
    // Constructor should produce an object satisfying the combined type
    adapterConstructor: new (config: AIServiceConfig) => TranslationAndReviewAdapter,
    adapterTypeName: string,
    config?: AIServiceConfig
  ): TranslationAndReviewAdapter {
    // If specific config provided, always create new
    if (config) {
        logger.info(`Creating new ${adapterTypeName} instance for ${provider} with specific config.`);
        config.provider = provider;
        const adapter = new adapterConstructor(config);
        adapterMap.set(provider, adapter);
        return adapter;
    }

    // Use singleton based on provider type
    if (!adapterMap.has(provider)) {
        logger.info(`Creating singleton ${adapterTypeName} instance for ${provider}.`);
        const defaultConfig = this.loadDefaultConfig(provider);
        if (!defaultConfig) {
            throw new Error(`Default configuration not found for AI provider: ${provider}`);
        }
        const adapter = new adapterConstructor(defaultConfig);
        adapterMap.set(provider, adapter);
    }
    const adapterInstance = adapterMap.get(provider);
    if (!adapterInstance) {
        throw new Error(`Failed to get or create ${adapterTypeName} for ${provider}`);
    }
    return adapterInstance;
  }

  private loadDefaultConfig(provider: AIProvider): AIServiceConfig | null {
    switch (provider) {
      case AIProvider.OPENAI:
        const apiKey = process.env.OPENAI_API_KEY;
        const defaultModel = process.env.OPENAI_DEFAULT_MODEL;
        if (!apiKey) {
          logger.error('OPENAI_API_KEY environment variable not set.');
          return null;
        }
        return {
          provider: AIProvider.OPENAI,
          apiKey: apiKey,
          defaultModel: defaultModel
        };
      // Add other providers here
      default:
        logger.warn(`Default config loader not implemented for provider: ${provider}`);
        return null;
    }
  }

  public getTranslationAdapter(provider: AIProvider | string = AIProvider.OPENAI, config?: AIServiceConfig): ITranslationServiceAdapter {
    const providerEnum = provider as AIProvider;
    switch (providerEnum) {
      case AIProvider.OPENAI:
        // Pass OpenAIAdapter constructor, assuming it fits the combined type constructor signature
        return this.getOrCreateAdapter(providerEnum, this.adapters, OpenAIAdapter as any, 'Adapter', config);
      default:
        throw new Error(`Unsupported translation provider: ${provider}`);
    }
  }

  public getReviewAdapter(provider: AIProvider | string = AIProvider.OPENAI, config?: AIServiceConfig): IReviewAdapter {
    const providerEnum = provider as AIProvider;
    switch (providerEnum) {
      case AIProvider.OPENAI:
        // Pass OpenAIAdapter constructor, assuming it fits the combined type constructor signature
        return this.getOrCreateAdapter(providerEnum, this.adapters, OpenAIAdapter as any, 'Adapter', config);
      default:
        throw new Error(`Unsupported review provider: ${provider}`);
    }
  }
}

export const aiServiceFactory = AIServiceFactory.getInstance(); 