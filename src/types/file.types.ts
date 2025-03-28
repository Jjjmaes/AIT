import { FileType } from '../models/file.model';

/**
 * 文件上传DTO
 */
export interface UploadFileDTO {
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  category?: string;
  tags?: string[];
}

/**
 * 文件处理选项
 */
export interface FileProcessOptions {
  maxSegmentLength?: number;
  minSegmentLength?: number;
  preserveFormatting?: boolean;
  [key: string]: any;
}

/**
 * 文件导出选项
 */
export interface FileExportOptions {
  format?: 'txt' | 'json' | 'xliff';
  includeReview?: boolean;
  includeMetadata?: boolean;
  targetLang?: string;
}

/**
 * 文件查询参数
 */
export interface FileQueryParams {
  status?: string;
  type?: FileType;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 文件路径选项
 */
export interface FilePathOptions {
  projectId: string;
  fileName: string;
  isProjectFile?: boolean;
}

/**
 * 文件分段结果
 */
export interface ProcessedSegment {
  content: string;
  originalLength: number;
  translatedLength: number;
  status: string;
  metadata?: Record<string, any>;
} 