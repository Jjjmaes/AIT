import { IAIServiceAdapter, AIServiceConfig, AIServiceResponse, AIModelInfo, AIServiceError } from '../../../types/ai-service.types';
import { TranslationOptions } from '../../../types/translation.types';
import { AIProvider } from '../../../types/ai-service.types';

// Force export AIModelInfo (even if imported)
export type { AIModelInfo };

// Define a generic structure for chat messages
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Define a generic structure for the response needed from chat completion
export interface ChatCompletionResponse {
  content: string | null; // The main response message content
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string; // The model actually used
  error?: string; // Optional error message
}

// Response structure for translation
export interface TranslationResponse {
  translatedText: string;
  tokenCount?: { input: number; output: number; total: number };
  processingTime?: number;
  modelInfo: { provider: string; model: string };
  error?: string;
}

// Base interface for translation adapters
export interface ITranslationServiceAdapter {
  translateText(
    sourceText: string, 
    promptData: any, // Type for processed prompt data needed
    options?: TranslationOptions & { model?: string; temperature?: number } // Allow specific model/temp override
  ): Promise<TranslationResponse>;
  
  executeChatCompletion(
    messages: ChatMessage[],
    options: { model?: string; temperature?: number; max_tokens?: number; /* other relevant options */ }
  ): Promise<ChatCompletionResponse>;

  getAvailableModels?(): Promise<AIModelInfo[]>;
}

export abstract class BaseAIServiceAdapter implements ITranslationServiceAdapter {
  protected config: AIServiceConfig;
  protected provider: AIProvider;

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.provider = config.provider;
  }

  abstract translateText(sourceText: string, promptData: any, options?: TranslationOptions & { model?: string; temperature?: number }): Promise<TranslationResponse>;
  abstract validateApiKey(): Promise<boolean>;
  abstract getAvailableModels(): Promise<AIModelInfo[]>;

  // New method for direct chat completion
  abstract executeChatCompletion(
    messages: ChatMessage[],
    options: { model?: string; temperature?: number; max_tokens?: number; /* other relevant options */ }
  ): Promise<ChatCompletionResponse>;

  protected createError(code: string, message: string, details?: any): Error {
    const error = new Error(message);
    (error as any).code = code;
    (error as any).provider = this.provider;
    (error as any).details = details;
    return error;
  }

  protected calculateWordCount(text: string): number {
    if (!text.trim()) {
      return 0;
    }
    return text.trim().split(/\s+/).length;
  }

  protected calculateCharacterCount(text: string): number {
    return text.length;
  }

  protected async buildPrompt(sourceText: string, options: TranslationOptions): Promise<string> {
    const { sourceLanguage, targetLanguage, preserveFormatting, useTerminology } = options;
    
    let prompt = `Translate the following text from ${sourceLanguage} to ${targetLanguage}:\n\n`;
    
    if (preserveFormatting) {
      prompt += 'Please preserve all formatting, including line breaks, spaces, and special characters.\n\n';
    }
    
    if (useTerminology) {
      prompt += 'Please use the provided terminology if available.\n\n';
    }
    
    prompt += `Source text:\n${sourceText}\n\n`;
    prompt += 'Translation:';
    
    return prompt;
  }
} 