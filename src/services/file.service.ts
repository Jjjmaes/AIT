import { File, FileStatus, FileType } from '../models/file.model';
import { Segment, SegmentStatus } from '../models/segment.model';
import { NotFoundError, ValidationError } from '../utils/errors';
import { processFile as processFileContent } from '../utils/fileProcessor';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ProcessFileOptions {
  maxSegmentLength?: number;
  minSegmentLength?: number;
  preserveFormatting?: boolean;
}

class FileService {
  /**
   * 处理文件分段
   */
  async processFile(fileId: string, options: any = {}) {
    // 获取文件信息
    const file = await File.findById(fileId);
    if (!file) {
      throw new NotFoundError('文件不存在');
    }

    // 检查文件状态
    if (file.status !== FileStatus.PENDING) {
      throw new ValidationError('文件状态不正确，只能处理待处理状态的文件');
    }

    try {
      // 读取文件内容
      const content = await this.readFileContent(file);

      // 获取文件类型
      const fileType = this.getFileType(file.originalName);
      if (!fileType) {
        throw new ValidationError('不支持的文件类型');
      }

      // 处理文件内容
      const segments = await processFileContent(content, fileType, options);

      // 保存分段信息
      await Segment.create(
        segments.map((segment, index) => ({
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
      file.status = FileStatus.PROCESSING;
      file.segmentCount = segments.length;
      await file.save();

      return segments;
    } catch (error) {
      // 如果是 JSON 文件解析错误
      if (error instanceof SyntaxError) {
        throw new ValidationError('无效的 JSON 文件');
      }
      throw error;
    }
  }

  /**
   * 读取文件内容
   */
  private async readFileContent(file: any): Promise<string> {
    // TODO: 实现文件内容读取逻辑
    return '';
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
      default:
        return null;
    }
  }

  /**
   * 处理文本文件
   */
  private processTextFile(content: string, options: ProcessFileOptions): string[] {
    const {
      maxSegmentLength = 1000,
      minSegmentLength = 100,
      preserveFormatting = true
    } = options;

    // 按段落分割
    const paragraphs = content.split(/\n\s*\n/);
    const segments: string[] = [];
    let currentSegment = '';

    for (const paragraph of paragraphs) {
      if (preserveFormatting) {
        // 保留段落格式
        if (currentSegment.length + paragraph.length > maxSegmentLength) {
          if (currentSegment.length >= minSegmentLength) {
            segments.push(currentSegment.trim());
          }
          currentSegment = paragraph;
        } else {
          currentSegment += (currentSegment ? '\n\n' : '') + paragraph;
        }
      } else {
        // 不保留格式，按句子分割
        const sentences = paragraph.split(/[.!?。！？]/);
        for (const sentence of sentences) {
          if (currentSegment.length + sentence.length > maxSegmentLength) {
            if (currentSegment.length >= minSegmentLength) {
              segments.push(currentSegment.trim());
            }
            currentSegment = sentence;
          } else {
            currentSegment += (currentSegment ? ' ' : '') + sentence;
          }
        }
      }
    }

    // 添加最后一个段落
    if (currentSegment.length >= minSegmentLength) {
      segments.push(currentSegment.trim());
    }

    return segments;
  }

  /**
   * 处理 JSON 文件
   */
  private processJsonFile(content: string, options: ProcessFileOptions): string[] {
    try {
      const json = JSON.parse(content);
      const segments: string[] = [];

      // 递归处理 JSON 对象
      const processObject = (obj: any, path: string[] = []) => {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = [...path, key];
          
          if (typeof value === 'string') {
            segments.push(value);
          } else if (typeof value === 'object' && value !== null) {
            processObject(value, currentPath);
          }
        }
      };

      processObject(json);
      return segments;
    } catch (error) {
      throw new ValidationError('无效的 JSON 文件');
    }
  }

  /**
   * 处理 Markdown 文件
   */
  private processMarkdownFile(content: string, options: ProcessFileOptions): string[] {
    const {
      maxSegmentLength = 1000,
      minSegmentLength = 100,
      preserveFormatting = true
    } = options;

    // 按标题分割
    const sections = content.split(/(?=^#{1,6}\s)/m);
    const segments: string[] = [];
    let currentSegment = '';

    for (const section of sections) {
      if (preserveFormatting) {
        // 保留 Markdown 格式
        if (currentSegment.length + section.length > maxSegmentLength) {
          if (currentSegment.length >= minSegmentLength) {
            segments.push(currentSegment.trim());
          }
          currentSegment = section;
        } else {
          currentSegment += (currentSegment ? '\n\n' : '') + section;
        }
      } else {
        // 不保留格式，按段落分割
        const paragraphs = section.split(/\n\s*\n/);
        for (const paragraph of paragraphs) {
          if (currentSegment.length + paragraph.length > maxSegmentLength) {
            if (currentSegment.length >= minSegmentLength) {
              segments.push(currentSegment.trim());
            }
            currentSegment = paragraph;
          } else {
            currentSegment += (currentSegment ? ' ' : '') + paragraph;
          }
        }
      }
    }

    // 添加最后一个段落
    if (currentSegment.length >= minSegmentLength) {
      segments.push(currentSegment.trim());
    }

    return segments;
  }
}

export default new FileService(); 