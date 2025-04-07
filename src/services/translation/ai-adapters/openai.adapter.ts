import { OpenAI } from 'openai';
import { TranslationOptions } from '../../../types/translation.types';
import { BaseAIServiceAdapter, TranslationResponse, AIModelInfo } from './base.adapter';
import { ReviewAdapter, AIReviewResponse, AIReviewIssue } from './review.adapter';
import { IssueSeverity, IssueType } from '../../../models/segment.model';
import { AIServiceConfig, AIProvider } from '../../../types/ai-service.types';
import logger from '../../../utils/logger';
import { AppError } from '../../../utils/errors';

// Define the structure for processed prompt data (example)
interface ProcessedPrompt {
  systemInstruction: string;
  userPrompt: string;
}

export class OpenAIAdapter extends BaseAIServiceAdapter {
  private openai: OpenAI;

  constructor(config: AIServiceConfig) {
    super(config);
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required.');
    }
    this.openai = new OpenAI({ apiKey: config.apiKey });
  }

  async translateText(
    sourceText: string,
    promptData: ProcessedPrompt,
    options?: TranslationOptions & { model?: string; temperature?: number }
  ): Promise<TranslationResponse> {
    const model = options?.model || this.config.defaultModel || 'gpt-3.5-turbo'; // Default model
    const temperature = options?.temperature ?? 0.3; // Default temperature
    const startTime = Date.now();

    try {
      logger.debug(`Calling OpenAI translation: model=${model}, temp=${temperature}`);
      const completion = await this.openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: promptData.systemInstruction },
          { role: 'user', content: promptData.userPrompt }, // Assuming userPrompt contains the source text
        ],
        temperature: temperature,
        // Add other parameters like max_tokens if needed
      });
      
      const processingTime = Date.now() - startTime;
      const translatedText = completion.choices[0]?.message?.content?.trim() || '';
      const tokenCount = completion.usage ? {
          input: completion.usage.prompt_tokens,
          output: completion.usage.completion_tokens,
          total: completion.usage.total_tokens,
      } : undefined;

      logger.debug(`OpenAI translation completed in ${processingTime}ms. Tokens: ${tokenCount?.total}`);

      return {
        translatedText,
        tokenCount,
        processingTime,
        modelInfo: { provider: 'openai', model },
      };
    } catch (error: any) {
      logger.error('OpenAI translateText error:', error);
      const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown OpenAI error';
      throw new AppError(`OpenAI translation failed: ${errorMessage}`, 500);
    }
  }

  async reviewTranslation(data: {
    originalContent: string;
    translatedContent: string;
    sourceLanguage: string;
    targetLanguage: string;
    contextSegments?: Array<{ original: string; translation: string }>;
    customPrompt?: string;
    options?: any;
  }): Promise<AIReviewResponse> {
    const model = data.options?.model || this.config.defaultModel || 'gpt-4'; // Use GPT-4 for review by default
    const temperature = data.options?.temperature ?? 0.5;
    const startTime = Date.now();

    // Construct a review prompt
    const systemPrompt = data.customPrompt || `You are an expert translator reviewing a translation from ${data.sourceLanguage} to ${data.targetLanguage}. Identify issues (like terminology, grammar, style, accuracy, formatting, consistency, omission, addition) and provide a score (0-100) for accuracy and fluency. Suggest an improved translation if necessary. Respond ONLY with a JSON object containing 'suggestedTranslation' (string), 'issues' (array of {type: string, severity: string, description: string, suggestion?: string}), and 'scores' (array of {type: string, score: number}).`;
    
    let userPrompt = `Original: ${data.originalContent}\nTranslation: ${data.translatedContent}`;
    if (data.contextSegments && data.contextSegments.length > 0) {
        userPrompt += `\n\nContext:\n${data.contextSegments.map(s => `Original: ${s.original}\nTranslation: ${s.translation}`).join('\n---\n')}`;
    }

    try {
      logger.debug(`Calling OpenAI review: model=${model}, temp=${temperature}`);
      const completion = await this.openai.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: temperature,
        response_format: { type: 'json_object' }, // Force JSON output
      });

      const processingTime = Date.now() - startTime;
      const jsonResponse = completion.choices[0]?.message?.content;
      const tokenUsage = completion.usage; 
      const modelUsed = model;

      logger.debug(`OpenAI review completed in ${processingTime}ms. Tokens: ${completion.usage?.total_tokens}`);

      if (!jsonResponse) {
          throw new Error('OpenAI review returned empty content.');
      }

      // Safely parse the JSON response
      let parsedResult: Partial<AIReviewResponse> & { suggestedTranslation?: string } = {};
      try {
          parsedResult = JSON.parse(jsonResponse);
      } catch (parseError) {
          logger.error('Failed to parse OpenAI review JSON response:', jsonResponse);
          throw new Error('Failed to parse AI review response.');
      }

      // Validate and structure the response
      const validatedIssues: AIReviewIssue[] = (parsedResult.issues || []).map((issue: any) => ({
          type: Object.values(IssueType).includes(issue.type) ? issue.type : IssueType.OTHER,
          severity: Object.values(IssueSeverity).includes(issue.severity) ? issue.severity : IssueSeverity.MEDIUM,
          description: issue.description || 'No description',
          suggestion: issue.suggestion,
          position: issue.position // Pass through position if provided
      }));

      const validatedScores = (parsedResult.scores || []).filter(
          (score: any) => typeof score.type === 'string' && typeof score.score === 'number'
      );

      const suggestedTranslation = parsedResult.suggestedTranslation || data.translatedContent;
      const modificationDegree = this.calculateModificationDegree(data.translatedContent, suggestedTranslation);
      const wordCount = this.countWords(suggestedTranslation);
      const charCount = suggestedTranslation.length;
      const inputTokens = tokenUsage?.prompt_tokens || 0;
      const outputTokens = tokenUsage?.completion_tokens || 0;

      return {
        suggestedTranslation: suggestedTranslation,
        issues: validatedIssues,
        scores: validatedScores,
        metadata: {
          provider: AIProvider.OPENAI, // Use enum value
          model: modelUsed, 
          processingTime,
          confidence: 0.9, // Placeholder: OpenAI doesn't provide confidence
          wordCount: wordCount, 
          characterCount: charCount,
          tokens: { // Map token usage
            input: inputTokens,
            output: outputTokens,
          },
          modificationDegree: modificationDegree 
        },
      };

    } catch (error: any) {
      logger.error('OpenAI reviewTranslation error:', error);
      const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown OpenAI error';
      throw new AppError(`OpenAI review failed: ${errorMessage}`, 500);
    }
  }

  async getAvailableModels(): Promise<AIModelInfo[]> {
    logger.warn('getAvailableModels returning hardcoded defaults for OpenAI.');
    // Add missing required properties with default/example values
    return [
      { 
        provider: AIProvider.OPENAI, 
        id: 'gpt-4', 
        name: 'GPT-4',
        maxTokens: 8192, // Example value
        capabilities: ['translation', 'review'], // Example value
        pricing: { input: 0.03, output: 0.06 } // Example value
      }, 
      { 
        provider: AIProvider.OPENAI, 
        id: 'gpt-3.5-turbo', 
        name: 'GPT-3.5 Turbo',
        maxTokens: 16385, // Example value
        capabilities: ['translation', 'review'], // Example value
        pricing: { input: 0.0005, output: 0.0015 } // Example value
      },
    ];
  }
  
  async validateApiKey(): Promise<boolean> {
      try {
          // Make a simple, cheap API call to check if key is valid (e.g., list models)
          await this.openai.models.list(); 
          return true;
      } catch (error) {
          logger.error('OpenAI API key validation failed:', error);
          return false;
      }
  }

  // Add helper methods if they don't exist from Base class
  private countWords(text: string): number {
      return text.trim().split(/\s+/).filter(Boolean).length;
  }

  private calculateModificationDegree(original: string, modified: string): number {
      // Simple Levenshtein distance based degree (example)
      // In a real app, use a proper library like 'fast-levenshtein'
      if (!original || !modified) return 0;
      if (original === modified) return 0;
      const len1 = original.length;
      const len2 = modified.length;
      const matrix: number[][] = [];

      for (let i = 0; i <= len1; i++) matrix[i] = [i];
      for (let j = 0; j <= len2; j++) matrix[0][j] = j;

      for (let i = 1; i <= len1; i++) {
          for (let j = 1; j <= len2; j++) {
              const cost = original[i - 1] === modified[j - 1] ? 0 : 1;
              matrix[i][j] = Math.min(
                  matrix[i - 1][j] + 1,      // Deletion
                  matrix[i][j - 1] + 1,      // Insertion
                  matrix[i - 1][j - 1] + cost // Substitution
              );
          }
      }
      const distance = matrix[len1][len2];
      return distance / Math.max(len1, len2, 1); // Normalize
  }
} 