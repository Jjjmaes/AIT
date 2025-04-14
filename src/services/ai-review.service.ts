import { AIProvider, AIServiceConfig } from '../types/ai-service.types';
import { AIServiceFactory } from './translation/ai-adapters';
import { ReviewAdapter, ReviewOptions, AIReviewResponse } from './translation/ai-adapters/review.adapter';
import logger from '../utils/logger';
import { ReviewScoreType, IssueType } from '../models/segment.model';
import { promptTemplateService, PromptTemplateService } from './promptTemplate.service';
import { PromptTaskType, IPromptTemplate } from '../models/promptTemplate.model';
import { terminologyService, TerminologyService } from './terminology.service';
import { ITermEntry } from '../models/terminology.model';
import { projectService, ProjectService } from './project.service';
import { validateEntityExists } from '../utils/errorHandler';

// Define interface for review options
interface AIReviewOptions {
  sourceLanguage: string;
  targetLanguage: string;
  provider?: AIProvider;
  model?: string;
  apiKey?: string;
  customPrompt?: string;
  promptTemplateId?: string;
  projectId?: string;
  requestedScores?: ReviewScoreType[];
  checkIssueTypes?: IssueType[];
  contextSegments?: Array<{
    original: string;
    translation: string;
  }>;
  userId?: string; // For permission checks when fetching project/terms
}

/**
 * AI审校服务
 * 提供独立的AI审校功能，可以被其他服务或控制器调用
 */
export class AIReviewService {
  private aiServiceFactory: AIServiceFactory;
  private promptTemplateService: PromptTemplateService;
  private terminologyService: TerminologyService;
  private projectService: ProjectService;

  constructor(
    promptSvc: PromptTemplateService = promptTemplateService,
    aiFactory: AIServiceFactory = AIServiceFactory.getInstance(),
    termSvc: TerminologyService = terminologyService,
    projSvc: ProjectService = projectService
  ) {
    this.aiServiceFactory = aiFactory;
    this.promptTemplateService = promptSvc;
    this.terminologyService = termSvc;
    this.projectService = projSvc;
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
    options: AIReviewOptions // Use the defined interface
  ): Promise<AIReviewResponse> {
    const methodName = 'reviewTranslation';
    logger.debug(`[${methodName}] Starting review process.`);
    try {
      // 获取API密钥（首选传入的，否则使用环境变量）
      const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        logger.error(`[${methodName}] API key is missing.`);
        throw new Error('未配置API密钥');
      }

      // 获取提供商（首选传入的，否则默认为OpenAI）
      const provider = options.provider || AIProvider.OPENAI;

      // 获取模型（首选传入的，否则使用默认值）
      const model = options.model || 'gpt-3.5-turbo';

       // --- Fetch Terminology if projectId is available ---
       let terms: ITermEntry[] = [];
       if (options.projectId && options.userId) { // Check for userId too
           try {
               const project = await this.projectService.getProjectById(options.projectId, options.userId);
               validateEntityExists(project, '关联项目 for terminology');
               if (project.terminology) {
                   const terminologyList = await this.terminologyService.getTerminologyById(project.terminology.toString());
                   if (terminologyList?.terms) {
                       terms = terminologyList.terms;
                       logger.info(`[${methodName}] Fetched ${terms.length} terms for project ${options.projectId}.`);
                   }
               }
           } catch (error) {
               logger.error(`[${methodName}] Failed to fetch project or terminology for project ${options.projectId}. Proceeding without terms.`, { error });
           }
       }
       // ---------------------------------------------------

       // 获取并渲染提示模板
       let effectivePrompt = options.customPrompt;

      // Fetch and process prompt template
      if (!effectivePrompt && options.promptTemplateId) {
        logger.debug(`[${methodName}] Attempting to fetch prompt template ID: ${options.promptTemplateId}`);
        try {
          const template: IPromptTemplate | null = await this.promptTemplateService.getTemplateById(
            options.promptTemplateId
          );

          if (template && template.taskType === PromptTaskType.REVIEW) {
            logger.info(`[${methodName}] Using prompt template ID: ${options.promptTemplateId}`);
            // Start with the base user prompt from the template
            let promptText = template.userPrompt
              .replace('{SOURCE_LANGUAGE}', options.sourceLanguage)
              .replace('{TARGET_LANGUAGE}', options.targetLanguage)
              .replace('{ORIGINAL_CONTENT}', original)
              .replace('{TRANSLATED_CONTENT}', translation);

            // Inject terminology if available
            if (terms.length > 0) {
                const formattedTerms = terms.map(term => `[${term.source} -> ${term.target}]`).join(', ');
                // Prepend a clear instruction about terminology
                const terminologyInstruction = `Strictly adhere to the following terminology: ${formattedTerms}.\n\n`; 
                // Check if a placeholder exists for more structured injection (optional)
                if (promptText.includes('{TERMINOLOGY_LIST}')) {
                    promptText = promptText.replace('{TERMINOLOGY_LIST}', formattedTerms); // Replace placeholder if exists
                    logger.info(`[${methodName}] Injected ${terms.length} terms into {TERMINOLOGY_LIST} placeholder.`);
                } else {
                    // Otherwise, prepend the instruction to the main prompt text
                    promptText = terminologyInstruction + promptText; 
                    logger.warn(`[${methodName}] Prompt template ${options.promptTemplateId} lacks {TERMINOLOGY_LIST} placeholder. Prepending terminology instruction.`);
                }
            }
            effectivePrompt = promptText;
          } else {
            logger.warn(`[${methodName}] Prompt template ${options.promptTemplateId} not found or not a REVIEW template. Falling back.`);
          }
        } catch (error) {
          // Catch errors specifically from fetching/processing the template
          logger.error(`[${methodName}] Error processing prompt template ${options.promptTemplateId}. Falling back.`, { error });
          // effectivePrompt remains null or the original customPrompt, allowing fallback
        }
      }
      // This handles the case where a customPrompt was provided initially
      else if (effectivePrompt && terms.length > 0) { 
         // Inject terms into the custom prompt if provided
         const formattedTerms = terms.map(term => `[${term.source} -> ${term.target}]`).join(', ');
         const terminologyInstruction = `Strictly adhere to the following terminology: ${formattedTerms}.\n\n`;
         effectivePrompt = terminologyInstruction + effectivePrompt;
         logger.info(`[${methodName}] Injected ${terms.length} terms into custom review prompt.`);
      }
       else if (!effectivePrompt) { // Log if still no prompt after checking template and custom
         logger.debug(`[${methodName}] No prompt template ID or customPrompt provided/processed. Using default adapter prompt.`);
      }

      // 获取审校适配器
      logger.debug(`[${methodName}] Getting review adapter for provider: ${provider}, model: ${model}`);
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
        customPrompt: effectivePrompt, // Pass the potentially modified prompt
        requestedScores: options.requestedScores,
        checkIssueTypes: options.checkIssueTypes,
        contextSegments: options.contextSegments,
        projectId: options.projectId // Pass projectId if needed by adapter
      };

      // 执行审校并返回结果
      logger.info(`[${methodName}] Starting AI review using ${provider} model ${model}`);
      const result = await reviewAdapter.reviewText(reviewOptions);
      logger.info(`[${methodName}] AI review completed successfully`);

      return result;

    } catch (error: any) {
      logger.error(`[${methodName}] AI review failed`, { error });
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
    options: AIReviewOptions // Use the defined interface
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