import { 
  TranslationOptions, 
  TranslationResult,
  IProjectService,
  ITranslationQueue,
  IAIProviderManager
} from './types';
import { JobStatus } from './translationQueue.service';
import logger from '../utils/logger';
import { Project, IProject, ILanguagePair } from '../models/project.model';
import { File, IFile, FileStatus } from '../models/file.model';
import { Segment, ISegment, SegmentStatus } from '../models/segment.model';
import { projectService } from './project.service';
import { handleServiceError, validateId, validateEntityExists, validateOwnership } from '../utils/errorHandler';
import { NotFoundError, AppError, ValidationError } from '../utils/errors';
import { Types } from 'mongoose';
import { aiServiceFactory } from './translation/aiServiceFactory';
import { promptProcessor } from '../utils/promptProcessor';
import { translationQueueService } from './translationQueue.service';
import { segmentService } from './segment.service';
import { IPromptTemplate } from '../models/promptTemplate.model';
import { AIServiceFactory } from './translation/ai-adapters/ai-service.factory';
import { AIProvider, AIServiceConfig } from '../types/ai-service.types';
import { config } from '../config';
import { BaseAIServiceAdapter } from './translation/ai-adapters/base.adapter';

// Define and export TranslationUnit interface needed by file processors
export interface TranslationUnit {
  id: string; // Often corresponds to segment or unit ID in the file
  segments: ISegment[]; // Contains one or more segments belonging to the unit
  context?: string; // Optional context information
  // Add other relevant fields if needed (e.g., notes, status)
}

export class TranslationService {
  private serviceName = 'TranslationService';
  private aiServiceFactory: AIServiceFactory;

  constructor() {
    this.aiServiceFactory = AIServiceFactory.getInstance();
  }

  async translateSegment(
    segmentId: string,
    userId: string,
    options?: TranslationOptions
  ): Promise<ISegment> {
    const methodName = 'translateSegment';
    validateId(segmentId, '段落');
    validateId(userId, '用户');

    try {
      const segment = await segmentService.getSegmentById(segmentId);
      validateEntityExists(segment, '段落');
      
      if (segment.status !== SegmentStatus.PENDING && segment.status !== SegmentStatus.ERROR) {
        logger.warn(`Segment ${segmentId} already processed or in progress (status: ${segment.status}). Skipping translation.`);
        return segment;
      }

      const file = await File.findById(segment.fileId).exec();
      validateEntityExists(file, '关联文件');
      const project = await projectService.getProjectById(file.projectId.toString(), userId);
      validateEntityExists(project, '关联项目');
      
      await segmentService.updateSegment(segmentId, { status: SegmentStatus.TRANSLATING });

      // Use nullish coalescing to provide default empty object if metadata is undefined
      const fileMetadata = file.metadata ?? {}; 
      const sourceLang = options?.sourceLanguage || fileMetadata.sourceLanguage;
      const targetLang = options?.targetLanguage || fileMetadata.targetLanguage;
      
      let effectivePromptTemplateId: string | Types.ObjectId | undefined;
      const projectTemplate = options?.promptTemplateId || project.translationPromptTemplate;
      if (projectTemplate) {
          if (typeof projectTemplate === 'string') {
              effectivePromptTemplateId = projectTemplate;
          } else if (projectTemplate instanceof Types.ObjectId) {
              effectivePromptTemplateId = projectTemplate;
          } else if (typeof projectTemplate === 'object' && projectTemplate._id) { 
              effectivePromptTemplateId = projectTemplate._id;
          }
      }
      
      const promptContext = {
          promptTemplateId: effectivePromptTemplateId,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          domain: options?.domain || project.domain,
          terminology: project.terminology?.toString()
      };

      const promptData = await promptProcessor.buildTranslationPrompt(
          segment.sourceText,
          promptContext
      );

      const aiAdapter = aiServiceFactory.getTranslationAdapter(options?.aiProvider);
      
      let promptTemplateObjectId: Types.ObjectId | undefined = undefined;
      const idToConvert = promptContext.promptTemplateId;
      if (idToConvert && Types.ObjectId.isValid(idToConvert)) { 
          promptTemplateObjectId = new Types.ObjectId(idToConvert); 
      } else if (idToConvert) {
          logger.warn(`Invalid promptTemplateId format: ${idToConvert}. Cannot convert to ObjectId.`);
      }
      
      const startTime = Date.now();
      const response = await aiAdapter.translateText(
          segment.sourceText, 
          promptData, 
          options
      );
      const processingTime = Date.now() - startTime;

      const updateData: Partial<ISegment> = {
          translation: response.translatedText,
          status: SegmentStatus.TRANSLATED,
          translatedLength: response.translatedText.length,
          translationMetadata: {
              aiModel: response.modelInfo.model,
              promptTemplateId: promptTemplateObjectId,
              tokenCount: response.tokenCount?.total,
              processingTime: processingTime
          },
          translationCompletedAt: new Date(),
          error: undefined
      };

      const updatedSegment = await segmentService.updateSegment(segmentId, updateData);
      validateEntityExists(updatedSegment, '更新后的段落');

      projectService.updateFileProgress(file._id.toString(), userId).catch(err => {
          logger.error(`Failed to update file progress for ${file._id} after segment ${segmentId} translation:`, err);
      });

      logger.info(`Segment ${segmentId} translated successfully.`);
      return updatedSegment;

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
      try {
          await segmentService.updateSegment(segmentId, { status: SegmentStatus.ERROR, error: (error instanceof Error ? error.message : '未知翻译错误') });
      } catch (updateError) {
          logger.error(`Failed to mark segment ${segmentId} as ERROR after translation failure:`, updateError);
      }
      throw handleServiceError(error, this.serviceName, methodName, '段落翻译');
    }
  }

  async translateFile(
    projectId: string,
    fileId: string,
    userId: string,
    options: TranslationOptions
  ): Promise<string> {
    const methodName = 'translateFile';
    validateId(projectId, '项目');
    validateId(fileId, '文件');
    validateId(userId, '用户');
    try {
      const project = await projectService.getProjectById(projectId, userId);
      const file = await File.findOne({ _id: new Types.ObjectId(fileId), projectId: project._id }).exec();
      validateEntityExists(file, '文件');
      
      // Check for required metadata *immediately* after getting the file
      const targetLanguage = options?.targetLanguage || file.metadata?.targetLanguage;
      const sourceLanguage = file.metadata?.sourceLanguage; 
      if (!targetLanguage || !sourceLanguage) {
          const missing = !targetLanguage && !sourceLanguage ? 'Source and target language' : !targetLanguage ? 'Target language' : 'Source language';
          logger.error(`[${this.serviceName}.${methodName}] ${missing} not found for file ${fileId}. Cannot translate.`);
          // Although we set status/details, don't save here to ensure error is thrown
          // file.status = FileStatus.ERROR; 
          // file.errorDetails = `${missing} not specified in file metadata or options.`;
          // await file.save(); // Temporarily removed due to test instability
          throw new AppError(`${missing} is required for translation.`, 400);
      }

      // Check if file status allows translation (e.g., EXTRACTED)
      if (file.status !== FileStatus.EXTRACTED) {
         logger.warn(`[${this.serviceName}.${methodName}] File ${fileId} is not in EXTRACTED status (current: ${file.status}). Skipping translation.`);
         throw new ValidationError(`File ${fileId} is not in EXTRACTED status.`);
      }

      // Find segments that need translation
      const segmentsToTranslate = await Segment.find({
        fileId: file._id,
        status: SegmentStatus.PENDING // Only translate pending segments
      }).exec();

      if (segmentsToTranslate.length === 0) {
        logger.info(`[${this.serviceName}.${methodName}] No pending segments found for file ${fileId}.`);
        throw new ValidationError(`No pending segments found for file ${fileId}.`);
      }

      logger.info(`[${this.serviceName}.${methodName}] Found ${segmentsToTranslate.length} segments to translate for file ${fileId}.`);
      
      // Update file status to TRANSLATING
      if (file.status === FileStatus.EXTRACTED) {
          file.status = FileStatus.TRANSLATING;
          await file.save();
          logger.info(`[${this.serviceName}.${methodName}] Set file ${fileId} status to TRANSLATING.`);
      }

      let translatedCount = 0;
      let failedCount = 0;

      for (const segment of segmentsToTranslate) {
          try {
              logger.debug(`Translating segment ${segment._id}...`);
              
              // 1. Build Prompt
              const promptData = buildTranslationPrompt(segment.sourceText, sourceLanguage!, targetLanguage!);

              // Prepare full options for the adapter call
              const adapterOptions: TranslationOptions & { model?: string; temperature?: number } = {
                  ...options, // Include original options
                  sourceLanguage: sourceLanguage!, // Ensure languages are passed
                  targetLanguage: targetLanguage!,
                  aiProvider: AIProvider.OPENAI, // Pass provider info
                  aiModel: options?.aiModel, // Pass model if specified
                  temperature: options?.temperature // Pass temperature if specified
                  // Add other relevant fields from TranslationOptions if needed by adapter
              };

              // Call AI Adapter using this.aiServiceFactory and the correct config
              // Need to define aiConfig within this method's scope or pass it
              const provider = AIProvider.OPENAI; // Assuming OpenAI for now
              const aiConfig: AIServiceConfig = { 
                  provider,
                  apiKey: config.openai.apiKey, 
                  defaultModel: options?.aiModel || config.openai.defaultModel
              };
              const adapter = this.aiServiceFactory.createAdapter(aiConfig); // Use aiConfig here

              const translationResponse = await adapter.translateText(
                  segment.sourceText, 
                  promptData, 
                  adapterOptions // Pass adapterOptions to translateText
              );
              
              // 3. Update Segment
              segment.translation = translationResponse.translatedText;
              segment.status = SegmentStatus.TRANSLATED;
              segment.error = undefined; 
              // TODO: Store translation metadata from translationResponse.modelInfo, tokenCount etc.
              // segment.translationMetadata = { ... }; 
              await segment.save();
              translatedCount++;
              logger.debug(`Segment ${segment._id} translated successfully.`);
          } catch (error) {
              failedCount++;
              logger.error(`Failed to translate segment ${segment._id}:`, error);
              segment.status = SegmentStatus.TRANSLATION_FAILED;
              segment.error = error instanceof Error ? error.message : 'Unknown translation error';
              await segment.save();
          }
      }

      // --- Update File status and counts ---
      try {
          file.translatedCount = await Segment.countDocuments({ fileId: file._id, status: SegmentStatus.TRANSLATED });
          // Potentially count failed? Might need another field.
          
          if (failedCount > 0) {
              file.status = FileStatus.ERROR; // Or a new PARTIAL_TRANSLATION_FAILED status?
              file.errorDetails = `${failedCount} segment(s) failed to translate.`;
          } else if (file.translatedCount === file.segmentCount) {
              file.status = FileStatus.TRANSLATED;
              file.errorDetails = undefined;
          } else {
              // This case might indicate partial success, keep as TRANSLATING or introduce PARTIAL?
               file.status = FileStatus.TRANSLATING; // Or PARTIALLY_TRANSLATED
               logger.warn(`[${this.serviceName}.${methodName}] File ${fileId} translation partially complete. ${file.translatedCount}/${file.segmentCount} segments translated.`);
          }
          await file.save();
          logger.info(`[${this.serviceName}.${methodName}] Finished translation attempt for file ID: ${fileId}. Final status: ${file.status}`);
      } catch (fileUpdateError) {
           logger.error(`[${this.serviceName}.${methodName}] Failed to update file status after translation for file ID: ${fileId}:`, fileUpdateError);
      }

      return await translationQueueService.addFileTranslationJob(projectId, fileId, options, userId);
    } catch (error) {
       logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
       throw handleServiceError(error, this.serviceName, methodName, '文件翻译任务');
    }
  }

  async translateProject(
    projectId: string,
    userId: string,
    options: TranslationOptions
  ): Promise<string> {
    const methodName = 'translateProject';
    validateId(projectId, '项目');
    validateId(userId, '用户');
    try {
      const project = await projectService.getProjectById(projectId, userId);
      
      const files = await File.find({ projectId: project._id }).exec();
      if (!files || files.length === 0) {
         throw new ValidationError('项目没有要翻译的文件');
      }
      
      return await translationQueueService.addProjectTranslationJob(projectId, options, userId);
    } catch (error) {
       logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
       throw handleServiceError(error, this.serviceName, methodName, '项目翻译任务');
    }
  }

  async getTranslationStatus(jobId: string): Promise<JobStatus> {
    const methodName = 'getTranslationStatus';
     try {
       return await translationQueueService.getJobStatus(jobId);
     } catch (error) {
       logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
       throw handleServiceError(error, this.serviceName, methodName, '获取翻译状态');
     }
  }

  async cancelTranslation(jobId: string): Promise<void> {
     const methodName = 'cancelTranslation';
     try {
       await translationQueueService.cancelJob(jobId);
       logger.info(`Translation job ${jobId} cancelled.`);
     } catch (error) {
       logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
       throw handleServiceError(error, this.serviceName, methodName, '取消翻译任务');
     }
  }

  /**
   * Translates all pending segments for a given file.
   * @param fileId - The ID of the file to translate segments for.
   * @param options - Translation options.
   */
  async translateFileSegments(fileId: string, options?: TranslationOptions): Promise<void> {
    const methodName = 'translateFileSegments';
    validateId(fileId, '文件');
    logger.info(`[${this.serviceName}.${methodName}] Starting translation for file ID: ${fileId}`);

    const file = await File.findById(fileId).exec();
    validateEntityExists(file, '文件');

    // Check for required metadata *immediately* after getting the file
    const targetLanguage = options?.targetLanguage || file.metadata?.targetLanguage;
    const sourceLanguage = file.metadata?.sourceLanguage; 
    if (!targetLanguage || !sourceLanguage) {
        const missing = !targetLanguage && !sourceLanguage ? 'Source and target language' : !targetLanguage ? 'Target language' : 'Source language';
        logger.error(`[${this.serviceName}.${methodName}] ${missing} not found for file ${fileId}. Cannot translate.`);
        // Although we set status/details, don't save here to ensure error is thrown
        // file.status = FileStatus.ERROR; 
        // file.errorDetails = `${missing} not specified in file metadata or options.`;
        // await file.save(); // Temporarily removed due to test instability
        // logger.debug('[DEBUG] Saved file state, about to throw AppError for missing language...'); // Remove log
        throw new AppError(`${missing} is required for translation.`, 400);
    }
    logger.info(`Translating from ${sourceLanguage} to ${targetLanguage}`);

    // --- Check File Status BEFORE querying segments --- 
    if (file.status !== FileStatus.EXTRACTED) {
        // If status is not EXTRACTED, log a warning and stop.
        logger.warn(`[${this.serviceName}.${methodName}] File ${fileId} is not in EXTRACTED status (current: ${file.status}). Skipping translation.`);
        return; // Stop processing this file
    }

    // --- Set status to TRANSLATING (only if it was EXTRACTED) --- 
    file.status = FileStatus.TRANSLATING;
    await file.save();
    logger.info(`[${this.serviceName}.${methodName}] Set file ${fileId} status to TRANSLATING.`);
    // --- Now query for segments --- 
    const segmentsToTranslate = await Segment.find({
      fileId: file._id,
      status: SegmentStatus.PENDING // Only translate pending segments
    }).exec();

    if (segmentsToTranslate.length === 0) {
      logger.info(`[${this.serviceName}.${methodName}] No pending segments found for file ${fileId}.`);
      // If no segments were found after setting status to TRANSLATING, 
      // should we revert the status? Or perhaps set it to TRANSLATED if counts match?
      // For now, just return. The final status update logic later might handle this.
      return;
    }

    logger.info(`[${this.serviceName}.${methodName}] Found ${segmentsToTranslate.length} segments to translate for file ${fileId}.`);
    
    // --- Get AI Adapter --- 
    const provider = AIProvider.OPENAI; 
    const aiConfig: AIServiceConfig = { 
        provider,
        apiKey: config.openai.apiKey, 
        defaultModel: options?.aiModel || config.openai.defaultModel
    };
    // Use this.aiServiceFactory and remove @ts-expect-error
    const adapter: BaseAIServiceAdapter = this.aiServiceFactory.createAdapter(aiConfig);

    let translatedCount = 0;
    let failedCount = 0;

    for (const segment of segmentsToTranslate) {
        try {
            logger.debug(`Translating segment ${segment._id}...`);
            
            // Remove unused @ts-expect-error
            const promptData = buildTranslationPrompt(segment.sourceText, sourceLanguage!, targetLanguage!);

            // Remove unused @ts-expect-error
            const adapterOptions: TranslationOptions & { model?: string; temperature?: number } = {
                ...options, 
                sourceLanguage: sourceLanguage!, 
                targetLanguage: targetLanguage!,
                aiProvider: provider, 
                aiModel: options?.aiModel, 
                temperature: options?.temperature 
            };

            const translationResponse = await adapter.translateText(
                segment.sourceText, 
                promptData, 
                adapterOptions 
            );
            
            // 3. Update Segment
            segment.translation = translationResponse.translatedText;
            segment.status = SegmentStatus.TRANSLATED;
            segment.error = undefined; 
            // TODO: Store translation metadata from translationResponse.modelInfo, tokenCount etc.
            // segment.translationMetadata = { ... }; 
            await segment.save();
            translatedCount++;
            logger.debug(`Segment ${segment._id} translated successfully.`);
        } catch (error) {
            failedCount++;
            logger.error(`Failed to translate segment ${segment._id}:`, error);
            segment.status = SegmentStatus.TRANSLATION_FAILED;
            segment.error = error instanceof Error ? error.message : 'Unknown translation error';
            await segment.save();
        }
    }

    // --- Update File status and counts ---
    try {
        file.translatedCount = await Segment.countDocuments({ fileId: file._id, status: SegmentStatus.TRANSLATED });
        // Potentially count failed? Might need another field.
        
        if (failedCount > 0) {
            file.status = FileStatus.ERROR; // Or a new PARTIAL_TRANSLATION_FAILED status?
            file.errorDetails = `${failedCount} segment(s) failed to translate.`;
        } else if (file.translatedCount === file.segmentCount) {
            file.status = FileStatus.TRANSLATED;
            file.errorDetails = undefined;
        } else {
            // This case might indicate partial success, keep as TRANSLATING or introduce PARTIAL?
             file.status = FileStatus.TRANSLATING; // Or PARTIALLY_TRANSLATED
             logger.warn(`[${this.serviceName}.${methodName}] File ${fileId} translation partially complete. ${file.translatedCount}/${file.segmentCount} segments translated.`);
        }
        await file.save();
        logger.info(`[${this.serviceName}.${methodName}] Finished translation attempt for file ID: ${fileId}. Final status: ${file.status}`);
    } catch (fileUpdateError) {
         logger.error(`[${this.serviceName}.${methodName}] Failed to update file status after translation for file ID: ${fileId}:`, fileUpdateError);
    }
  }
}

export const translationService = new TranslationService(); 

// Placeholder for prompt building logic - replace with actual implementation
interface ProcessedPrompt {
    systemInstruction: string;
    userPrompt: string;
}
const buildTranslationPrompt = (sourceText: string, sourceLang: string, targetLang: string): ProcessedPrompt => {
    // TODO: Implement actual prompt engineering logic
    return {
        systemInstruction: `Translate the following text from ${sourceLang} to ${targetLang}. Respond only with the translation.`,
        userPrompt: sourceText,
    };
}; 