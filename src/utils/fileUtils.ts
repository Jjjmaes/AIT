import path from 'path';
import { FileType } from '../models/file.model';
import logger from './logger';
import { ValidationError } from './errors';
import { v4 as uuidv4 } from 'uuid';
import { FilePathOptions } from '../types/file.types';

// 最大文件大小（100MB）
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * 支持的文件扩展名和对应的文件类型映射
 */
export const FILE_EXTENSION_MAP: Record<string, FileType> = {
  'txt': FileType.TXT,
  'text': FileType.TXT,
  'json': FileType.JSON,
  'md': FileType.MD,
  'markdown': FileType.MD,
  'docx': FileType.DOCX,
  'doc': FileType.DOCX,
  'mqxliff': FileType.MEMOQ_XLIFF,
  'xliff': FileType.XLIFF,
  'xlf': FileType.XLIFF
};

/**
 * 支持的MIME类型和对应的文件类型映射
 */
export const MIME_TYPE_MAP: Record<string, FileType> = {
  'text/plain': FileType.TXT,
  'application/json': FileType.JSON,
  'text/markdown': FileType.MD,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileType.DOCX,
  'application/msword': FileType.DOCX,
  'application/x-xliff+xml': FileType.XLIFF,
  'application/xliff+xml': FileType.XLIFF,
  'application/x-memoq-xliff': FileType.MEMOQ_XLIFF
};

/**
 * 检查文件扩展名，返回对应的文件类型
 * @param filename 文件名
 * @returns 文件类型
 */
export function getFileTypeFromFilename(filename: string): FileType {
  if (!filename) {
    throw new ValidationError('文件名不能为空');
  }

  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) {
    throw new ValidationError('无法识别文件扩展名');
  }

  switch (ext) {
    case 'txt':
      return FileType.TXT;
    case 'docx':
    case 'doc':
      return FileType.DOCX;
    case 'xlsx':
    case 'xls':
      return FileType.JSON;
    case 'csv':
      return FileType.JSON;
    case 'json':
      return FileType.JSON;
    case 'xml':
      return FileType.XLIFF;
    case 'html':
    case 'htm':
      return FileType.TXT;
    case 'md':
      return FileType.MD;
    case 'pdf':
      return FileType.DOCX;
    case 'po':
    case 'pot':
      return FileType.XLIFF;
    case 'srt':
    case 'vtt':
      return FileType.TXT;
    case 'resx':
    case 'resw':
      return FileType.XLIFF;
    default:
      throw new ValidationError(`不支持的文件类型: ${ext}`);
  }
}

/**
 * 从MIME类型获取文件类型
 * 
 * @param mimeType MIME类型
 * @returns 文件类型或null（如果不支持）
 */
export function getFileTypeFromMimeType(mimeType: string): FileType | null {
  if (!mimeType) {
    return null;
  }
  
  const fileType = MIME_TYPE_MAP[mimeType.toLowerCase()];
  if (!fileType) {
    logger.warn(`不支持的MIME类型: ${mimeType}`);
  }
  
  return fileType || null;
}

/**
 * 检测文件类型（尝试从文件名和MIME类型获取）
 * 
 * @param filename 文件名
 * @param mimeType MIME类型
 * @returns 文件类型或null（如果不支持）
 */
export function detectFileType(filename: string, mimeType?: string): FileType | null {
  // 优先使用文件扩展名
  const fileTypeFromName = getFileTypeFromFilename(filename);
  if (fileTypeFromName) {
    return fileTypeFromName;
  }
  
  // 如果提供了MIME类型，尝试从MIME类型获取
  if (mimeType) {
    return getFileTypeFromMimeType(mimeType);
  }
  
  return null;
}

/**
 * 验证文件类型是否支持
 * @param filename 文件名
 * @param mimeType MIME类型
 * @returns 支持的文件类型
 */
export function validateFileType(filename: string, mimeType: string): FileType {
  try {
    return getFileTypeFromFilename(filename);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ValidationError(`不支持的文件类型: ${filename} (${mimeType})`);
    }
    throw error;
  }
}

/**
 * 获取所有支持的文件扩展名
 * 
 * @returns 支持的文件扩展名数组
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(FILE_EXTENSION_MAP);
}

/**
 * 获取支持的MIME类型
 * 
 * @returns 支持的MIME类型数组
 */
export function getSupportedMimeTypes(): string[] {
  return Object.keys(MIME_TYPE_MAP);
}

/**
 * 获取文件扩展名对应的MIME类型
 * 
 * @param extension 文件扩展名
 * @returns MIME类型
 */
export function getMimeTypeFromExtension(extension: string): string | null {
  const mimeTypeEntries = Object.entries(MIME_TYPE_MAP);
  
  for (const [mimeType, fileType] of mimeTypeEntries) {
    if (fileType === FILE_EXTENSION_MAP[extension]) {
      return mimeType;
    }
  }
  
  return null;
}

/**
 * 生成唯一的文件名，保留原始扩展名
 * @param originalFilename 原始文件名
 * @returns 唯一的文件名
 */
export function generateUniqueFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename);
  const baseName = path.basename(originalFilename, ext);
  const uniqueId = uuidv4().slice(0, 8);
  return `${baseName}-${uniqueId}${ext}`;
}

/**
 * 构建存储路径
 * @param options 路径选项
 * @returns 存储路径
 */
export function buildFilePath(options: {
  projectId: string;
  fileName: string;
  isProjectFile: boolean;
  subfolder?: string;
}): string {
  const { projectId, fileName, isProjectFile, subfolder } = options;
  
  // 主要文件夹基于文件类型
  const mainFolder = isProjectFile ? 'projects' : 'files';
  
  // 如果有子文件夹，则包括在路径中
  if (subfolder) {
    return `${mainFolder}/${projectId}/${subfolder}/${fileName}`;
  }
  
  return `${mainFolder}/${projectId}/${fileName}`;
}

/**
 * 从路径中提取文件名
 * @param filePath 文件路径
 * @returns 文件名
 */
export function extractFilenameFromPath(filePath: string): string {
  if (!filePath) {
    return '';
  }
  return path.basename(filePath);
}

/**
 * 检查文件大小是否在允许范围内
 * @param fileSize 文件大小（字节）
 */
export function checkFileSize(fileSize: number): void {
  if (!fileSize || fileSize <= 0) {
    throw new ValidationError('无效的文件大小');
  }

  if (fileSize > MAX_FILE_SIZE) {
    throw new ValidationError(`文件大小超过限制: ${fileSize} > ${MAX_FILE_SIZE} 字节 (${MAX_FILE_SIZE / 1024 / 1024} MB)`);
  }
}

/**
 * 检查文件是否是图片
 * @param mimeType 文件的MIME类型
 * @returns 是否是图片
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * 获取支持的文件扩展名列表
 * @returns 支持的文件扩展名数组
 */
export function getSupportedFileExtensions(): string[] {
  return [
    'txt', 'doc', 'docx', 'xls', 'xlsx', 'csv', 
    'json', 'xml', 'html', 'htm', 'md', 'pdf',
    'po', 'pot', 'srt', 'vtt', 'resx', 'resw'
  ];
}

/**
 * 获取文件扩展名对应的MIME类型
 * @param ext 文件扩展名
 * @returns MIME类型
 */
export function getMimeTypeForExtension(ext: string): string {
  const mimeTypes: Record<string, string> = {
    txt: 'text/plain',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    htm: 'text/html',
    md: 'text/markdown',
    pdf: 'application/pdf',
    po: 'text/x-gettext-translation',
    pot: 'text/x-gettext-translation-template',
    srt: 'application/x-subrip',
    vtt: 'text/vtt',
    resx: 'application/xml',
    resw: 'application/xml'
  };

  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
} 

