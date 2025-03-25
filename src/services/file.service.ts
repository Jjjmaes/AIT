import { File, FileStatus, FileType } from '../models/file.model';
import { Segment, SegmentStatus } from '../models/segment.model';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { processFile } from '../utils/fileProcessor';
import { uploadToS3, deleteFromS3, getFileContent } from '../utils/s3';
import logger from '../utils/logger';
import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface UploadFileDTO {
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  sourceLanguage: string;
  targetLanguage: string;
  category?: string;
  tags?: string[];
}

export interface FileQueryParams {
  status?: FileStatus;
  type?: FileType;
  uploadedBy?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ExportOptions {
  format: string;
  includeReview?: boolean;
  includeMetadata?: boolean;
  targetLanguage?: string;
}

class FileService {
  /**
   * 上传文件
   */
  async uploadFile(fileData: UploadFileDTO, projectId: string, userId: string): Promise<any> {
    try {
      // 验证文件类型
      const fileType = this.getFileType(fileData.originalName);
      if (!fileType) {
        throw new ValidationError('不支持的文件类型');
      }

      // 生成唯一文件名
      const fileName = `${uuidv4()}-${fileData.originalName}`;

      // 上传到 S3
      const key = `files/${projectId}/${fileName}`;
      const s3Url = await uploadToS3(fileData.filePath, key, fileData.mimeType);

      // 创建文件记录
      const file = new File({
        projectId: new Types.ObjectId(projectId),
        fileName,
        originalName: fileData.originalName,
        fileSize: fileData.fileSize,
        mimeType: fileData.mimeType,
        type: fileType,
        status: FileStatus.PENDING,
        uploadedBy: new Types.ObjectId(userId),
        storageUrl: s3Url,
        path: key,
        metadata: {
          sourceLanguage: fileData.sourceLanguage,
          targetLanguage: fileData.targetLanguage,
          category: fileData.category,
          tags: fileData.tags || []
        }
      });

      await file.save();
      logger.info(`File ${file.id} uploaded successfully to project ${projectId}`);

      const result = file.toObject();
      const { toObject, ...cleanResult } = result;
      return cleanResult;
    } catch (error) {
      logger.error(`Error uploading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * 获取文件详情
   */
  async getFileById(fileId: string): Promise<any> {
    const file = await File.findById(fileId);
    if (!file) {
      throw new NotFoundError('文件不存在');
    }

    const result = file.toObject();
    const { toObject, ...cleanResult } = result;
    return cleanResult;
  }

  /**
   * 获取项目文件列表
   */
  async getProjectFiles(projectId: string, query: FileQueryParams = {}) {
    const {
      status,
      type,
      uploadedBy,
      page = 1,
      pageSize = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      startDate,
      endDate
    } = query;

    const filter: any = { projectId: new Types.ObjectId(projectId) };

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (uploadedBy) filter.uploadedBy = new Types.ObjectId(uploadedBy);
    if (search) filter.originalName = { $regex: search, $options: 'i' };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = startDate;
      if (endDate) filter.createdAt.$lte = endDate;
    }

    const sort: any = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [files, total] = await Promise.all([
      File.find(filter)
        .sort(sort)
        .skip((page - 1) * pageSize)
        .limit(pageSize),
      File.countDocuments(filter)
    ]);

    return {
      files: files.map(file => {
        const result = file.toObject();
        const { toObject, ...cleanResult } = result;
        return cleanResult;
      }),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  /**
   * 更新文件状态
   */
  async updateFileStatus(fileId: string, status: FileStatus): Promise<any> {
    const file = await File.findById(fileId);
    if (!file) {
      throw new NotFoundError('文件不存在');
    }

    try {
      file.status = status;
      await file.save();
      logger.info(`File ${file.id} status updated to ${status}`);
      return file;
    } catch (error) {
      logger.error(`Error updating file status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(fileId: string): Promise<boolean> {
    const file = await File.findById(fileId);
    if (!file) {
      throw new NotFoundError('文件不存在');
    }

    try {
      // 删除 S3 文件
      await deleteFromS3(file.path);

      // 删除数据库记录
      await file.deleteOne();
      
      // 删除相关段落
      await Segment.deleteMany({ fileId: file._id });

      logger.info(`File ${fileId} deleted successfully`);
      return true;
    } catch (error) {
      logger.error(`Error deleting file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * 处理文件
   */
  async processFile(fileId: string, options: any = {}) {
    const file = await File.findById(fileId);
    if (!file) {
      throw new NotFoundError('文件不存在');
    }

    if (file.status !== FileStatus.PENDING) {
      throw new ValidationError('文件状态不正确，只能处理待处理状态的文件');
    }

    try {
      // 更新处理状态
      file.status = FileStatus.PROCESSING;
      file.processingStartedAt = new Date();
      await file.save();

      // 获取文件内容
      const content = await getFileContent(file.path);

      // 处理文件内容
      const segments = await processFile(
        content,
        file.type,
        options
      );

      // 保存段落信息
      await Segment.create(
        segments.map((segment: any, index: number) => ({
          fileId: file._id,
          content: segment.content,
          order: index + 1,
          status: SegmentStatus.PENDING,
          originalLength: segment.originalLength,
          translatedLength: segment.translatedLength,
          metadata: segment.metadata
        }))
      );

      // 更新文件状态
      file.status = FileStatus.READY;
      file.processingCompletedAt = new Date();
      file.segmentCount = segments.length;
      await file.save();

      logger.info(`File ${file.id} processed successfully with ${segments.length} segments`);
      return segments;
    } catch (error) {
      file.status = FileStatus.ERROR;
      file.error = error instanceof Error ? error.message : 'Unknown error';
      file.errorDetails = error instanceof Error ? error.stack : 'No stack trace available';
      await file.save();
      
      logger.error(`Error processing file ${file.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * 导出文件
   */
  async exportFile(fileId: string, options: ExportOptions): Promise<string> {
    const file = await File.findById(fileId);
    if (!file) {
      throw new NotFoundError('文件不存在');
    }

    try {
      // 获取所有段落
      const segments = await Segment.find({ fileId }).sort({ order: 1 }).exec();
      if (!segments || !Array.isArray(segments)) {
        throw new ValidationError('未找到可导出的段落');
      }

      // 根据文件类型和导出选项生成导出内容
      let exportContent = '';
      if (options.format === 'json') {
        exportContent = this.exportAsJson(segments, options);
      } else {
        exportContent = this.exportAsText(segments, options);
      }

      // 生成导出文件名
      const timestamp = new Date().getTime();
      const exportFileName = `${file.fileName.replace(/\.[^/.]+$/, '')}_export_${timestamp}.${options.format}`;
      const exportPath = `exports/${exportFileName}`;

      // 上传导出文件
      const exportUrl = await uploadToS3(
        Buffer.from(exportContent),
        exportPath,
        options.format === 'json' ? 'application/json' : 'text/plain'
      );

      return exportUrl;
    } catch (error) {
      logger.error(`Error exporting file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * 获取文件类型
   */
  private getFileType(filename: string): FileType | null {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'txt':
        return FileType.TXT;
      case 'json':
        return FileType.JSON;
      case 'md':
        return FileType.MD;
      case 'docx':
        return FileType.DOCX;
      case 'mqxliff':
        return FileType.MEMOQ_XLIFF;
      case 'xliff':
        return FileType.XLIFF;
      default:
        return null;
    }
  }

  /**
   * 导出为文本格式
   */
  private exportAsText(segments: any[], options: ExportOptions): string {
    if (!Array.isArray(segments)) {
      throw new ValidationError('无效的段落数据');
    }
    return segments
      .map(segment => segment.translation || segment.content)
      .join('\n\n');
  }

  /**
   * 导出为 JSON 格式
   */
  private exportAsJson(segments: any[], options: ExportOptions): string {
    if (!Array.isArray(segments)) {
      throw new ValidationError('无效的段落数据');
    }
    const exportData = segments.map(segment => {
      const data: any = {
        content: segment.content,
        translation: segment.translation
      };

      if (options.includeMetadata && segment.metadata) {
        data.metadata = segment.metadata;
      }

      return data;
    });

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导出为 XLIFF 格式
   */
  private exportAsXliff(segments: any[], options: ExportOptions): string {
    const xliff = {
      '?xml': {
        '@_version': '1.0',
        '@_encoding': 'UTF-8'
      },
      xliff: {
        '@_version': '2.0',
        '@_xmlns': 'urn:oasis:names:tc:xliff:document:2.0',
        '@_srcLang': options.targetLanguage || 'en',
        '@_trgLang': options.targetLanguage || 'zh',
        file: {
          '@_id': 'f1',
          body: {
            'trans-unit': segments.map((segment, index) => ({
              '@_id': `tu${index + 1}`,
              source: segment.content,
              target: segment.translation || segment.content
            }))
          }
        }
      }
    };

    return JSON.stringify(xliff, null, 2);
  }
}

export default new FileService(); 