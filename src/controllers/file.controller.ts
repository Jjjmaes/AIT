import { Request, Response, NextFunction } from 'express';
import { fileManagementService } from '../services/fileManagement.service';
import { validateId, validateEntityExists } from '../utils/errorHandler';
import { AppError, ValidationError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';
import { FileType } from '../models/file.model';
import { validateFileType } from '../utils/fileUtils'; // Assuming validateFileType exists here
import fs from 'fs/promises'; // Import fs for cleanup
import { translationQueueService, JobStatus } from '../services/translationQueue.service'; // Import queue service AND JobStatus type
import { JobState } from 'bullmq'; // <-- Import JobState from bullmq
import { projectService } from '../services/project.service'; // Import project service for validation
import { aiConfigService } from '../services/aiConfig.service';
import { TranslationStatusResponse } from '../types/translation.types'; // <-- Import the new type
import { File, FileStatus, IFile } from '../models/file.model'; // Import File model and status
import { Segment, SegmentStatus } from '../models/segment.model'; // Import Segment model and status

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

export class FileController {
  private serviceName = 'FileController'; // Add service name

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
      const project = await projectService.getProjectById(projectId, userId, userRoles);
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
      const fileRecord = await fileManagementService.processUploadedFile(
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
          const files = await fileManagementService.getFilesByProjectId(projectId, userId, userRoles);
          // Return plain objects
          res.status(200).json({ success: true, data: files.map(f => f.toObject()) }); 
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
           const file = await fileManagementService.getFileById(fileId, projectId, userId, userRoles);
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
           await fileManagementService.deleteFile(fileId, projectId, userId, userRoles);
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
      // We don't strictly need the project object here anymore unless we validate 
      // if the chosen templates/configs are compatible, but let's keep it for now.
      const project = await projectService.getProjectById(projectId, userId, userRoles);
      validateEntityExists(project, '项目');

      logger.info(`User ${userId} queuing translation for file ${fileId} in project ${projectId} using AI Config ${aiConfigId} and Prompt ${promptTemplateId}`);

      // 3. Call QueueService to enqueue the job, passing the determined IDs
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
        jobId: jobId // Return job ID
      });

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      next(error);
    }
  }

  // --- Method to get job status (ENHANCED) ---
  getTranslationJobStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const methodName = 'getTranslationJobStatus';
    const { jobId: requestedJobId } = req.params; // Rename to avoid confusion
    const userId = req.user?.id;
    const userRoles = req.user?.role ? [req.user.role] : [];

    try {
      // Extract the actual MongoDB File ID from the Job ID
      const fileId = requestedJobId?.startsWith('file-') 
                     ? requestedJobId.split('-')[1] 
                     : requestedJobId; // Fallback if prefix is missing

      if (!fileId) {
        return next(new ValidationError('无法从任务ID中解析文件ID'));
      }
      validateId(fileId, '文件ID'); // Validate the extracted ID format

      if (!userId) {
        return next(new AppError('认证失败，无法获取用户ID', 401));
      }

      logger.info(`User ${userId} fetching status for file/job ${fileId}`);

      // 1. Fetch File temporarily to get projectId (no permission check yet)
      const tempFile = await File.findById(fileId).select('projectId').lean().exec();
      if (!tempFile || !tempFile.projectId) {
          logger.warn(`File or project ID not found for file ID: ${fileId}`);
          return next(new NotFoundError(`文件 ${fileId} 未找到`));
      }
      const projectId = tempFile.projectId.toString();
      // --- Move validation here ---
      validateId(projectId, '项目');

      // 2. Fetch the File document properly using service for permission check
      const fileDoc: IFile | null = await fileManagementService.getFileById(fileId, projectId, userId, userRoles);
      if (!fileDoc) { 
          // This case implies a permission error from the service
          logger.warn(`Permission denied for file ID: ${fileId}, User: ${userId}`);
          return next(new AppError(`无权访问文件 ${fileId}`, 403)); // Return 403 Forbidden
      }

      // 3. Fetch Segment counts for progress calculation
      // Use fileDoc!._id as fileDoc is guaranteed non-null here by checks above
      const totalSegments = await Segment.countDocuments({ fileId: fileDoc!._id });
      const completedSegments = await Segment.countDocuments({ 
          fileId: fileDoc!._id, 
          status: { $in: [SegmentStatus.TRANSLATED, SegmentStatus.TRANSLATED_TM] } 
      });
      const erroredSegments = await Segment.countDocuments({ 
          fileId: fileDoc!._id, 
          status: { $in: [SegmentStatus.ERROR, SegmentStatus.TRANSLATION_FAILED] }
      });
      
      // Use fileDoc directly here as it passed null checks
      const fileProgress = totalSegments > 0 ? Math.round((completedSegments / totalSegments) * 100) : (fileDoc.status === FileStatus.COMPLETED || fileDoc.status === FileStatus.TRANSLATED ? 100 : 0);

      // 4. Determine overall status (Use File status primarily)
      let overallStatus: TranslationStatusResponse['status'] = 'processing'; // Default
      if (fileDoc.status === FileStatus.PENDING) {
          overallStatus = 'queued'; // Map PENDING to queued for frontend
      } else if (fileDoc.status === FileStatus.PROCESSING || fileDoc.status === FileStatus.TRANSLATING || fileDoc.status === FileStatus.REVIEWING) {
          overallStatus = 'processing';
      } else if (fileDoc.status === FileStatus.COMPLETED || fileDoc.status === FileStatus.TRANSLATED || fileDoc.status === FileStatus.REVIEW_COMPLETED) {
          overallStatus = 'completed';
      } else if (fileDoc.status === FileStatus.ERROR) {
          overallStatus = 'failed';
      }

      // 5. Construct the detailed response
      const responseData: TranslationStatusResponse = {
        status: overallStatus,
        progress: fileProgress,
        totalFiles: 1, 
        completedFiles: (overallStatus === 'completed') ? 1 : 0,
        // Use fileDoc directly
        errors: fileDoc.status === FileStatus.ERROR ? [{ fileId: fileDoc._id.toString(), message: fileDoc.errorDetails || '文件处理失败' }] : [],
        files: [
          {
            id: fileDoc._id.toString(),
            originalName: fileDoc.originalName || fileDoc.fileName, 
            status: fileDoc.status, 
            progress: fileProgress,
            sourceLanguage: fileDoc.metadata?.sourceLanguage, 
            targetLanguage: fileDoc.metadata?.targetLanguage, 
          }
        ],
      };

      res.status(200).json({
        success: true,
        data: responseData
      });

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for file/job ${requestedJobId}:`, error);
      // Handle specific errors like validation or DB issues
      if (error instanceof NotFoundError) {
         return res.status(404).json({ success: false, message: error.message });
      }
      // Use the central error handler for other types of errors
      next(error);
    }
  };
  // --- END Method to get job status ---
}

// Export class directly, instantiation happens in routes file
// export default new FileController(); 