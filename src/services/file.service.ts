import { File, FileStatus, FileType } from '../models/file.model';
import { Segment } from '../models/segment.model';
import { ApiError } from '../utils/apiError';
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
  async processFile(fileId: string, options: ProcessFileOptions = {}): Promise<void> {
    const file = await File.findById(fileId);
    if (!file) {
      throw new ApiError(404, '文件不存在');
    }

    if (file.status !== FileStatus.PENDING) {
      throw new ApiError(400, '文件状态不正确，只能处理待处理状态的文件');
    }

    try {
      // 更新文件状态为处理中
      file.status = FileStatus.PROCESSING;
      await file.save();

      // 读取文件内容
      const filePath = path.join(__dirname, '../../uploads', file.fileName);
      const content = await fs.promises.readFile(filePath, 'utf-8');

      // 根据文件类型选择不同的处理方式
      let segments: string[] = [];
      switch (file.type) {
        case FileType.TXT:
          segments = this.processTextFile(content, options);
          break;
        case FileType.JSON:
          segments = this.processJsonFile(content, options);
          break;
        case FileType.MD:
          segments = this.processMarkdownFile(content, options);
          break;
        default:
          throw new ApiError(400, '不支持的文件类型');
      }

      // 创建段落记录
      const segmentDocs = segments.map((content, index) => ({
        fileId: file._id,
        content,
        order: index,
        status: 'pending'
      }));
      await Segment.insertMany(segmentDocs);

      // 更新文件信息
      file.segmentCount = segments.length;
      file.status = FileStatus.TRANSLATED;
      file.processedAt = new Date();
      await file.save();

    } catch (error) {
      // 处理失败，更新文件状态
      file.status = FileStatus.ERROR;
      file.error = error instanceof Error ? error.message : '文件处理失败';
      await file.save();
      throw error;
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
      throw new ApiError(400, '无效的 JSON 文件');
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