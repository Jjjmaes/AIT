import { AIProvider, AIServiceConfig } from '../types/ai-service.types';
import { AIServiceFactory } from './translation/ai-adapters';
import { ReviewAdapter, ReviewOptions, AIReviewResponse } from './translation/ai-adapters/review.adapter';
import logger from '../utils/logger';
import { ReviewScoreType, IssueType } from '../models/segment.model';

/**
 * AI审校服务
 * 提供独立的AI审校功能，可以被其他服务或控制器调用
 */
export class AIReviewService {
  private aiServiceFactory: AIServiceFactory;

  constructor() {
    this.aiServiceFactory = AIServiceFactory.getInstance();
  }

  /**
   * 获取AI审校适配器
   */
  private getReviewAdapter(config: {
    provider: AIProvider;
    apiKey: string;
    model: string;
  }): ReviewAdapter {
    const adapterConfig: AIServiceConfig = {
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      temperature: 0.3,
      maxTokens: 4000
    };

    return this.aiServiceFactory.createReviewAdapter(adapterConfig);
  }

  /**
   * 执行文本审校
   * @param original 原文
   * @param translation 翻译
   * @param options 审校选项
   */
  async reviewTranslation(
    original: string,
    translation: string,
    options: {
      sourceLanguage: string;
      targetLanguage: string;
      provider?: AIProvider;
      model?: string;
      apiKey?: string;
      customPrompt?: string;
      requestedScores?: ReviewScoreType[];
      checkIssueTypes?: IssueType[];
      contextSegments?: Array<{
        original: string;
        translation: string;
      }>;
    }
  ): Promise<AIReviewResponse> {
    try {
      // 获取API密钥（首选传入的，否则使用环境变量）
      const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('未配置API密钥');
      }

      // 获取提供商（首选传入的，否则默认为OpenAI）
      const provider = options.provider || AIProvider.OPENAI;

      // 获取模型（首选传入的，否则使用默认值）
      const model = options.model || 'gpt-3.5-turbo';

      // 获取审校适配器
      const reviewAdapter = this.getReviewAdapter({
        provider,
        apiKey,
        model
      });

      // 构建审校选项
      const reviewOptions: ReviewOptions = {
        sourceLanguage: options.sourceLanguage,
        targetLanguage: options.targetLanguage,
        originalContent: original,
        translatedContent: translation,
        customPrompt: options.customPrompt,
        requestedScores: options.requestedScores,
        checkIssueTypes: options.checkIssueTypes,
        contextSegments: options.contextSegments
      };

      // 执行审校并返回结果
      logger.info(`Starting AI review using ${provider} model ${model}`);
      const result = await reviewAdapter.reviewText(reviewOptions);
      logger.info('AI review completed successfully');

      return result;

    } catch (error: any) {
      logger.error('AI review failed', { error });
      throw new Error(`AI审校失败: ${error.message}`);
    }
  }

  /**
   * 执行文本审校（简化别名方法）
   * @param original 原文
   * @param translation 翻译
   * @param options 审校选项
   */
  async reviewText(
    original: string,
    translation: string,
    options: {
      sourceLanguage: string;
      targetLanguage: string;
      provider?: AIProvider;
      model?: string;
      apiKey?: string;
      customPrompt?: string;
      requestedScores?: ReviewScoreType[];
      checkIssueTypes?: IssueType[];
      contextSegments?: Array<{
        original: string;
        translation: string;
      }>;
    }
  ): Promise<AIReviewResponse> {
    return this.reviewTranslation(original, translation, options);
  }

  /**
   * 获取支持的审校模型列表
   * @param provider AI提供商
   * @param apiKey API密钥
   */
  async getSupportedModels(
    provider: AIProvider = AIProvider.OPENAI,
    apiKey?: string
  ) {
    try {
      // 获取API密钥（首选传入的，否则使用环境变量）
      const key = apiKey || process.env.OPENAI_API_KEY;
      if (!key) {
        throw new Error('未配置API密钥');
      }

      // 获取审校适配器
      const reviewAdapter = this.getReviewAdapter({
        provider,
        apiKey: key,
        model: 'gpt-3.5-turbo' // 这里只是用来初始化适配器，不会真正使用该模型
      });

      // 获取适配器支持的模型
      const models = await reviewAdapter.getAvailableModels();
      
      // 过滤出具有审校能力的模型
      return models.filter(model => 
        model.capabilities.includes('review')
      );

    } catch (error: any) {
      logger.error('Failed to get supported models', { error });
      throw new Error(`获取支持的模型失败: ${error.message}`);
    }
  }

  /**
   * 验证API密钥是否有效
   * @param provider AI提供商
   * @param apiKey API密钥
   */
  async validateApiKey(
    provider: AIProvider = AIProvider.OPENAI,
    apiKey: string
  ): Promise<boolean> {
    try {
      // 获取审校适配器
      const reviewAdapter = this.getReviewAdapter({
        provider,
        apiKey,
        model: 'gpt-3.5-turbo' // 这里只是用来初始化适配器，不会真正使用该模型
      });

      // 验证API密钥
      return await reviewAdapter.validateApiKey();

    } catch (error: any) {
      logger.error('API key validation failed', { error });
      return false;
    }
  }
}

// 导出服务实例
export default new AIReviewService(); 