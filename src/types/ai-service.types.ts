import { TranslationOptions } from './translation.types';

// AI 服务提供商
export enum AIProvider {
  OPENAI = 'openai',
  GROK = 'grok',
  DEEPSEEK = 'deepseek',
  BAIDU = 'baidu',
  ALIYUN = 'aliyun'
}

// AI 模型信息
export interface AIModelInfo {
  id: string;
  name: string;
  provider: AIProvider;
  maxTokens: number;
  capabilities: string[];
  pricing: {
    input: number;  // 每1000个token的价格
    output: number; // 每1000个token的价格
  };
}

// AI 服务配置
export interface AIServiceConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  timeout?: number;
}

// AI 服务响应
export interface AIServiceResponse {
  translatedText: string;
  metadata: {
    provider: AIProvider;
    model: string;
    processingTime: number;
    confidence: number;
    wordCount: number;
    characterCount: number;
    tokens: {
      input: number;
      output: number;
    };
  };
}

// AI 服务错误
export interface AIServiceError {
  code: string;
  message: string;
  provider: AIProvider;
  details?: any;
}

// AI 服务适配器接口
export interface IAIServiceAdapter {
  translateText(sourceText: string, options: TranslationOptions): Promise<AIServiceResponse>;
  validateApiKey(): Promise<boolean>;
  getAvailableModels(): Promise<AIModelInfo[]>;
  getModelInfo(modelId: string): Promise<AIModelInfo>;
  getPricing(modelId: string): Promise<{
    input: number;
    output: number;
  }>;
} 