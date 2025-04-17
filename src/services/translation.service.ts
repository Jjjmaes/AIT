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
import { promptProcessor, ProcessedPrompt, PromptBuildContext } from '../utils/promptProcessor';
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
import { aiConfigService } from './aiConfig.service';
import { IAIProviderConfig } from '../models/aiConfig.model';
import User from '../models/user.model';

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
    requesterRoles: string[] = [],
    aiConfigId: string, 
    promptTemplateId: string | Types.ObjectId,
    options?: TranslationOptions
  ): Promise<ISegment> {
    const methodName = 'translateSegment';
    // Add detailed logs for entry and parameters
    logger.debug(`[${this.serviceName}.${methodName}] ENTER - segmentId: ${segmentId}, userId: ${userId}, aiConfigId: ${aiConfigId}, promptTemplateId: ${promptTemplateId}`, { options });
    
    validateId(segmentId, '段落');
    validateId(userId, '用户');
    validateId(aiConfigId, 'AI 配置');
    // No need to validate promptTemplateId as string, can be ObjectId
    // validateId(promptTemplateId.toString(), '提示词模板');

    try {
      const segment = await segmentService.getSegmentById(segmentId);
      validateEntityExists(segment, '段落');
      
      if (segment.status !== SegmentStatus.PENDING && segment.status !== SegmentStatus.ERROR) {
        logger.warn(`Segment ${segmentId} already processed or in progress (status: ${segment.status}). Skipping translation.`);
        return segment;
      }

      const file = await File.findById(segment.fileId).exec();
      validateEntityExists(file, '关联文件');
      const project = await this.projectService.getProjectById(file.projectId.toString(), userId, requesterRoles);
      validateEntityExists(project, '关联项目');
      
      // Use nullish coalescing for metadata
      const fileMetadata = file.metadata ?? {}; 
      const sourceLang = options?.sourceLanguage || fileMetadata.sourceLanguage;
      const targetLang = options?.targetLanguage || fileMetadata.targetLanguage;
      
      if (!sourceLang || !targetLang) {
        throw new ValidationError('Source or target language missing for translation.');
      }

      // --- Check Translation Memory --- 
      logger.debug(`[${this.serviceName}.${methodName}] Checking Translation Memory for segment ${segmentId}...`);
      const tmMatches = await this.translationMemoryService.findMatches(
          segment.sourceText,
          sourceLang,
          targetLang,
          project._id.toString()
      );
      
      const exactMatch = tmMatches.find(match => match.score === 100); // Check for 100% score

      if (exactMatch) {
          logger.info(`[${this.serviceName}.${methodName}] Found 100% TM match for segment ${segmentId}.`);
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
          
          logger.info(`[${this.serviceName}.${methodName}] Segment ${segmentId} translated successfully using TM.`);
          return updatedSegment;
      }
      // --- End TM Check --- 
      logger.debug(`[${this.serviceName}.${methodName}] No 100% TM match found. Proceeding with AI for segment ${segmentId}.`);

      // --- If no 100% TM match, proceed with AI Translation ---
      // Log before updating status
      logger.debug(`[${this.serviceName}.${methodName}] Updating segment ${segmentId} status to TRANSLATING.`);
      await segmentService.updateSegment(segmentId, { status: SegmentStatus.TRANSLATING });

      // --- Fetch Terminology --- 
      let terms: ITermEntry[] = [];
      try {
          if (project.terminology) {
              const terminologyList = await this.terminologyService.getTerminologyById(project.terminology.toString());
              if (terminologyList?.terms) {
                  terms = terminologyList.terms;
                  logger.info(`[${this.serviceName}.${methodName}] Fetched ${terms.length} terms for project ${project._id}.`);
              }
          }
      } catch (error) {
          logger.error(`[${this.serviceName}.${methodName}] Failed to fetch terminology for project ${project._id}. Proceeding without terms.`, { error });
      }
      // ---------------------------
      
      // Log before fetching AI config
      logger.debug(`[${this.serviceName}.${methodName}] Fetching AI Config ${aiConfigId}...`);
      const aiConfig: IAIProviderConfig | null = await aiConfigService.getConfigById(aiConfigId);
      if (!aiConfig) {
          throw new AppError(`AI 配置 ${aiConfigId} 未找到`, 404);
      }
      if (!aiConfig.providerName || !aiConfig.models || aiConfig.models.length === 0) {
        throw new AppError(`AI 配置 ${aiConfigId} 缺少提供商或模型信息`, 404);
      }
      logger.debug(`[${this.serviceName}.${methodName}] Fetched AI Config: ${aiConfig.providerName}`);

      const promptContext: PromptBuildContext = {
        promptTemplateId: promptTemplateId,
        sourceLanguage: sourceLang!, // Assert non-null after check
        targetLanguage: targetLang!, // Assert non-null after check
        domain: options?.domain || project.domain,
        terms: terms, // Pass the fetched terms
        // Include other context variables if needed by templates
      };

      // Log before building prompt
      logger.debug(`[${this.serviceName}.${methodName}] Building translation prompt...`);
      const promptData: ProcessedPrompt = await promptProcessor.buildTranslationPrompt(
        segment.sourceText,
        promptContext
      );
      logger.debug(`[${this.serviceName}.${methodName}] Prompt built.`); // Maybe log promptData.userPrompt length if needed

      // Determine the model to use (from options, or AIConfig default)
      const modelToUse = options?.aiModel || aiConfig.models[0]; // Use first model as default for now
      logger.debug(`[${this.serviceName}.${methodName}] Determined AI Model to use: ${modelToUse}`);

      // Convert providerName string to AIProvider enum
      const providerEnumKey = aiConfig.providerName.toUpperCase() as keyof typeof AIProvider;
      const providerEnumValue = AIProvider[providerEnumKey];

      if (!providerEnumValue) {
        throw new AppError(`Unsupported AI provider name: ${aiConfig.providerName}`, 400);
      }

      // Log before getting adapter
      logger.debug(`[${this.serviceName}.${methodName}] Getting AI adapter for provider: ${providerEnumValue}`);
      // Get the adapter using the AIProvider enum value
      // Pass only the provider enum, assuming factory handles config loading
      const adapter = this.aiServiceFactory.getAdapter(providerEnumValue);
      
      // Validate adapter existence
      if (!adapter) {
        throw new AppError(`Could not get AI adapter for provider: ${aiConfig.providerName}`, 500);
      }
      
      // Prepare options specifically for the adapter call, including overrides
      const adapterOptions: TranslationOptions & { model?: string; temperature?: number } = {
        ...options, // Spread original options first
        sourceLanguage: sourceLang!, // Ensure languages are set
        targetLanguage: targetLang!,
        // Pass specific overrides
        aiModel: modelToUse, 
        temperature: options?.temperature, 
        // Include other relevant fields from TranslationOptions if needed by adapter
        aiProvider: aiConfig.providerName, // Keep original string for metadata?
        promptTemplateId: promptTemplateId?.toString(),
        domain: promptContext.domain
      };

      // Log before calling adapter.translateText
      logger.debug(`[${this.serviceName}.${methodName}] Calling adapter.translateText for segment ${segmentId}...`, { adapterOptions });
      let promptTemplateObjectId: Types.ObjectId | undefined = undefined;
      if (promptTemplateId instanceof Types.ObjectId) {
        promptTemplateObjectId = promptTemplateId;
      } else if (Types.ObjectId.isValid(promptTemplateId)) {
        promptTemplateObjectId = new Types.ObjectId(promptTemplateId);
      } else {
        logger.warn(`Invalid promptTemplateId format: ${promptTemplateId}. Cannot convert to ObjectId.`);
      }

      const startTime = Date.now();
      // Call translateText with sourceText, promptData, and adapterOptions
      const response = await adapter.translateText(
          segment.sourceText,
          promptData,
          adapterOptions // Pass the combined options
      );
      const processingTime = Date.now() - startTime;
      // Log after successful adapter call
      logger.debug(`[${this.serviceName}.${methodName}] adapter.translateText successful for segment ${segmentId}. Time: ${processingTime}ms. Response length: ${response?.translatedText?.length ?? 0}`);

      // Log before preparing update data
      logger.debug(`[${this.serviceName}.${methodName}] Preparing update data for segment ${segmentId}...`);
      const updateData: Partial<ISegment> = {
        translation: response.translatedText,
        status: SegmentStatus.TRANSLATED,
        translatedLength: response.translatedText?.length ?? 0, // Handle potential null/undefined
        translationMetadata: {
          aiModel: response.modelInfo.model, // Store the actual model used
          promptTemplateId: promptTemplateObjectId, // Store the ObjectId if valid
          tokenCount: response.tokenCount?.total,
          processingTime: processingTime,
          // Removed aiConfigId, maybe store providerName or model used from response?
          // aiProvider: response.modelInfo.provider (example)
        },
        translationCompletedAt: new Date(),
        error: undefined
      };

      // Log before updating segment in DB
      logger.debug(`[${this.serviceName}.${methodName}] Saving translated segment ${segmentId} to DB...`);
      const updatedSegment = await segmentService.updateSegment(segmentId, updateData);
      validateEntityExists(updatedSegment, '更新后的段落');
      logger.debug(`[${this.serviceName}.${methodName}] Segment ${segmentId} saved successfully.`);

      // Log before updating file progress
      logger.debug(`[${this.serviceName}.${methodName}] Updating file progress for file ${file._id} due to segment ${segmentId}...`);
      projectService.updateFileProgress(file._id.toString(), userId).catch(err => {
          logger.error(`Failed to update file progress for ${file._id} after segment ${segmentId} translation:`, err);
      });

      // Log successful exit
      logger.info(`[${this.serviceName}.${methodName}] EXIT - Segment ${segmentId} translated successfully using AI.`);
      return updatedSegment;

    } catch (error) {
      // Log the error within the service method
      logger.error(`[${this.serviceName}.${methodName}] ERROR for segment ${segmentId}: ${error instanceof Error ? error.message : 'Unknown error'}`, { error }); // Log full error object
      try {
          // Log before attempting to mark segment as error
          logger.warn(`[${this.serviceName}.${methodName}] Attempting to mark segment ${segmentId} as ERROR in DB due to previous failure.`);
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
    requesterRoles: string[] = [],
    aiConfigId: string,
    promptTemplateId: string | Types.ObjectId,
    options?: TranslationOptions
  ): Promise<void> {
    const methodName = 'translateFile';
    validateId(projectId, '项目');
    validateId(fileId, '文件');
    validateId(userId, '用户');
    validateId(aiConfigId, 'AI 配置');
    // validateId(promptTemplateId.toString(), '提示词模板');

    try {
      const project = await projectService.getProjectById(projectId, userId, requesterRoles);
      const file = await File.findOne({ _id: new Types.ObjectId(fileId), projectId: project._id }).exec();
      validateEntityExists(file, '文件');
      
      // Check for required metadata *immediately* after getting the file
      const targetLanguage = options?.targetLanguage || file.metadata?.targetLanguage;
      const sourceLanguage = options?.sourceLanguage || file.metadata?.sourceLanguage; // Allow source from options too
      if (!targetLanguage || !sourceLanguage) {
          const missing = !targetLanguage && !sourceLanguage ? 'Source and target language' : !targetLanguage ? 'Target language' : 'Source language';
          logger.error(`[${this.serviceName}.${methodName}] ${missing} not found for file ${fileId}. Cannot translate.`);
          throw new AppError(`${missing} is required for translation.`, 400);
      }

      // Check if file status allows translation (e.g., EXTRACTED)
      // Allow retrying from ERROR status as well?
      if (file.status !== FileStatus.EXTRACTED && file.status !== FileStatus.ERROR) {
         logger.warn(`[${this.serviceName}.${methodName}] File ${fileId} is not in EXTRACTED or ERROR status (current: ${file.status}). Skipping translation request.`);
         // Changed to warning and return, maybe not an error to try translating completed file?
         // throw new ValidationError(`File ${fileId} is not in EXTRACTED status.`); 
         return; 
      }

      // Check if there are actually segments to translate
      // Find segments that need translation (PENDING or ERROR state)
      const segmentsToTranslateCount = await Segment.countDocuments({
        fileId: file._id,
        status: { $in: [SegmentStatus.PENDING, SegmentStatus.ERROR, SegmentStatus.TRANSLATION_FAILED] } // Include error states for retry
      }).exec();

      if (segmentsToTranslateCount === 0) {
        logger.info(`[${this.serviceName}.${methodName}] No pending or failed segments found for file ${fileId}. Nothing to translate.`);
        // Not necessarily an error, could be already completed or empty
        // throw new ValidationError(`No pending segments found for file ${fileId}.`); 
        return; 
      }

      logger.info(`[${this.serviceName}.${methodName}] Found ${segmentsToTranslateCount} segments needing translation for file ${fileId}.`);
      
      // --- Update File status --- 
      // Simply mark the file for translation; workers/other processes handle segments.
      file.status = FileStatus.TRANSLATING;
      file.errorDetails = undefined; // Clear previous errors
      await file.save();
      logger.info(`[${this.serviceName}.${methodName}] Marked file ${fileId} as TRANSLATING.`);

      // Removed job enqueuing - return void
      return; 

    } catch (error) {
       logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
       // Correct handleServiceError call (remove extra context object)
       throw handleServiceError(error, this.serviceName, methodName, '文件翻译任务提交');
    }
  }

  async translateProject(
    projectId: string,
    userId: string,
    requesterRoles: string[] = [],
    aiConfigId: string,
    promptTemplateId: string | Types.ObjectId,
    options?: TranslationOptions
  ): Promise<string> {
    const methodName = 'translateProject';
    validateId(projectId, '项目');
    validateId(userId, '用户');
    validateId(aiConfigId, 'AI 配置');
    // validateId(promptTemplateId.toString(), '提示词模板');

    try {
      const project = await projectService.getProjectById(projectId, userId, requesterRoles);
      validateEntityExists(project, '项目');

      const files = await File.find({ 
          projectId: project._id, 
          // Only include files that can be translated (e.g., EXTRACTED)
          status: FileStatus.EXTRACTED 
      }).exec();

      if (!files || files.length === 0) {
         // Consider if this should be an error or just a warning/info message
         logger.warn(`[${this.serviceName}.${methodName}] No extractable files found in project ${projectId}.`);
         throw new ValidationError('项目没有待翻译的文件 (状态为 EXTRACTED)');
      }

      // Determine source/target languages for the project job
      // This assumes all files in the project share the same primary language pair
      // Might need more complex logic if languages vary per file
      const firstFileWithLangs = files.find(f => f.metadata?.sourceLanguage && f.metadata?.targetLanguage);
      const sourceLanguage = options?.sourceLanguage || firstFileWithLangs?.metadata?.sourceLanguage;
      const targetLanguage = options?.targetLanguage || firstFileWithLangs?.metadata?.targetLanguage;

      if (!sourceLanguage || !targetLanguage) {
          throw new AppError('无法确定项目的源语言或目标语言以进行翻译', 400);
      }
      
      // Prepare options for the project job
      const jobOptions: TranslationOptions = {
          ...options, // Spread incoming options
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage,
          aiProvider: options?.aiProvider,
          aiModel: options?.aiModel,
          promptTemplateId: promptTemplateId?.toString(),
      };
      
      // Call queue service with required arguments (6 args)
      const jobId = await translationQueueService.addProjectTranslationJob(
          projectId, 
          aiConfigId,       // Added
          promptTemplateId.toString(), // Added (ensure string)
          jobOptions,
          userId,           // Added
          requesterRoles    // Added
      );
      logger.info(`Project translation job ${jobId} added to queue for project ${projectId}`);

      // Update status of included files to QUEUED or TRANSLATING
      const fileIdsToUpdate = files.map(f => f._id);
      await File.updateMany(
          { _id: { $in: fileIdsToUpdate } },
          { $set: { status: FileStatus.TRANSLATING } } // Or specific QUEUED status
      );
      logger.info(`Updated status for ${files.length} files in project ${projectId} to TRANSLATING.`);

      return jobId;
    } catch (error) {
       logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
       // Correct handleServiceError call (remove extra context object)
       throw handleServiceError(error, this.serviceName, methodName, '项目翻译任务提交');
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

// Removed the local buildTranslationPrompt function and related interfaces
/*
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
const buildTranslationPrompt = (sourceText: string, context: PromptBuildContext): ProcessedPrompt => {
    // ... implementation ...
}; 
*/ 