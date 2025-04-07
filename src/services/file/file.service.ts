import { Types } from 'mongoose';
import { File, FileStatus } from '../../models/file.model';
import logger from '../../utils/logger';

/**
 * 文件服务类，负责处理文件相关的操作
 */
export class FileService {
  /**
   * 更新文件状态
   * @param fileId 文件ID
   * @param status 新的文件状态
   */
  async updateFileStatus(fileId: Types.ObjectId, status: FileStatus): Promise<void> {
    try {
      await File.findByIdAndUpdate(fileId, {
        status,
        updatedAt: new Date()
      });
      
      logger.info(`File status updated to ${status}`, { fileId: fileId.toString() });
    } catch (error) {
      logger.error(`Failed to update file status:`, error);
      throw error;
    }
  }

  /**
   * 获取文件信息
   * @param fileId 文件ID
   */
  async getFileById(fileId: Types.ObjectId): Promise<any> {
    try {
      const file = await File.findById(fileId);
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }
      return file;
    } catch (error) {
      logger.error(`Failed to get file:`, error);
      throw error;
    }
  }

  /**
   * 获取项目中的所有文件
   * @param projectId 项目ID
   */
  async getFilesByProjectId(projectId: Types.ObjectId): Promise<any[]> {
    try {
      return await File.find({ projectId });
    } catch (error) {
      logger.error(`Failed to get project files:`, error);
      throw error;
    }
  }

  /**
   * 更新文件进度
   * @param fileId 文件ID
   * @param progress 进度信息
   */
  async updateFileProgress(
    fileId: Types.ObjectId, 
    progress: { total: number; completed: number; translated: number; percentage: number }
  ): Promise<void> {
    try {
      await File.findByIdAndUpdate(fileId, { progress });
      
      logger.info(`File progress updated`, { 
        fileId: fileId.toString(),
        progress: JSON.stringify(progress)
      });
    } catch (error) {
      logger.error(`Failed to update file progress:`, error);
      throw error;
    }
  }

  /**
   * 如果文件处理出错，更新文件的错误信息
   * @param fileId 文件ID
   * @param error 错误信息
   * @param errorDetails 详细错误信息
   */
  async updateFileError(
    fileId: Types.ObjectId,
    error: string,
    errorDetails?: string
  ): Promise<void> {
    try {
      await File.findByIdAndUpdate(fileId, {
        status: FileStatus.ERROR,
        error,
        errorDetails,
        updatedAt: new Date()
      });
      
      logger.error(`File processing error`, { 
        fileId: fileId.toString(),
        error,
        errorDetails
      });
    } catch (err) {
      logger.error(`Failed to update file error:`, err);
      throw err;
    }
  }
} 