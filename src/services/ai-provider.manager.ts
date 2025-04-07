import OpenAI from 'openai';
import { TranslationOptions, IAIProviderManager } from './types';
import logger from '../utils/logger';

export class AIProviderManager implements IAIProviderManager {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async translateText(text: string, options: TranslationOptions): Promise<string> {
    try {
      const prompt = this.buildPrompt(text, options);
      const response = await this.openai.chat.completions.create({
        model: options.aiModel || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      logger.error('Translation error:', error);
      throw error;
    }
  }

  async translateBatch(texts: string[], options: TranslationOptions): Promise<string[]> {
    const results = await Promise.all(
      texts.map(text => this.translateText(text, options))
    );
    return results;
  }

  private buildPrompt(text: string, options: TranslationOptions): string {
    return `Translate the following text from ${options.sourceLanguage} to ${options.targetLanguage}:
${options.domain ? `Domain: ${options.domain}\n` : ''}
Text to translate:
${text}

Please provide only the translation without any additional text or explanations.`;
  }
} 