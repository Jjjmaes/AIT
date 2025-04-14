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
import { projectService, ProjectService } from './project.service';
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
import { terminologyService, TerminologyService } from './terminology.service';
import { ITermEntry } from '../models/terminology.model';
import { translationMemoryService, TranslationMemoryService } from './translationMemory.service';

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
  private terminologyService: TerminologyService;
  private projectService: ProjectService;
  private translationMemoryService: TranslationMemoryService;

  constructor() {
    this.aiServiceFactory = AIServiceFactory.getInstance();
    this.terminologyService = terminologyService;
    this.projectService = projectService;
    this.translationMemoryService = translationMemoryService;
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
      const project = await this.projectService.getProjectById(file.projectId.toString(), userId);
      validateEntityExists(project, '关联项目');
      
      // Use nullish coalescing for metadata
      const fileMetadata = file.metadata ?? {}; 
      const sourceLang = options?.sourceLanguage || fileMetadata.sourceLanguage;
      const targetLang = options?.targetLanguage || fileMetadata.targetLanguage;
      
      if (!sourceLang || !targetLang) {
        throw new ValidationError('Source or target language missing for translation.');
      }

      // --- Check Translation Memory --- 
      const tmMatches = await this.translationMemoryService.findMatches(
          segment.sourceText,
          sourceLang,
          targetLang,
          project._id.toString()
      );
      
      const exactMatch = tmMatches.find(match => match.score === 100); // Check for 100% score

      if (exactMatch) {
          logger.info(`[${methodName}] Found 100% TM match for segment ${segmentId}.`);
          const tmUpdateData: Partial<ISegment> = {
              translation: exactMatch.entry.targetText,
              status: SegmentStatus.TRANSLATED_TM, // New status
              translatedLength: exactMatch.entry.targetText.length,
              translationMetadata: {
                  // Indicate source was TM
                  aiModel: 'TM_100%', 
                  // Optionally store TM entry ID?
                  // promptTemplateId: exactMatch.entry._id, 
                  tokenCount: 0, // No AI tokens used
                  processingTime: 0 // Minimal processing time
              },
              translationCompletedAt: new Date(),
              error: undefined
          };
          const updatedSegment = await segmentService.updateSegment(segmentId, tmUpdateData);
          
          // Update project file progress
          projectService.updateFileProgress(file._id.toString(), userId).catch(err => {
              logger.error(`Failed to update file progress for ${file._id} after TM match on segment ${segmentId}:`, err);
          });
          
          logger.info(`Segment ${segmentId} translated successfully using TM.`);
          return updatedSegment;
      }
      // --- End TM Check --- 

      // --- If no 100% TM match, proceed with AI Translation ---
      logger.debug(`[${methodName}] No 100% TM match found for segment ${segmentId}. Proceeding with AI.`);
      
      await segmentService.updateSegment(segmentId, { status: SegmentStatus.TRANSLATING });

      // --- Fetch Terminology --- 
      let terms: ITermEntry[] = [];
      try {
          if (project.terminology) {
              const terminologyList = await this.terminologyService.getTerminologyById(project.terminology.toString());
              if (terminologyList?.terms) {
                  terms = terminologyList.terms;
                  logger.info(`[${methodName}] Fetched ${terms.length} terms for project ${project._id}.`);
              }
          }
      } catch (error) {
          logger.error(`[${methodName}] Failed to fetch terminology for project ${project._id}. Proceeding without terms.`, { error });
      }
      // ---------------------------
      
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
          terms: terms 
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

      logger.info(`Segment ${segmentId} translated successfully using AI.`);
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
      
      // --- Fetch terminology for the file before the loop --- 
      let termsForFile: ITermEntry[] = [];
      try {
          if (project.terminology) {
              const terminologyList = await this.terminologyService.getTerminologyById(project.terminology.toString());
              if (terminologyList?.terms) {
                  termsForFile = terminologyList.terms;
                  logger.info(`[${this.serviceName}.${methodName}] Fetched ${termsForFile.length} terms for file ${fileId}.`);
              }
          } 
      } catch (error) {
          logger.error(`[${this.serviceName}.${methodName}] Error fetching terminology for file ${fileId}. Proceeding without terms.`, { error });
      }
      // --------------------------------------------------------

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
              
              // 1. Build Prompt context and call builder
              const promptContext: PromptBuildContext = {
                  sourceLanguage: sourceLanguage!, 
                  targetLanguage: targetLanguage!,
                  // Include project/options details if needed by prompt builder 
                  domain: options?.domain || project.domain,
                  promptTemplateId: options?.promptTemplateId, // Pass template ID if available
                  terms: termsForFile // Pass the fetched terms
              };
              const promptData = buildTranslationPrompt(segment.sourceText, promptContext);

              // Prepare full options for the adapter call
              const adapterOptions: TranslationOptions & { model?: string; temperature?: number } = {
                  ...options, // Include original options
                  sourceLanguage: sourceLanguage!, // Ensure languages are passed
                  targetLanguage: targetLanguage!,
                  aiProvider: AIProvider.OPENAI, // Pass provider info
                  aiModel: options?.aiModel, // Pass model if specified
                  temperature: options?.temperature // Pass temperature if specified
              };

              // Call AI Adapter using this.aiServiceFactory and the correct config
              const provider = AIProvider.OPENAI; // Assuming OpenAI for now
              const aiConfig: AIServiceConfig = { 
                  provider,
                  apiKey: config.openai.apiKey, 
                  defaultModel: options?.aiModel || config.openai.defaultModel
              };
              const adapter = this.aiServiceFactory.createAdapter(aiConfig); 

              const translationResponse = await adapter.translateText(
                  segment.sourceText, 
                  promptData, 
                  adapterOptions 
              );
              
              // 3. Update Segment
              segment.translation = translationResponse.translatedText;
              segment.status = SegmentStatus.TRANSLATED;
              segment.error = undefined; 
              // TODO: Store translation metadata
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
    logger.info(`[${this.serviceName}.${methodName}] Starting translation logic (now likely handled by worker calling translateSegment) for file ID: ${fileId}`);

    const file = await File.findById(fileId).exec();
    validateEntityExists(file, '文件');
    
    // The loop calling buildTranslationPrompt and adapter.translateText is removed 
    // because the worker calls translateSegment individually.
    // The status update logic at the end might still be relevant if called separately.

    // --- Update File status and counts (Keep this logic if method is still used for status updates) ---
    try {
        const translatedCount = await Segment.countDocuments({ fileId: file._id, status: SegmentStatus.TRANSLATED });
        const failedCount = await Segment.countDocuments({ fileId: file._id, status: { $in: [SegmentStatus.ERROR, SegmentStatus.TRANSLATION_FAILED] } });
        
        // Check if total processed matches segment count
        const totalProcessed = translatedCount + failedCount;
        const expectedSegments = file.segmentCount || await Segment.countDocuments({ fileId: file._id }); // Fallback if segmentCount is not set

        if (totalProcessed >= expectedSegments) { // Use >= in case counts are off slightly
            if (failedCount > 0) {
                file.status = FileStatus.ERROR; 
                file.errorDetails = `${failedCount} segment(s) failed to translate during batch processing.`;
            } else {
                file.status = FileStatus.TRANSLATED;
                file.errorDetails = undefined;
            }
        } else {
             // If called before all segments are done, maybe keep TRANSLATING?
             // Or introduce PARTIALLY_TRANSLATED?
             // Let's assume it remains TRANSLATING until completion is detected.
             // file.status = FileStatus.TRANSLATING; 
             logger.warn(`[${this.serviceName}.${methodName}] File ${fileId} status update check: ${totalProcessed}/${expectedSegments} segments processed.`);
        }
        await file.save();
        logger.info(`[${this.serviceName}.${methodName}] Updated file status after check for file ID: ${fileId}. Final status: ${file.status}`);
    } catch (fileUpdateError) {
         logger.error(`[${this.serviceName}.${methodName}] Failed to update file status after translation check for file ID: ${fileId}:`, fileUpdateError);
    }
  }
}

export const translationService = new TranslationService(); 

// Placeholder for prompt building logic - Now needs context object
interface ProcessedPrompt {
    systemInstruction: string;
    userPrompt: string;
}
interface PromptBuildContext {
  promptTemplateId?: string | Types.ObjectId;
  sourceLanguage?: string;
  targetLanguage?: string;
  domain?: string;
  terms?: ITermEntry[]; // Added terms
}
// Update buildTranslationPrompt to accept context and use terms
const buildTranslationPrompt = (sourceText: string, context: PromptBuildContext): ProcessedPrompt => {
    // Base instruction - incorporate language/domain from context if available
    const sourceLang = context.sourceLanguage || '[Source Language]';
    const targetLang = context.targetLanguage || '[Target Language]';
    const domainInfo = context.domain ? ` Domain: ${context.domain}.` : '';
    let systemInstruction = `Translate the following text from ${sourceLang} to ${targetLang}.${domainInfo} Respond only with the translation.`;

    // Add terminology instruction if terms are provided in context
    if (context.terms && context.terms.length > 0) {
        const formattedTerms = context.terms.map(term => `[${term.source} -> ${term.target}]`).join(', ');
        const terminologyInstruction = `\n\nStrictly adhere to the following terminology: ${formattedTerms}.`;
        systemInstruction += terminologyInstruction;
    }

    // TODO: Add prompt template lookup/rendering using context.promptTemplateId
    // For now, just using the built system instruction and source text
    // This should eventually use promptProcessor.buildTranslationPrompt

    return {
        systemInstruction: systemInstruction,
        userPrompt: sourceText, // Placeholder - should use rendered template user prompt
    };
}; 