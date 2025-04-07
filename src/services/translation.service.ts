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
import { File, IFile } from '../models/file.model';
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

// Define and export TranslationUnit interface needed by file processors
export interface TranslationUnit {
  id: string; // Often corresponds to segment or unit ID in the file
  segments: ISegment[]; // Contains one or more segments belonging to the unit
  context?: string; // Optional context information
  // Add other relevant fields if needed (e.g., notes, status)
}

export class TranslationService {
  private serviceName = 'TranslationService';

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

      const sourceLang = options?.sourceLanguage || file.metadata.sourceLanguage;
      const targetLang = options?.targetLanguage || file.metadata.targetLanguage;
      
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
}

export const translationService = new TranslationService(); 