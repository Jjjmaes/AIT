import { Request, Response, NextFunction } from 'express';
import { fileManagementService } from '../services/fileManagement.service';
import { validateId } from '../utils/errorHandler';
import { AppError, ValidationError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';
import { FileType } from '../models/file.model';
import { validateFileType } from '../utils/fileUtils'; // Assuming validateFileType exists here
import fs from 'fs/promises'; // Import fs for cleanup

// Assuming AuthRequest extends Request and includes user info
// Define it here or import from auth middleware if defined there
interface AuthRequest extends Request {
  user?: { id: string; /* other user props */ };
}

export class FileController {
  private serviceName = 'FileController'; // Add service name

  async uploadFile(req: AuthRequest, res: Response, next: NextFunction) {
    const methodName = 'uploadFile';
    const { projectId } = req.params;
    const userId = req.user?.id;
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
        path: req.file.path,
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
        targetLanguage
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
      try {
          validateId(projectId, '项目');
          if (!userId) return next(new AppError('认证失败', 401));

          const files = await fileManagementService.getFilesByProjectId(projectId, userId);
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
       try {
           validateId(projectId, '项目');
           validateId(fileId, '文件');
           if (!userId) return next(new AppError('认证失败', 401));

           const file = await fileManagementService.getFileById(fileId, projectId, userId);
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
       try {
           validateId(projectId, '项目');
           validateId(fileId, '文件');
           if (!userId) return next(new AppError('认证失败', 401));

           await fileManagementService.deleteFile(fileId, projectId, userId);
           res.status(200).json({ success: true, message: '文件已成功删除' });
       } catch (error) {
           logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
           next(error);
       }
  }
}

// Export class directly, instantiation happens in routes file
// export default new FileController(); 