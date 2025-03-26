import { AIServiceConfig, AIProvider } from '../../../types/ai-service.types';
import { OpenAIAdapter } from './openai.adapter';
import { BaseAIServiceAdapter } from './base.adapter';

export class AIServiceFactory {
  private static instance: AIServiceFactory;
  private adapters: Map<AIProvider, BaseAIServiceAdapter>;

  private constructor() {
    this.adapters = new Map();
  }

  static getInstance(): AIServiceFactory {
    if (!AIServiceFactory.instance) {
      AIServiceFactory.instance = new AIServiceFactory();
    }
    return AIServiceFactory.instance;
  }

  createAdapter(config: AIServiceConfig): BaseAIServiceAdapter {
    const { provider } = config;

    // 检查是否已存在适配器实例
    if (this.adapters.has(provider)) {
      return this.adapters.get(provider)!;
    }

    // 创建新的适配器实例
    let adapter: BaseAIServiceAdapter;
    switch (provider) {
      case AIProvider.OPENAI:
        adapter = new OpenAIAdapter(config);
        break;
      // 后续添加其他 AI 服务提供商
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    // 缓存适配器实例
    this.adapters.set(provider, adapter);
    return adapter;
  }

  removeAdapter(provider: AIProvider): void {
    this.adapters.delete(provider);
  }

  getAdapter(provider: AIProvider): BaseAIServiceAdapter | undefined {
    return this.adapters.get(provider);
  }
} 