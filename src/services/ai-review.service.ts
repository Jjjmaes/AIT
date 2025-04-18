import { Inject, Service } from 'typedi';
import { AIProvider, AIServiceConfig } from '../types/ai-service.types';
import { aiServiceFactory } from './translation/aiServiceFactory';
import { ReviewAdapter, ReviewOptions, AIReviewResponse } from './translation/ai-adapters/review.adapter';
import logger from '../utils/logger';
import { ReviewScoreType, IssueType } from '../models/segment.model';
import { PromptTemplateService } from './promptTemplate.service';
import { PromptTemplateType, IPromptTemplate } from '../models/promptTemplate.model';
import { TerminologyService } from './terminology.service';
import { ITermEntry } from '../models/terminology.model';
import { ProjectService } from './project.service';
import { validateEntityExists } from '../utils/errorHandler';
import { AppError } from '../utils/errors';
import { handleServiceError } from '../utils/errorHandler';

// Define interface for review options
interface AIReviewOptions {
  sourceLanguage: string;
  targetLanguage: string;
  provider?: AIProvider | string; // Allow string for flexibility
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
  requesterRoles?: string[]; // Add roles for permission checks
}

/**
 * Service responsible for interacting with different AI models for translation review.
 * Acts as a higher-level service coordinating AI interactions.
 */
@Service()
export class AIReviewService {
  private serviceName = 'AIReviewService';
  private aiServiceFactory: any;

  constructor(
    @Inject(() => TerminologyService) private terminologyService: TerminologyService,
    @Inject(() => ProjectService) private projectService: ProjectService,
    @Inject(() => PromptTemplateService) private promptTemplateService: PromptTemplateService
  ) {
    this.aiServiceFactory = aiServiceFactory;
    logger.info(`[${this.serviceName}] Initialized with imported aiServiceFactory and injected TerminologyService, ProjectService, PromptTemplateService.`);
  }

  /**
   * 获取AI审校适配器
   */
  private getReviewAdapter(provider?: AIProvider | string, config?: AIServiceConfig): ReviewAdapter {
    const aiProviderEnum = provider ? provider as AIProvider : AIProvider.OPENAI;
    const adapter = this.aiServiceFactory.getReviewAdapter(aiProviderEnum, config);
    if (!adapter) {
        const providerName = provider || 'default';
        logger.error(`[${this.serviceName}] Could not get review adapter for provider: ${providerName}`);
        throw new AppError(`Unsupported or unconfigured AI provider: ${providerName}`, 400);
    }
    return adapter;
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
      const provider = options.provider;
      const model = options.model;

      const aiProviderEnum = (provider ? provider as AIProvider : AIProvider.OPENAI);

      const serviceConfig: AIServiceConfig | undefined = options.apiKey
        ? {
            provider: aiProviderEnum,
            apiKey: options.apiKey,
            model: model,
          }
        : undefined;

      let terms: ITermEntry[] = [];
      if (options.projectId && options.userId) {
          try {
              const project = await this.projectService.getProjectById(
                  options.projectId,
                  options.userId,
                  options.requesterRoles || []
              );
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

      let effectivePrompt = options.customPrompt;

      if (!effectivePrompt && options.promptTemplateId) {
        logger.debug(`[${methodName}] Attempting to fetch prompt template ID: ${options.promptTemplateId}`);
        try {
          const template: IPromptTemplate | null = await this.promptTemplateService.getPromptTemplateById(
            options.promptTemplateId
          );

          if (template && template.type === PromptTemplateType.REVIEW) {
            logger.info(`[${methodName}] Using prompt template ID: ${options.promptTemplateId}`);
            let promptText = template.content
              .replace('{SOURCE_LANGUAGE}', options.sourceLanguage)
              .replace('{TARGET_LANGUAGE}', options.targetLanguage)
              .replace('{ORIGINAL_CONTENT}', original)
              .replace('{TRANSLATED_CONTENT}', translation);

            if (terms.length > 0) {
                const formattedTerms = terms.map(term => `[${term.source} -> ${term.target}]`).join(', ');
                const terminologyInstruction = `Strictly adhere to the following terminology: ${formattedTerms}.\n\n`;
                if (promptText.includes('{TERMINOLOGY_LIST}')) {
                    promptText = promptText.replace('{TERMINOLOGY_LIST}', formattedTerms);
                    logger.info(`[${methodName}] Injected ${terms.length} terms into {TERMINOLOGY_LIST} placeholder.`);
                } else {
                    promptText = terminologyInstruction + promptText;
                    logger.warn(`[${methodName}] Prompt template ${options.promptTemplateId} lacks {TERMINOLOGY_LIST} placeholder. Prepending terminology instruction.`);
                }
            } else {
                 promptText = promptText.replace('{TERMINOLOGY_LIST}', '');
            }
            effectivePrompt = promptText;
          } else {
            logger.warn(`[${methodName}] Prompt template ${options.promptTemplateId} not found or not a REVIEW template. Falling back.`);
          }
        } catch (error) {
          logger.error(`[${methodName}] Error processing prompt template ${options.promptTemplateId}. Falling back.`, { error });
        }
      }
      else if (effectivePrompt && terms.length > 0) {
         const formattedTerms = terms.map(term => `[${term.source} -> ${term.target}]`).join(', ');
         const terminologyInstruction = `Strictly adhere to the following terminology: ${formattedTerms}.\n\n`;
         effectivePrompt = terminologyInstruction + effectivePrompt;
         logger.info(`[${methodName}] Injected ${terms.length} terms into custom review prompt.`);
      }
       else if (!effectivePrompt) {
         logger.debug(`[${methodName}] No prompt template ID or customPrompt provided/processed. Using default adapter prompt.`);
      }

      logger.debug(`[${methodName}] Getting review adapter for provider: ${provider || 'default'}, model: ${model || 'default'}`);
      const reviewAdapter = this.getReviewAdapter(provider, serviceConfig);

      const adapterReviewOptions: ReviewOptions = {
        originalContent: original,
        translatedContent: translation,
        aiModel: model,
        customPrompt: effectivePrompt,
        requestedScores: options.requestedScores,
        checkIssueTypes: options.checkIssueTypes,
        contextSegments: options.contextSegments,
        useTerminology: terms.length > 0,
        sourceLanguage: options.sourceLanguage,
        targetLanguage: options.targetLanguage,
      };

      logger.debug(`[${methodName}] Executing adapter review with options: ${JSON.stringify(adapterReviewOptions)}`);
      const reviewResult = await reviewAdapter.reviewText(adapterReviewOptions);
      logger.debug(`[${methodName}] Review process completed successfully.`);
      return reviewResult;

    } catch (error: any) {
      logger.error(`[${methodName}] Error during review process:`, error);
      throw handleServiceError(error, this.serviceName, methodName, 'AI审校');
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
    provider?: AIProvider | string,
    apiKey?: string
  ) {
    const methodName = 'getSupportedModels';
    try {
      const aiProviderEnum = (provider ? provider as AIProvider : AIProvider.OPENAI);

      const serviceConfig: AIServiceConfig | undefined = apiKey
        ? {
            provider: aiProviderEnum,
            apiKey: apiKey
        }
        : undefined;

      const reviewAdapter = this.getReviewAdapter(provider, serviceConfig);

      if (typeof (reviewAdapter as any).getSupportedModels === 'function') {
        const models = await (reviewAdapter as any).getSupportedModels();
        logger.info(`[${methodName}] Found ${models.length} supported models for provider ${provider || 'default'}.`);
        return models;
      } else {
          logger.warn(`[${methodName}] Adapter for provider ${provider || 'default'} does not support getSupportedModels.`);
          return [];
      }

    } catch (error: any) {
      logger.error(`[${methodName}] Failed to get supported models for provider ${provider || 'default'}:`, { error });
      throw new AppError(`获取支持的模型失败: ${error.message}`, 500);
    }
  }

  /**
   * 验证特定提供商的API密钥是否有效
   * @param provider AI提供商
   * @param apiKey API密钥
   */
  async validateApiKey(
    provider?: AIProvider | string,
    apiKey?: string
  ): Promise<boolean> {
     const methodName = 'validateApiKey';
     logger.debug(`[${methodName}] Validating API key for provider: ${provider || 'default'}`);
    try {
      if (!apiKey) {
          logger.warn(`[${methodName}] API key not provided for validation.`);
          return false; 
      }
      
      const aiProviderEnum = (provider ? provider as AIProvider : AIProvider.OPENAI);

      const serviceConfig: AIServiceConfig = {
          provider: aiProviderEnum,
          apiKey: apiKey
      };

      const adapter = this.getReviewAdapter(provider, serviceConfig);

      if (typeof (adapter as any).validateCredentials === 'function') {
        const isValid = await (adapter as any).validateCredentials();
        logger.info(`[${methodName}] API key validation result for provider ${provider || 'default'}: ${isValid}`);
        return isValid;
      } else {
        logger.warn(`[${methodName}] Adapter for provider ${provider || 'default'} does not support validateCredentials.`);
        return false; 
      }
    } catch (error: any) {
      logger.error(`[${methodName}] Error validating API key for provider ${provider || 'default'}:`, { error });
      return false;
    }
  }
}