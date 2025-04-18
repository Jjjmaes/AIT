import { Request, Response, NextFunction } from 'express';
// Import instances directly where appropriate
// import { fileManagementService } from '../services/fileManagement.service'; 
import { FileManagementService } from '../services/fileManagement.service'; // Import class for DI
import { validateId, validateEntityExists } from '../utils/errorHandler';
import { AppError, ValidationError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';
import { FileType } from '../models/file.model';
import { validateFileType } from '../utils/fileUtils';
import fs from 'fs/promises';
// Import instance and type
import { translationQueueService, JobStatus as JobStatusType } from '../services/translationQueue.service'; 
// import { TranslationQueueService } from '../services/translationQueue.service'; // Remove class import
import { JobState } from 'bullmq';
import { ProjectService } from '../services/project.service'; // Keep class import for DI
import { AIConfigService } from '../services/aiConfig.service'; // Keep class import for DI
// Remove direct instance imports for DI services
// import { projectService } from '../services/project.service';
// import { aiConfigService } from '../services/aiConfig.service'; 
import { TranslationStatusResponse } from '../types/translation.types';
import { File, FileStatus, IFile } from '../models/file.model';
import { Segment, SegmentStatus, ISegment } from '../models/segment.model'; // Import ISegment if Segment is the class
import { Inject, Service } from 'typedi';

// Assuming AuthRequest extends Request and includes user info
// Define it here or import from auth middleware if defined there
// Match the structure used in ProjectController
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
}

@Service()
export class FileController {
  private serviceName = 'FileController';

  // Inject FileManagementService along with others
  constructor(
    // @Inject() private fileManagementService: FileManagementService, // Remove
    @Inject() private projectService: ProjectService,
    @Inject() private aiConfigService: AIConfigService,
    @Inject() private fileManagementService: FileManagementService // Inject here
    // @Inject() private translationQueueService: TranslationQueueService // Remove
  ) {}

  uploadFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const methodName = 'uploadFile';
    const { projectId } = req.params;
    const userId = req.user?.id;
    const userRoles = req.user?.role ? [req.user.role] : [];

    try {
      validateId(projectId, '项目');
      if (!userId) {
        return next(new AppError('认证失败，无法获取用户ID', 401));
      }
      // Check if req.file exists AFTER multer has run
      if (!req.file) {
        // Log the request body/headers if needed for debugging
        logger.error('File upload error: req.file is undefined. Check multer setup and client request.');
        return next(new AppError('未找到上传的文件或上传处理失败', 400));
      }

      // Fetch project details to get language pairs
      // Use injected service: this.projectService
      const project = await this.projectService.getProjectById(projectId, userId, userRoles);
      validateEntityExists(project, '项目');
      if (!project.languagePairs || project.languagePairs.length === 0) {
        // Clean up the uploaded file if project validation fails early
        if (req.file?.path) {
           fs.unlink(req.file.path).catch(unlinkErr => logger.error(`Failed to delete orphaned file ${req.file?.path}:`, unlinkErr));
        }
        return next(new AppError(`项目 ${projectId} 未配置语言对，无法上传文件`, 400));
      }
      // Use the first language pair from the project
      const { source: projectSourceLang, target: projectTargetLang } = project.languagePairs[0];

      // --- Filename Decoding ---
      let decodedOriginalName = req.file.originalname;
      try {
        // Multer should handle RFC 5987 percent-encoding, but this adds robustness
        decodedOriginalName = decodeURIComponent(req.file.originalname);
        // Optional: Add further sanitization/normalization if needed
        // decodedOriginalName = path.normalize(decodedOriginalName);
      } catch (e) {
        // Log if decoding fails, but proceed with the raw name as a fallback
        // This might happen if the name is already UTF-8 and contains '%' incorrectly
        logger.warn(`Failed to decode originalname: "${req.file.originalname}". Using raw value. Error:`, e);
      }
      // --- End Filename Decoding ---

      logger.info(`User ${userId} uploading file "${decodedOriginalName}" to project ${projectId} (Languages: ${projectSourceLang} -> ${projectTargetLang})`);

      // Use decoded name for validation
      const fileType = validateFileType(decodedOriginalName, req.file.mimetype);
      if (!fileType) {
          // Use decoded name in error message too
          // Clean up the uploaded file before throwing error
          if (req.file?.path) {
             fs.unlink(req.file.path).catch(unlinkErr => logger.error(`Failed to delete invalid file type ${req.file?.path}:`, unlinkErr));
          }
          throw new ValidationError(`不支持的文件类型: "${decodedOriginalName}" (MIME: ${req.file.mimetype})`);
      }

      // --- Prepare File Info ---
      const fileInfo = {
        path: req.file.path,            // Path where multer saved the temp file
        filePath: req.file.path,        // Duplicate, maybe consolidate later
        originalName: decodedOriginalName, // *** Use the decoded name ***
        mimeType: req.file.mimetype,
        size: req.file.size,
        fileType: fileType,             // Determined file category (e.g., 'document', 'xliff')
        destination: req.file.destination,// Folder where multer saved the file
        filename: req.file.filename     // Unique temporary filename generated by multer
      };
      // --- End Prepare File Info ---

      // Pass languages obtained from the project to the service
      // Use injected service: this.fileManagementService
      const fileRecord = await this.fileManagementService.processUploadedFile(
        projectId,
        userId,
        fileInfo,
        projectSourceLang, // Use language from project
        projectTargetLang, // Use language from project
        userRoles
      );

      // If processUploadedFile succeeds, the file is managed by the service
      // and potentially moved or copied, so no cleanup needed here for success case.

      res.status(201).json({
        success: true,
        message: '文件上传成功并开始处理',
        data: fileRecord.toObject() // Return the created DB record
      });

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      // --- Error Cleanup ---
      // Ensure temporary file is deleted if an error occurs AFTER multer succeeded
      // but BEFORE the file is successfully processed by the service.
      if (req.file?.path) {
        // Use fs.promises.unlink and handle potential errors during cleanup
        fs.unlink(req.file.path).catch(unlinkErr =>
            logger.error(`[Error Cleanup] Failed to delete uploaded file ${req.file?.path} after error:`, unlinkErr)
        );
      }
      // --- End Error Cleanup ---
      next(error); // Pass error to the central error handler
    }
  }

  async getFiles(req: AuthRequest, res: Response, next: NextFunction) {
      const methodName = 'getFiles';
      const { projectId } = req.params;
      const userId = req.user?.id;
      const userRoles = req.user?.role ? [req.user.role] : []; // Extract roles
      try {
          validateId(projectId, '项目');
          if (!userId) return next(new AppError('认证失败', 401));

          // Pass roles
          // Use injected service: this.fileManagementService
          const files = await this.fileManagementService.getFilesByProjectId(projectId, userId, userRoles);
          // Return plain objects
          res.status(200).json({ success: true, data: files.map((f: IFile) => f.toObject()) }); 
      } catch (error) {
          logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
          next(error);
      }
  }

  async getFile(req: AuthRequest, res: Response, next: NextFunction) {
       const methodName = 'getFile';
       const { projectId, fileId } = req.params;
       const userId = req.user?.id;
       const userRoles = req.user?.role ? [req.user.role] : []; // Extract roles
       try {
           validateId(projectId, '项目');
           validateId(fileId, '文件');
           if (!userId) return next(new AppError('认证失败', 401));

           // Pass roles
           // Use injected service: this.fileManagementService
           const file = await this.fileManagementService.getFileById(fileId, projectId, userId, userRoles);
           if (!file) {
               return next(new NotFoundError('文件未找到'));
           }
           // Return plain object
           res.status(200).json({ success: true, data: file.toObject() }); 
       } catch (error) {
           logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
           next(error);
       }
  }

  async deleteFile(req: AuthRequest, res: Response, next: NextFunction) {
       const methodName = 'deleteFile';
       const { projectId, fileId } = req.params;
       const userId = req.user?.id;
       const userRoles = req.user?.role ? [req.user.role] : []; // Extract roles
       try {
           validateId(projectId, '项目');
           validateId(fileId, '文件');
           if (!userId) return next(new AppError('认证失败', 401));

           // Pass roles
           // Use injected service: this.fileManagementService
           await this.fileManagementService.deleteFile(fileId, projectId, userId, userRoles);
           res.status(200).json({ success: true, message: '文件已成功删除' });
    } catch (error) {
           logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      next(error);
    }
  }

  // Placeholder for starting translation
  startTranslation = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const methodName = 'startTranslation';
    const { projectId, fileId } = req.params;
    const userId = req.user?.id;
    const userRoles = req.user?.role ? [req.user.role] : [];
    
    // <<< Get settings from request body >>>
    const { 
        promptTemplateId, 
        aiConfigId, // Assuming frontend sends aiConfigId directly now
        options = {} // Keep options for other potential settings
    } = req.body;

    try {
      validateId(projectId, '项目');
      validateId(fileId, '文件');
      if (!userId) return next(new AppError('认证失败', 401));

      // <<< Validate required IDs from body >>>
      if (!promptTemplateId) {
        return next(new ValidationError('缺少必要的参数: promptTemplateId'));
      }
      if (!aiConfigId) {
         return next(new ValidationError('缺少必要的参数: aiConfigId'));
      }
      validateId(promptTemplateId, '提示词模板');
      validateId(aiConfigId, 'AI 配置');

      // 1. Validate user permission (projectService.getProjectById already does this)
      // Use injected service: this.projectService
      const project = await this.projectService.getProjectById(projectId, userId, userRoles);
      validateEntityExists(project, '项目');

      // <<< Add validation for AI Config existence (optional but good practice) >>>
      // Use injected service: this.aiConfigService
      const aiConfigExists = await this.aiConfigService.getConfigById(aiConfigId);
      if (!aiConfigExists) {
          return next(new NotFoundError(`AI 配置未找到: ${aiConfigId}`));
      }
      // <<< Add similar validation for Prompt Template existence (if you have a service for it) >>>
      // const promptExists = await this.promptTemplateService.getPromptById(promptTemplateId, userId);
      // if (!promptExists) {
      //     return next(new NotFoundError(`提示词模板未找到: ${promptTemplateId}`));
      // }

      logger.info(`User ${userId} queuing translation for file ${fileId} in project ${projectId} using AI Config ${aiConfigId} and Prompt ${promptTemplateId}`);

      // 3. Call QueueService to enqueue the job, passing the determined IDs
      // Use injected service: this.translationQueueService
      const jobId = await translationQueueService.addFileTranslationJob(
        projectId,
        fileId,
        aiConfigId,         // <<< Pass from req.body
        promptTemplateId,   // <<< Pass from req.body
        options,            // Pass remaining options
        userId,
        userRoles
      );

      // 4. Return job ID or success message
      res.status(202).json({
        success: true,
        message: '翻译请求已接收',
        data: { jobId }
      });
    } catch (error) {
        logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
        next(error);
    }
  }

  getTranslationJobStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
      const methodName = 'getTranslationJobStatus';
      // Only expect jobId from params for this route
      const { jobId } = req.params;
      const userId = req.user?.id;
      // const userRoles = req.user?.role ? [req.user.role] : []; // Roles not used without project/file check

      try {
          // Remove projectId and fileId validation
          // validateId(projectId, '项目'); 
          // validateId(fileId, '文件');
          validateId(jobId, '任务');
          if (!userId) return next(new AppError('认证失败', 401));

          // Remove project/file permission checks as IDs are not available from route
          // await this.projectService.getProjectById(projectId, userId, userRoles); 
          // const file = await this.fileManagementService.getFileById(fileId, projectId, userId, userRoles); 
          // if (!file) {
          //     return next(new NotFoundError(`文件 ${fileId} 未找到或无权访问`));
          // }

          logger.info(`User ${userId} checking status for job ${jobId}`);

          let jobStatusResult;
          try {
            jobStatusResult = await translationQueueService.getJobStatus(jobId);
          } catch (error) {
            // Keep error handling for job not found
            if (error instanceof NotFoundError) {
                logger.warn(`Job ${jobId} not found via getJobStatus.`);
                // Cannot fallback to file status without fileId
                return next(new NotFoundError(`任务 ${jobId} 未找到`)); 
            } else {
                throw error;
            }
          }
          
          // Remove the !jobStatusResult fallback logic as it relied on fileId/file status
          // if (!jobStatusResult) { ... }

          // --- Job found via getJobStatus --- 
          if (jobStatusResult.jobId !== jobId) {
              logger.warn(`Security Warning: Mismatched job ID. Requested ${jobId}, but status returned for ${jobStatusResult.jobId}`);
              // Optional: Return error or proceed cautiously?
              return next(new AppError(`Job ID mismatch while checking status`, 500));
          }

          const state = jobStatusResult.status as JobState;
          const progress = Number(jobStatusResult.progress) || 0;
          const failedReason = jobStatusResult.failedReason;

          let overallStatus: TranslationStatusResponse['status']; 
          const stateStr = state as string;
          switch (stateStr) {
              case 'completed': overallStatus = 'completed'; break;
              case 'failed': overallStatus = 'failed'; break;
              case 'active': overallStatus = 'processing'; break;
              case 'waiting':
              case 'waiting-children': 
              case 'delayed': overallStatus = 'pending'; break;
              case 'paused': overallStatus = 'pending'; break;
              default: overallStatus = 'unknown'; break;
          }

          // Construct a simplified response as file details are not available here
          const response: Partial<TranslationStatusResponse> = { // Make response partial
              status: overallStatus,
              progress: progress,
              // Cannot determine file counts without project/file context
              // completedFiles: overallStatus === 'completed' ? 1 : 0, 
              // totalFiles: 1, 
              // Set errors to undefined if failedReason exists, as we don't have fileId
              errors: failedReason ? undefined : undefined, // Ensure it's always undefined or matches expected type
              // Cannot include file details without file context
              // files: [...] 
          };

          // If there was a failure, maybe log the reason separately
          if (failedReason) {
              logger.warn(`Job ${jobId} failed. Reason: ${failedReason}`);
          }

          res.status(200).json({ success: true, data: response });

      } catch (error) {
          logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
          next(error);
      }
  };

  // New method to get segment details for a file
  async getSegments(req: AuthRequest, res: Response, next: NextFunction) {
      const methodName = 'getSegments';
      const { projectId, fileId } = req.params;
      const { status, page = 1, limit = 10 } = req.query; 
      const userId = req.user?.id;
      const userRoles = req.user?.role ? [req.user.role] : []; // Keep roles in case needed later or by service internally

      try {
          validateId(projectId, '项目');
          validateId(fileId, '文件');
          if (!userId) return next(new AppError('认证失败', 401));

          // Validate user access to the file first using fileManagementService
          await this.fileManagementService.getFileById(fileId, projectId, userId, userRoles);

          const parsedPage = parseInt(page as string, 10);
          const parsedLimit = parseInt(limit as string, 10);
          const segmentStatus = status ? status as SegmentStatus : undefined;

          logger.info(`User ${userId} fetching segments for file ${fileId} (Project: ${projectId}), Status: ${segmentStatus}, Page: ${parsedPage}, Limit: ${parsedLimit}`);

          // Use the injected projectService and its getFileSegments method
          const result = await this.projectService.getFileSegments(
              fileId,
              userId, 
              // Pass filters object matching the service method signature
              { status: segmentStatus, page: parsedPage, limit: parsedLimit } 
              // userRoles is not directly accepted by the found signature, userId is used
          );

          // The ProjectService.getFileSegments method returns { segments: ISegment[], total: number, page: number, limit: number }
          // which doesn't include totalPages directly, but we can calculate it.
          const totalPages = Math.ceil(result.total / result.limit);

          res.status(200).json({
              success: true,
              data: {
                  // Ensure result.segments exists before mapping
                  segments: result.segments ? result.segments.map((s: ISegment) => s.toObject()) : [], 
                  totalCount: result.total,
                  page: result.page,
                  limit: result.limit,
                  totalPages: totalPages // Calculate totalPages
              }
          });
      } catch (error) {
          logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
          next(error);
      }
  }
}

// Export class directly, instantiation happens in routes file
// export default new FileController(); 