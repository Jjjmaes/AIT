import { Request, Response, NextFunction } from 'express';
import { fileManagementService } from '../services/fileManagement.service';
import { validateId, validateEntityExists } from '../utils/errorHandler';
import { AppError, ValidationError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';
import { FileType } from '../models/file.model';
import { validateFileType } from '../utils/fileUtils'; // Assuming validateFileType exists here
import fs from 'fs/promises'; // Import fs for cleanup
import { translationQueueService } from '../services/translationQueue.service'; // Import queue service
import { projectService } from '../services/project.service'; // Import project service for validation
import { aiConfigService } from '../services/aiConfig.service';

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
    const userRoles = req.user?.role ? [req.user.role] : []; // Extract roles
    const { sourceLanguage, targetLanguage } = req.body;

    try {
      validateId(projectId, '项目');
      if (!userId) {
        // Use specific error from errors utility
        return next(new AppError('认证失败，无法获取用户ID', 401)); 
      }
      if (!req.file) {
        return next(new AppError('未找到上传的文件', 400));
      }
      if (!sourceLanguage || !targetLanguage) {
         return next(new ValidationError('请求体中必须提供源语言 (sourceLanguage) 和目标语言 (targetLanguage)'));
      }

      logger.info(`User ${userId} uploading file ${req.file.originalname} to project ${projectId}`);

      // Validate and determine FileType
      const fileType = validateFileType(req.file.originalname, req.file.mimetype);
      if (!fileType) {
          // Use specific error
          throw new ValidationError(`不支持的文件类型: ${req.file.originalname} (MIME: ${req.file.mimetype})`); 
      }

      // Prepare file info for the service
      const fileInfo = {
        path: req.file.path,       // Keep path for UploadedFileInfo type
        filePath: req.file.path, // Use filePath for potential schema field
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        fileType: fileType,
        destination: req.file.destination,
        filename: req.file.filename
      };

      // Call the service to process the file
      const fileRecord = await fileManagementService.processUploadedFile(
        projectId,
        userId,
        fileInfo,
        sourceLanguage,
        targetLanguage,
        userRoles // Pass roles
      );

      res.status(201).json({
        success: true,
        message: '文件上传成功并开始处理',
        data: fileRecord.toObject() // Return plain object
      });

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      // Ensure cleanup happens on error
      if (req.file?.path) {
        // Use fs.promises.unlink
        fs.unlink(req.file.path).catch(unlinkErr => 
            logger.error(`Failed to delete uploaded file ${req.file?.path} after error:`, unlinkErr)
        );
      }
      next(error);
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
    const options = req.body.options || {}; // Get options from body

    try {
      validateId(projectId, '项目');
      validateId(fileId, '文件');
      if (!userId) return next(new AppError('认证失败', 401));

      // 1. Validate user permission and get project details
      const project = await projectService.getProjectById(projectId, userId, userRoles);
      validateEntityExists(project, '项目');

      // 2. Determine AI Configuration ID
      let aiConfigId = project.translationAIConfigId?.toString(); // Get from project

      if (!aiConfigId) {
        // ---!!! HARDCODED FALLBACK (TEMPORARY) !!!---
        // TODO: Replace this with proper error handling or default config lookup
        // For now, assume a specific ID exists for testing. 
        // You MUST create an AIProviderConfig with this ID in your DB.
        const fallbackConfigId = 'HARDCODED_AI_CONFIG_ID_REPLACE_ME'; 
        logger.warn(`${methodName}: Project ${projectId} has no AI config set. Using HARDCODED fallback ID: ${fallbackConfigId}`);
        aiConfigId = fallbackConfigId;
        // Optional: Validate fallback exists
        // const fallbackConfig = await aiConfigService.getConfigById(aiConfigId);
        // if (!fallbackConfig) {
        //   throw new AppError(`Fallback AI config ID ${aiConfigId} not found`, 500);
        // }
      }
      
      // ---!!! Ensure aiConfigId is not undefined before proceeding !!!---
      if (!aiConfigId) {
         throw new AppError(`无法确定用于项目 ${projectId} 的 AI 配置`, 500);
      }

      logger.info(`User ${userId} queuing translation for file ${fileId} in project ${projectId} using AI Config ${aiConfigId}`);

      // 3. Call QueueService to enqueue the job, passing the determined aiConfigId
      const jobId = await translationQueueService.addFileTranslationJob(
        projectId,
        fileId,
        aiConfigId, // Pass the determined ID
        options,
        userId,
        userRoles
      );

      // 4. Return job ID or success message
      res.status(202).json({
        success: true,
        message: '翻译请求已接收', // Updated message
        jobId: jobId 
      });

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      next(error);
    }
  }
}

// Export class directly, instantiation happens in routes file
// export default new FileController(); 