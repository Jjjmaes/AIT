import { OpenAI } from 'openai';
import { 
  AIModelInfo, 
  AIProvider, 
  AIServiceConfig, 
  AIServiceError, 
  AIServiceResponse 
} from '../../../types/ai-service.types';
import { 
  IssueType, 
  ReviewScoreType,
  IssueSeverity
} from '../../../models/segment.model';
import { BaseAIServiceAdapter, TranslationResponse } from './base.adapter';
import logger from '../../../utils/logger';
import { TranslationOptions } from '../../../types/translation.types';
import { encoding_for_model, TiktokenModel } from 'tiktoken';
import { ChatMessage, ChatCompletionResponse } from './base.adapter';
import { AppError } from '../../../utils/errors';

// 审校选项接口
export interface ReviewOptions extends TranslationOptions {
  originalContent: string;  // 原始内容
  translatedContent: string;  // 翻译内容
  projectId?: string;  // 项目ID
  requestedScores?: ReviewScoreType[];  // 请求评分的类型
  checkIssueTypes?: IssueType[];  // 检查问题的类型
  contextSegments?: Array<{  // 上下文段落
    original: string;
    translation: string;
  }>;
  customPrompt?: string;  // 自定义提示词
}

// Define the structure for issues returned by the AI review adapter
export interface AIReviewIssue {
  type: IssueType;
  description: string;
  position?: { start: number; end: number };
  suggestion?: string;
  severity?: IssueSeverity; // Add optional severity
}

// 审校结果接口
export interface AIReviewResponse {
  suggestedTranslation: string;  // 建议翻译
  issues: AIReviewIssue[]; // Use the updated issue type
  scores: Array<{
    type: ReviewScoreType;
    score: number;
    details?: string;
  }>;
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
    modificationDegree: number;  // 修改程度 (0-1)
  };
}

// Define a temporary inline type for review response
type TempReviewResponse = { score: number; comments: string; error?: string; needsManualReview?: boolean };

/**
 * OpenAI 审校适配器
 */
export class ReviewAdapter extends BaseAIServiceAdapter {
  private client: OpenAI;
  private static readonly AVAILABLE_MODELS: AIModelInfo[] = [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      provider: AIProvider.OPENAI,
      maxTokens: 8192,
      capabilities: ['review', 'translation'],
      pricing: {
        input: 0.03,
        output: 0.06
      }
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: AIProvider.OPENAI,
      maxTokens: 128000,
      capabilities: ['review', 'translation'],
      pricing: {
        input: 0.01,
        output: 0.03
      }
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: AIProvider.OPENAI,
      maxTokens: 16385,
      capabilities: ['review', 'translation'],
      pricing: {
        input: 0.0005,
        output: 0.0015
      }
    }
  ];

  constructor(config: AIServiceConfig) {
    super(config);
    
    // 初始化 OpenAI 客户端
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeout || 60000,
    });
  }

  /**
   * Calculate the number of tokens for a given text and model using tiktoken.
   * Handles potential model name mismatches and falls back to a default if needed.
   */
  private calculateTokens(text: string, model: string): number {
    try {
      // Attempt to get encoding for the specific model
      // Handle cases where the API model name might not directly match TiktokenModel
      let encodingModel: TiktokenModel;
      if (model.startsWith('gpt-4')) {
          encodingModel = 'gpt-4'; // Use base model for encoding
      } else if (model.startsWith('gpt-3.5-turbo')) {
          encodingModel = 'gpt-3.5-turbo';
      } else {
           logger.warn(`Unsupported model ${model} for tiktoken calculation, falling back to gpt-3.5-turbo encoding.`);
          encodingModel = 'gpt-3.5-turbo'; // Default fallback
      }

      const encoder = encoding_for_model(encodingModel);
      const tokens = encoder.encode(text).length;
      encoder.free(); // Free up memory
      return tokens;
    } catch (error) {
      logger.error('Tiktoken calculation failed, falling back to estimation', { error, model });
      // Fallback to rough estimation if tiktoken fails
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * 计算文本中的单词数量
   */
  private countWords(text: string): number {
    // 简单的计算方法：按照空格分割
    return text.trim().split(/\s+/).length;
  }

  /**
   * 构建审校提示词
   */
  private buildReviewPrompt(options: ReviewOptions): string {
    const {
      sourceLanguage,
      targetLanguage,
      originalContent,
      translatedContent,
      contextSegments = [],
      customPrompt
    } = options;

    // 如果有自定义提示词，则使用自定义提示词
    if (customPrompt) {
      return customPrompt
        .replace('{SOURCE_LANGUAGE}', sourceLanguage)
        .replace('{TARGET_LANGUAGE}', targetLanguage)
        .replace('{ORIGINAL_CONTENT}', originalContent)
        .replace('{TRANSLATED_CONTENT}', translatedContent);
    }

    let context = '';
    if (contextSegments.length > 0) {
      context = '上下文段落：\n';
      contextSegments.forEach((segment, index) => {
        context += `[段落 ${index + 1}]\n原文：${segment.original}\n译文：${segment.translation}\n\n`;
      });
    }

    return `
你是一位专业的翻译审校专家，精通${sourceLanguage}和${targetLanguage}。
请审校以下翻译，提供详细的问题分析和改进建议。
使用JSON格式回复，包含以下内容：

1. 原文内容：
${originalContent}

2. 当前翻译：
${translatedContent}

${context}

请分析以下几个方面：
1. 准确性：译文是否准确传达了原文的所有信息和含义
2. 流畅度：译文是否符合目标语言的表达习惯，是否自然流畅
3. 术语一致性：专业术语和关键词的翻译是否准确一致
4. 语法和拼写：是否存在语法错误或拼写错误
5. 风格一致性：译文风格是否与原文一致

请按照以下JSON格式回复，仅返回JSON数据：

{
  "suggestedTranslation": "你认为的最佳翻译",
  "issues": [
    {
      "type": "问题类型(accuracy/grammar/terminology/style/consistency/formatting/other)",
      "description": "问题描述",
      "position": {
        "start": 问题在译文中的起始位置(数字),
        "end": 问题在译文中的结束位置(数字)
      },
      "suggestion": "修改建议"
    }
  ],
  "scores": [
    {
      "type": "overall",
      "score": 评分(0-100),
      "details": "评分理由"
    },
    {
      "type": "accuracy",
      "score": 评分(0-100),
      "details": "评分理由"
    },
    {
      "type": "fluency",
      "score": 评分(0-100),
      "details": "评分理由"
    },
    {
      "type": "terminology",
      "score": 评分(0-100),
      "details": "评分理由"
    },
    {
      "type": "style",
      "score": 评分(0-100),
      "details": "评分理由"
    }
  ]
}

请确保返回的JSON格式规范，可以被直接解析。不要包含任何JSON以外的说明文字。
`;
  }

  /**
   * 计算修改程度
   * 返回一个0-1之间的数值，表示修改的程度
   */
  private calculateModificationDegree(original: string, modified: string): number {
    if (!original || !modified) return 0;
    
    // 简单的字符级别差异计算
    let changes = 0;
    const maxLength = Math.max(original.length, modified.length);
    const minLength = Math.min(original.length, modified.length);
    
    // 长度差异
    changes += maxLength - minLength;
    
    // 字符差异
    for (let i = 0; i < minLength; i++) {
      if (original[i] !== modified[i]) {
        changes++;
      }
    }
    
    return Math.min(1, changes / maxLength);
  }

  /**
   * 执行审校
   */
  async reviewText(
    options: ReviewOptions
  ): Promise<AIReviewResponse> {
    const startTime = Date.now();
    
    try {
      const { translatedContent } = options;
      const prompt = this.buildReviewPrompt(options);
      const modelToUse = this.config.model; // Get the specific model being used
      
      // 计算输入token数 using the specific model
      const inputTokens = this.calculateTokens(prompt, modelToUse);
      
      // 调用OpenAI API
      const response = await this.client.chat.completions.create({
        model: modelToUse,
        messages: [
          { role: 'system', content: 'You are a professional translation reviewer. Respond only with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: this.config.temperature || 0.3,
        max_tokens: this.config.maxTokens || 4000,
        top_p: this.config.topP || 1,
        frequency_penalty: this.config.frequencyPenalty || 0,
        presence_penalty: this.config.presencePenalty || 0,
        response_format: { type: 'json_object' }
      });
      
      // 提取响应内容
      const content = response.choices[0]?.message?.content || '';
      
      // 解析JSON
      let reviewResult: any;
      try {
        reviewResult = JSON.parse(content);
      } catch (error) {
        logger.error('Failed to parse AI review response', { error, content });
        throw this.createError('PARSE_ERROR', 'Failed to parse AI review response');
      }
      
      // 处理返回数据
      const outputTokens = response.usage?.completion_tokens ?? this.calculateTokens(content, modelToUse);
      const actualInputTokens = response.usage?.prompt_tokens ?? inputTokens; // Prefer API response
      const processingTime = Date.now() - startTime;
      
      // 计算修改程度
      const modificationDegree = this.calculateModificationDegree(
        translatedContent,
        reviewResult.suggestedTranslation
      );

      // Filter results based on request options (fallback/safety measure)
      let finalIssues = reviewResult.issues || [];
      if (options.checkIssueTypes?.length) {
        finalIssues = finalIssues.filter((issue: AIReviewIssue) => 
          options.checkIssueTypes?.includes(issue.type)
        );
      }
      
      let finalScores = reviewResult.scores || [];
      if (options.requestedScores?.length) {
        finalScores = finalScores.filter((score: { type: ReviewScoreType; score: number; details?: string }) =>
          options.requestedScores?.includes(score.type)
        );
      }
      
      // 构建响应 using actual/calculated tokens
      const result: AIReviewResponse = {
        suggestedTranslation: reviewResult.suggestedTranslation || translatedContent,
        issues: finalIssues, 
        scores: finalScores, 
        metadata: {
          provider: this.config.provider,
          model: modelToUse,
          processingTime,
          confidence: 0.85, 
          wordCount: this.countWords(translatedContent),
          characterCount: translatedContent.length,
          tokens: {
            input: actualInputTokens, // Use potentially more accurate count from API
            output: outputTokens
          },
          modificationDegree
        }
      };
      
      return result;
      
    } catch (error: any) {
      logger.error('Error during AI review', { error });
      
      // 处理OpenAI API错误
      let errorCode = 'REVIEW_ERROR';
      let errorMessage = 'Failed to review text';
      
      if (error.status === 401) {
        errorCode = 'INVALID_API_KEY';
        errorMessage = 'Invalid API key';
      } else if (error.status === 429) {
        errorCode = 'RATE_LIMIT_EXCEEDED';
        errorMessage = 'Rate limit exceeded';
      } else if (error.status === 500) {
        errorCode = 'SERVICE_UNAVAILABLE';
        errorMessage = 'Service unavailable';
      }
      
      throw this.createError(errorCode, errorMessage, error);
    }
  }

  /**
   * 实现基类的必需方法（为审校服务提供转换）
   */
  async translateText(
    sourceText: string, 
    promptData: any, // Use promptData from base
    options?: TranslationOptions & { model?: string; temperature?: number }
  ): Promise<TranslationResponse> { 
    logger.warn('translateText called on ReviewAdapter. This might indicate a design issue.');
    
    const modelToUse = options?.model || this.config.defaultModel || 'gpt-3.5-turbo';
    const temp = options?.temperature ?? 0.3;
    const startTime = Date.now();
    
    try {
      const completion = await this.client.chat.completions.create({
        model: modelToUse,
        messages: [
            { role: 'system', content: promptData?.systemInstruction || 'Translate the following text.' },
            { role: 'user', content: promptData?.userPrompt || sourceText }
        ],
        temperature: temp,
      });

      const translatedText = completion.choices[0]?.message?.content || '';
      const processingTime = Date.now() - startTime;
      const tokenCount = completion.usage ? { 
          input: completion.usage.prompt_tokens, 
          output: completion.usage.completion_tokens, 
          total: completion.usage.total_tokens 
      } : undefined;

      return {
        translatedText,
        tokenCount,
        processingTime,
        modelInfo: { provider: this.provider.toString(), model: modelToUse }
      };
    } catch (error) {
        logger.error('Error during translateText in ReviewAdapter:', error);
        throw this.createError('TRANSLATION_FAILED', 'translateText failed in ReviewAdapter', error);
    }
  }

  /**
   * 验证API密钥
   */
  async validateApiKey(): Promise<boolean> {
    try {
      // 简单调用模型列表API来验证API密钥
      await this.client.models.list();
      return true;
    } catch (error: any) {
      logger.error('API key validation failed', { error });
      return false;
    }
  }

  /**
   * 获取可用模型列表
   */
  async getAvailableModels(): Promise<AIModelInfo[]> {
    return ReviewAdapter.AVAILABLE_MODELS;
  }

  /**
   * 获取特定模型信息
   */
  getModelInfo(modelId: string): Promise<AIModelInfo> {
    const model = ReviewAdapter.AVAILABLE_MODELS.find(model => model.id === modelId);
    
    if (!model) {
      throw this.createError('MODEL_NOT_FOUND', `Model ${modelId} not found`);
    }
    
    return Promise.resolve(model);
  }

  /**
   * 获取价格信息
   */
  getPricing(modelId: string): Promise<{ input: number; output: number }> {
    const model = ReviewAdapter.AVAILABLE_MODELS.find(model => model.id === modelId);
    
    if (!model) {
      throw this.createError('MODEL_NOT_FOUND', `Model ${modelId} not found`);
    }
    
    return Promise.resolve(model.pricing);
  }

  // Implement the abstract method from the base class
  async executeChatCompletion(
      messages: ChatMessage[],
      options: { model?: string; temperature?: number; max_tokens?: number; }
  ): Promise<ChatCompletionResponse> {
      logger.error('executeChatCompletion method called on ReviewAdapter, which is not supported.');
      throw new AppError('General chat completion is not supported by the Review adapter.', 501);
  }

  // Specific method for performing review (Ensure only one implementation exists)
  async reviewTranslation(
      sourceText: string, 
      translatedText: string, 
      reviewOptions: any 
  ): Promise<TempReviewResponse> {
      logger.info(`ReviewAdapter: Starting review for source: "${sourceText.substring(0, 50)}..."`);
      
      // 1. Construct prompt
      const reviewPromptMessages: ChatMessage[] = [
          { role: 'system', content: 'You are a translation quality reviewer. Evaluate the provided translation based on accuracy, fluency, and adherence to instructions.' },
          { role: 'user', content: `Source: ${sourceText}\nTranslation: ${translatedText}\n\nPlease provide a quality score (1-5) and brief comments.` }
      ];

      // 2. Define completion options
      const completionOptions = {
          model: this.config.defaultModel || 'gpt-4', 
          temperature: 0.2, 
          max_tokens: 500 
      };

      // 3. Call AI service (Using temporary workaround logic from previous attempt)
      let response: ChatCompletionResponse;
      try {
          logger.warn('ReviewAdapter cannot directly call executeChatCompletion currently. Needs refactoring.');
          response = { content: null, model: completionOptions.model, error: 'Review mechanism needs refactoring.' };
          // Handle different providers if needed
          if (this.config.provider !== AIProvider.OPENAI) { // Example check
               response = { content: null, model: completionOptions.model, error: `Review not supported for provider ${this.config.provider}` };
          }
      } catch (error: any) {
          logger.error(`ReviewAdapter: Error during AI call: ${error.message}`, error);
          // Ensure return type matches TempReviewResponse
          return { score: 0, comments: 'Error during review process', error: error.message, needsManualReview: true }; 
      }

      // 4. Parse response
      if (response.error || !response.content) {
           logger.error(`ReviewAdapter: AI service returned error or empty content: ${response.error || 'Empty content'}`);
          // Ensure return type matches TempReviewResponse
          return { score: 0, comments: 'Failed to get review from AI', error: response.error || 'Empty content', needsManualReview: true }; 
      }
      
      const reviewText = response.content;
      let score = 0;
      let comments = 'Could not parse review.';
      try {
           // ... parsing logic ...
      } catch (parseError) {
          logger.error('ReviewAdapter: Failed to parse review response:', parseError);
      }

      logger.info(`ReviewAdapter: Review completed. Score: ${score}`);
      // Ensure return type matches TempReviewResponse (needsManualReview might depend on score/parsing)
      return { score, comments, needsManualReview: score < 3 }; 
  } 
} 