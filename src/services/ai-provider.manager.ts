import OpenAI from 'openai';
import { TranslationOptions } from './types';
import logger from '../utils/logger';
import { IAIProviderConfig } from '../models/aiConfig.model';
import { AppError } from '../utils/errors';

// Define supported AI providers
export enum AIProvider {
    OPENAI = 'openai',
    GOOGLE = 'google',
    DEEPSEEK = 'deepseek',
    GROK = 'grok' // Added Grok
    // Add more providers as needed
}

// Interface for generateReview parameters for clarity
interface GenerateReviewParams {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    // Add other common parameters if needed
    [key: string]: any; // Allow provider-specific params
}

interface GenerateReviewArgs {
    systemPrompt: string | null;
    userPrompt: string;
    params: GenerateReviewParams;
    config: IAIProviderConfig; // Pass the specific config for this call
}

export class AIProviderManager {
  // Removed openai instance variable and constructor

  // Method to generate review - takes config for this specific call
  async generateReview({ systemPrompt, userPrompt, params, config }: GenerateReviewArgs): Promise<string> {
    logger.debug(`Generating review with config: ${config.providerName}, Model: ${params.model || config.defaultModel}`);

    switch (config.providerName) {
      case AIProvider.OPENAI:
        try {
          const openai = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL || undefined, // Use baseURL from config if provided
          });

          const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
          if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
          }
          messages.push({ role: 'user', content: userPrompt });

          const requestParams: OpenAI.Chat.ChatCompletionCreateParams = {
            model: params.model || config.defaultModel || 'gpt-3.5-turbo', // Fallback model
            messages: messages,
            temperature: params.temperature ?? config.defaultParams?.temperature ?? 0.5, // Default temperature
            max_tokens: params.max_tokens ?? config.defaultParams?.maxTokens ?? 1000, // Default max tokens
            // Add other parameters from params or config.defaultParams if they exist
            // Example: top_p, frequency_penalty, presence_penalty
            // Be careful to only pass parameters supported by the specific model/API
          };

          logger.debug('OpenAI Request Params:', requestParams);

          const response = await openai.chat.completions.create(requestParams);

          const content = response.choices[0]?.message?.content;
          if (content === null || content === undefined) {
              throw new AppError('OpenAI response content is null or undefined', 500);
          }
          logger.debug('OpenAI Response Content:', content.substring(0, 100) + '...');
          return content;

        } catch (error: any) {
          logger.error(`OpenAI API error during review generation: ${error.message}`, error);
          // Improve error message context
          const errorMessage = `AI Provider (OpenAI) Error: ${error.message || 'Unknown error'}`;
          throw new AppError(errorMessage, error.status || 500);
        }

      case AIProvider.GOOGLE:
      case AIProvider.DEEPSEEK:
      case AIProvider.GROK:
        // Placeholder for other providers
        logger.error(`Provider ${config.providerName} not implemented yet for generateReview.`);
        throw new AppError(`Provider ${config.providerName} not implemented`, 501);

      default:
        logger.error(`Unsupported provider specified: ${config.providerName}`);
        throw new AppError(`Unsupported AI provider: ${config.providerName}`, 400);
    }
  }

  // --- Existing Translation Methods --- 
  // These might need refactoring later to use IAIProviderConfig similarly
  // For now, they remain using the old hardcoded OpenAI approach
  async translateText(text: string, options: TranslationOptions): Promise<string> {
    logger.warn('translateText called using legacy OpenAI implementation (process.env.OPENAI_API_KEY)');
    // Instantiate OpenAI client here for this specific call using env var
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); 
    try {
      const prompt = this.buildPrompt(text, options);
      const response = await openai.chat.completions.create({
        model: options.aiModel || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system', // Consider changing role based on prompt structure
            content: prompt 
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return response.choices[0].message.content || '';
    } catch (error: any) {
      logger.error('Translation error:', error);
      throw new AppError(`Translation Error: ${error.message}`, 500);
    }
  }

  async translateBatch(texts: string[], options: TranslationOptions): Promise<string[]> {
    // This implementation calls translateText sequentially. Consider batch API if available.
    logger.warn('translateBatch called using sequential legacy translateText calls.');
    const results = await Promise.all(
      texts.map(text => this.translateText(text, options))
    );
    return results;
  }

  private buildPrompt(text: string, options: TranslationOptions): string {
    // This is a simple translation prompt, might need adjustment
    return `Translate the following text from ${options.sourceLanguage} to ${options.targetLanguage}:
${options.domain ? `Domain: ${options.domain}\n` : ''}
Text to translate:
${text}

Please provide only the translation without any additional text or explanations.`;
  }
} 