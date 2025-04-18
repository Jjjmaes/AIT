import { Service } from 'typedi';
import {
  TranslationOptions,
  TranslationResult
} from './types';
import logger from '../utils/logger';
import { Project, IProject } from '../models/project.model';
import { File, IFile, FileStatus } from '../models/file.model';
import { Segment, ISegment, SegmentStatus } from '../models/segment.model';
import { ProjectService } from './project.service';
import { handleServiceError, validateId, validateEntityExists } from '../utils/errorHandler';
import { AppError, ValidationError } from '../utils/errors';
import { Types } from 'mongoose';
import { AIServiceFactory } from './translation/ai-adapters/ai-service.factory';
import { SegmentService } from './segment.service';
import { AIConfigService } from './aiConfig.service';
import { TerminologyService } from './terminology.service';
import { TranslationMemoryService } from './translationMemory.service';
import { ITermEntry } from '../models/terminology.model';
import { IAIProviderConfig } from '../models/aiConfig.model';
import { AIProvider } from './ai-provider.manager';
import { PromptProcessor, PromptBuildContext, ProcessedPrompt } from '../utils/promptProcessor';
import { ChatMessage, ChatCompletionResponse } from './translation/ai-adapters/base.adapter';

// Define and export TranslationUnit interface needed by file processors
export interface TranslationUnit {
  id: string; // Often corresponds to segment or unit ID in the file
  segments: ISegment[]; // Contains one or more segments belonging to the unit
  context?: string; // Optional context information
  // Add other relevant fields if needed (e.g., notes, status)
}

@Service()
export class TranslationService {
  private serviceName = 'TranslationService';

  constructor(
    private segmentSvc: SegmentService,
    private projectSvc: ProjectService,
    private translationMemorySvc: TranslationMemoryService,
    private terminologySvc: TerminologyService,
    private aiConfigSvc: AIConfigService,
    private aiSvcFactory: AIServiceFactory,
    private promptProc: PromptProcessor
  ) {}

  /**
   * Translates a single segment, checking TM first, then using AI if needed.
   * This method remains for potential direct segment translation needs,
   * but the primary worker logic now uses translateBatch.
   */
  async translateSegment(
    segmentId: string,
    userId: string,
    requesterRoles: string[] = [],
    aiConfigId: string,
    promptTemplateId: string | Types.ObjectId,
    options?: TranslationOptions
  ): Promise<ISegment> {
    const methodName = 'translateSegment';
    validateId(segmentId, '段落');
    validateId(userId, '用户');
    validateId(aiConfigId, 'AI 配置');

    try {
      const segment = await this.segmentSvc.getSegmentById(segmentId);
      validateEntityExists(segment, '段落');

      // Consider what statuses should prevent re-translation
      if (segment.status !== SegmentStatus.PENDING && segment.status !== SegmentStatus.ERROR && segment.status !== SegmentStatus.TRANSLATION_FAILED) {
        // Allow re-translation if specific options are set (e.g., retranslateTM)
        const allowRetranslate = (options?.retranslateTM && segment.status === SegmentStatus.TRANSLATED_TM);
        if (!allowRetranslate) {
            logger.warn(`Segment ${segmentId} status (${segment.status}) does not allow translation based on options. Skipping.`);
            return segment;
        }
         logger.info(`Segment ${segmentId} status is ${segment.status}, but retranslation allowed by options.`);
      }

      const file = await File.findById(segment.fileId).exec();
      validateEntityExists(file, '关联文件');
      // Use injected service for project access
      const project = await this.projectSvc.getProjectById(file.projectId.toString(), userId, requesterRoles);
      validateEntityExists(project, '关联项目');

      const fileMetadata = file.metadata ?? {};
      const sourceLang = options?.sourceLanguage || fileMetadata.sourceLanguage;
      const targetLang = options?.targetLanguage || fileMetadata.targetLanguage;

      if (!sourceLang || !targetLang) {
        throw new ValidationError('Source or target language missing for translation.');
      }

      // --- Check Translation Memory ---
      // Use injected service
      const tmMatches = await this.translationMemorySvc.findMatches(
          segment.sourceText,
          sourceLang!,
          targetLang!,
          project._id.toString()
      );

      const exactMatch = tmMatches.find(match => match.score === 100);

      if (exactMatch && !options?.retranslateTM) { // Skip if TM found AND not forced retranslation
          logger.info(`[${methodName}] Found 100% TM match for segment ${segmentId}.`);
          const tmUpdateData: Partial<ISegment> = {
              translation: exactMatch.entry.targetText, // Use correct property
              status: SegmentStatus.TRANSLATED_TM,
              translatedLength: exactMatch.entry.targetText.length, // Use correct property
              translationMetadata: {
                  aiModel: 'TM_100%',
                  tokenCount: 0,
                  processingTime: 0
              },
              translationCompletedAt: new Date(),
              error: undefined
          };
          // Use injected service
          const updatedSegment = await this.segmentSvc.updateSegment(segmentId, tmUpdateData);

          // Use injected service
          this.projectSvc.updateFileProgress(file._id.toString(), userId).catch(err => {
              logger.error(`Failed to update file progress for ${file._id} after TM match on segment ${segmentId}:`, err);
          });

          logger.info(`Segment ${segmentId} translated successfully using TM.`);
          return updatedSegment;
      }
      // --- End TM Check ---

      logger.debug(`[${methodName}] No 100% TM match (or retranslateTM=true) for segment ${segmentId}. Proceeding with AI.`);

      // Use injected service
      await this.segmentSvc.updateSegment(segmentId, { status: SegmentStatus.TRANSLATING });

      // --- Fetch Terminology ---
      let terms: ITermEntry[] = [];
      try {
          if (project.terminology) {
              // Use injected service
              const terminologyList = await this.terminologySvc.getTerminologyById(project.terminology.toString());
              if (terminologyList?.terms) {
                  terms = terminologyList.terms;
                  logger.info(`[${methodName}] Fetched ${terms.length} terms for project ${project._id}.`);
              }
          }
      } catch (error) {
          logger.error(`[${methodName}] Failed to fetch terminology for project ${project._id}. Proceeding without terms.`, { error });
      }
      // ---------------------------

      // Use injected service
      const aiConfig: IAIProviderConfig | null = await this.aiConfigSvc.getConfigById(aiConfigId);
      if (!aiConfig) {
          throw new AppError(`AI 配置 ${aiConfigId} 未找到`, 404);
      }
      if (!aiConfig.providerName || !aiConfig.models || aiConfig.models.length === 0) {
        throw new AppError(`AI 配置 ${aiConfigId} 缺少提供商或模型信息`, 404);
      }

      const promptContext: PromptBuildContext = {
        promptTemplateId: promptTemplateId,
        sourceLanguage: sourceLang!,
        targetLanguage: targetLang!,
        domain: options?.domain || project.domain,
        terms: terms,
      };

      // Use injected service
      const promptData: ProcessedPrompt = await this.promptProc.buildTranslationPrompt(
        segment.sourceText,
        promptContext
      );

      const modelToUse = options?.aiModel || aiConfig.models[0];

      const providerEnumKey = aiConfig.providerName.toUpperCase() as keyof typeof AIProvider;
      const providerEnumValue = AIProvider[providerEnumKey];

      if (!providerEnumValue) {
        throw new AppError(`Unsupported AI provider name: ${aiConfig.providerName}`, 400);
      }

      // Use injected service
      const adapter = this.aiSvcFactory.getAdapter(providerEnumValue);

      if (!adapter) {
        throw new AppError(`Could not get AI adapter for provider: ${aiConfig.providerName}`, 500);
      }

      const adapterOptions: TranslationOptions & { model?: string; temperature?: number } = {
        ...options,
        sourceLanguage: sourceLang!,
        targetLanguage: targetLang!,
        aiModel: modelToUse,
        temperature: options?.temperature,
        // Pass other options adapter might need
      };

      let promptTemplateObjectId: Types.ObjectId | undefined = undefined;
      if (promptTemplateId instanceof Types.ObjectId) {
        promptTemplateObjectId = promptTemplateId;
      } else if (Types.ObjectId.isValid(promptTemplateId)) {
        promptTemplateObjectId = new Types.ObjectId(promptTemplateId);
      } else {
        logger.warn(`Invalid promptTemplateId format: ${promptTemplateId}. Cannot convert to ObjectId.`);
      }

      const startTime = Date.now();
      const response = await adapter.translateText(
          segment.sourceText,
          promptData,
          adapterOptions
      );
      const processingTime = Date.now() - startTime;

      const updateData: Partial<ISegment> = {
        translation: response.translatedText,
        status: SegmentStatus.TRANSLATED,
        translatedLength: response.translatedText?.length ?? 0,
        translationMetadata: {
          aiModel: response.modelInfo.model,
          promptTemplateId: promptTemplateObjectId,
          tokenCount: response.tokenCount?.total,
          processingTime: processingTime,
        },
        translationCompletedAt: new Date(),
        error: undefined
      };

      // Use injected service
      const updatedSegmentAI = await this.segmentSvc.updateSegment(segmentId, updateData);
      validateEntityExists(updatedSegmentAI, '更新后的段落');

      // Use injected service
      this.projectSvc.updateFileProgress(file._id.toString(), userId).catch(err => {
          logger.error(`Failed to update file progress for ${file._id} after segment ${segmentId} translation:`, err);
      });

      logger.info(`Segment ${segmentId} translated successfully using AI.`);
      return updatedSegmentAI; // Return the correct variable

    } catch (error: any) {
      logger.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
      try {
          // Use injected service
          await this.segmentSvc.updateSegment(segmentId, { status: SegmentStatus.ERROR, error: (error instanceof Error ? error.message : '未知翻译错误') });
      } catch (updateError) {
          logger.error(`Failed to mark segment ${segmentId} as ERROR after translation failure:`, updateError);
      }
      throw handleServiceError(error, this.serviceName, methodName, '段落翻译');
    }
  }

  /**
   * Translates a batch of segments using a single AI call.
   */
  async translateBatch(
    systemPrompt: string,
    userPrompt: string,
    aiConfigId: string,
    options?: TranslationOptions & { maxTokens?: number }
  ): Promise<ChatCompletionResponse> {
    const methodName = 'translateBatch';
    validateId(aiConfigId, 'AI 配置');

    try {
      // Use injected service
      const aiConfig: IAIProviderConfig | null = await this.aiConfigSvc.getConfigById(aiConfigId);
      if (!aiConfig) {
        throw new AppError(`AI 配置 ${aiConfigId} 未找到`, 404);
      }
      if (!aiConfig.providerName || !aiConfig.models || aiConfig.models.length === 0) {
        throw new AppError(`AI 配置 ${aiConfigId} 缺少提供商或模型信息`, 404);
      }

      const modelToUse = options?.aiModel || aiConfig.models[0];

      const providerEnumKey = aiConfig.providerName.toUpperCase() as keyof typeof AIProvider;
      const providerEnumValue = AIProvider[providerEnumKey];
      if (!providerEnumValue) {
        throw new AppError(`Unsupported AI provider name: ${aiConfig.providerName}`, 400);
      }

      // Use injected service
      const adapter = this.aiSvcFactory.getAdapter(providerEnumValue);
      if (!adapter) {
        throw new AppError(`Could not get AI adapter for provider: ${aiConfig.providerName}`, 500);
      }

      const messages: ChatMessage[] = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: userPrompt });

      const adapterOptions = {
        model: modelToUse,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens
      };

      logger.debug(`[${this.serviceName}.${methodName}] Calling adapter.executeChatCompletion with model ${modelToUse}`, {
          messageCount: messages.length,
          userPromptLength: userPrompt.length,
          adapterOptions
      });

      const startTime = Date.now();
      const response = await adapter.executeChatCompletion(messages, adapterOptions);
      const processingTime = Date.now() - startTime;

       logger.info(`[${this.serviceName}.${methodName}] Adapter finished executeChatCompletion. Time: ${processingTime}ms`, { model: response.model, usage: response.usage });

        if (response.error) {
            const errorMessage = `AI returned an error: ${response.error}`;
            logger.error(`[${this.serviceName}.${methodName}] AI adapter reported an error in ChatCompletionResponse`, { error: response.error, fullResponse: response });
            const error = new AppError(errorMessage, 500);
            throw error;
        }
        if (!response.content) {
             logger.warn(`[${this.serviceName}.${methodName}] AI adapter returned null or empty content in ChatCompletionResponse.`);
        }

      return response;

    } catch (error: any) { // Explicitly type error
       logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
       throw handleServiceError(error, this.serviceName, methodName, '批量翻译');
    }
  }

  /**
   * Updates the status of a file based on the status of its segments.
   */
  async translateFileSegments(fileId: string, options?: TranslationOptions): Promise<void> {
    const methodName = 'translateFileSegments';
    validateId(fileId, '文件');
    logger.info(`[${this.serviceName}.${methodName}] Checking final status for file ID: ${fileId}`);

    try {
        const file = await File.findById(fileId).exec();
        validateEntityExists(file, '文件');

        // Count segments by final status relevant to completion
        const translatedTmCount = await Segment.countDocuments({ fileId: file._id, status: SegmentStatus.TRANSLATED_TM });
        const translatedAiCount = await Segment.countDocuments({ fileId: file._id, status: SegmentStatus.TRANSLATED });
        const failedCount = await Segment.countDocuments({ fileId: file._id, status: { $in: [SegmentStatus.ERROR, SegmentStatus.TRANSLATION_FAILED] } });

        // Count total segments expected for this file
        const expectedSegments = file.segmentCount || await Segment.countDocuments({ fileId: file._id });

        // Calculate counts for progress object
        const totalFinalized = translatedTmCount + translatedAiCount + failedCount;
        const totalTranslated = translatedTmCount + translatedAiCount;
        const progressPercent = expectedSegments > 0 ? Math.round((totalFinalized / expectedSegments) * 100) : 0;

        logger.debug(`[${this.serviceName}.${methodName}] File ${fileId} status check: Total=${expectedSegments}, Finalized=${totalFinalized}, Translated=${totalTranslated}, Failed=${failedCount}, Percentage=${progressPercent}%`);

        // Assign progress object
        file.progress = {
            total: expectedSegments,
            completed: totalFinalized,
            translated: totalTranslated,
            percentage: progressPercent
        };

        if (totalFinalized >= expectedSegments) { // Use >= for safety
            if (failedCount > 0) {
                file.status = FileStatus.ERROR;
                file.errorDetails = `${failedCount} segment(s) failed translation.`;
                 logger.info(`[${this.serviceName}.${methodName}] Marking file ${fileId} as ERROR.`);
            } else {
                file.status = FileStatus.TRANSLATED;
                file.errorDetails = undefined; // Clear previous errors
                logger.info(`[${this.serviceName}.${methodName}] Marking file ${fileId} as TRANSLATED.`);
            }
        } else {
             // Keep status as TRANSLATING if not fully done
             if (file.status !== FileStatus.TRANSLATING) {
                 file.status = FileStatus.TRANSLATING; // Ensure it reflects ongoing work
                 logger.info(`[${this.serviceName}.${methodName}] Marking file ${fileId} as TRANSLATING (progress: ${progressPercent}%).`);
             } else {
                 logger.info(`[${this.serviceName}.${methodName}] File ${fileId} still TRANSLATING (progress: ${progressPercent}%).`);
             }
        }
        await file.save();
        // Send SSE update maybe?
        // sendSseUpdate({ type: 'FILE_PROGRESS', payload: { fileId, status: file.status, progress: file.progress } });

   } catch (fileUpdateError: any) { // Explicitly type error
        logger.error(`[${this.serviceName}.${methodName}] Failed to update file status after translation check for file ID: ${fileId}:`, fileUpdateError);
   }
 }
} // End of TranslationService class definition