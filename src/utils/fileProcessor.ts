import { FileType } from '../models/file.model';
import { SegmentStatus } from '../models/segment.model';
import { ValidationError } from './errors';
import logger from './logger';

interface ProcessOptions {
  maxSegmentLength?: number;
  minSegmentLength?: number;
  preserveFormatting?: boolean;
}

interface ProcessedSegment {
  content: string;
  originalLength: number;
  translatedLength: number;
  status: SegmentStatus;
  metadata?: {
    path?: string;
    [key: string]: any;
  };
}

export async function processFile(
  content: string,
  fileType: FileType,
  options: ProcessOptions = {}
): Promise<ProcessedSegment[]> {
  if (!content) {
    throw new ValidationError('文件内容不能为空');
  }

  const {
    maxSegmentLength = 1000,
    minSegmentLength = 100,
    preserveFormatting = true
  } = options;

  if (maxSegmentLength < minSegmentLength) {
    throw new ValidationError('最大段落长度不能小于最小段落长度');
  }

  let segments: ProcessedSegment[] = [];

  try {
    switch (fileType) {
      case FileType.TXT:
        segments = processTextFile(content, maxSegmentLength, minSegmentLength, preserveFormatting);
        break;
      case FileType.JSON:
        segments = processJsonFile(content, maxSegmentLength, minSegmentLength);
        break;
      case FileType.MD:
        segments = processMarkdownFile(content, maxSegmentLength, minSegmentLength, preserveFormatting);
        break;
      case FileType.DOCX:
        segments = processDocxFile(content, maxSegmentLength, minSegmentLength, preserveFormatting);
        break;
      case FileType.XLIFF:
        segments = processXliffFile(content, maxSegmentLength, minSegmentLength);
        break;
      case FileType.MEMOQ_XLIFF:
        segments = processMemoqXliffFile(content, maxSegmentLength, minSegmentLength);
        break;
      default:
        throw new ValidationError(`不支持的文件类型: ${fileType}`);
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.error(`处理文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    throw new ValidationError(`处理文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }

  if (segments.length === 0) {
    throw new ValidationError('未找到可处理的文本段落');
  }

  return segments;
}

function processTextFile(
  content: string,
  maxLength: number,
  minLength: number,
  preserveFormatting: boolean
): ProcessedSegment[] {
  const segments: ProcessedSegment[] = [];
  const lines = content.split('\n');
  let currentSegment = '';
  let currentLength = 0;

  for (const line of lines) {
    if (preserveFormatting) {
      currentSegment += line + '\n';
    } else {
      currentSegment += line.trim() + ' ';
    }
    currentLength += line.length;

    if (currentLength >= maxLength) {
      if (currentSegment.length >= minLength) {
        segments.push({
          content: currentSegment.trim(),
          originalLength: currentLength,
          translatedLength: 0,
          status: SegmentStatus.PENDING
        });
      }
      currentSegment = '';
      currentLength = 0;
    }
  }

  if (currentSegment.length >= minLength) {
    segments.push({
      content: currentSegment.trim(),
      originalLength: currentLength,
      translatedLength: 0,
      status: SegmentStatus.PENDING
    });
  }

  return segments;
}

function processJsonFile(
  content: string,
  maxLength: number,
  minLength: number
): ProcessedSegment[] {
  const segments: ProcessedSegment[] = [];
  const json = JSON.parse(content);

  function processValue(value: any, path: string[] = []): void {
    if (typeof value === 'string') {
      if (value.length >= minLength && value.length <= maxLength) {
        segments.push({
          content: value,
          originalLength: value.length,
          translatedLength: 0,
          status: SegmentStatus.PENDING,
          metadata: {
            path: path.join('.')
          }
        });
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        processValue(item, [...path, index.toString()]);
      });
    } else if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([key, val]) => {
        processValue(val, [...path, key]);
      });
    }
  }

  processValue(json);
  return segments;
}

function processMarkdownFile(
  content: string,
  maxLength: number,
  minLength: number,
  preserveFormatting: boolean
): ProcessedSegment[] {
  const segments: ProcessedSegment[] = [];
  const blocks = content.split('\n\n');
  let currentSegment = '';
  let currentLength = 0;

  for (const block of blocks) {
    if (preserveFormatting) {
      currentSegment += block + '\n\n';
    } else {
      currentSegment += block.trim() + ' ';
    }
    currentLength += block.length;

    if (currentLength >= maxLength) {
      if (currentSegment.length >= minLength) {
        segments.push({
          content: currentSegment.trim(),
          originalLength: currentLength,
          translatedLength: 0,
          status: SegmentStatus.PENDING
        });
      }
      currentSegment = '';
      currentLength = 0;
    }
  }

  if (currentSegment.length >= minLength) {
    segments.push({
      content: currentSegment.trim(),
      originalLength: currentLength,
      translatedLength: 0,
      status: SegmentStatus.PENDING
    });
  }

  return segments;
}

function processDocxFile(
  content: string,
  maxLength: number,
  minLength: number,
  preserveFormatting: boolean
): ProcessedSegment[] {
  try {
    // 注意：在实际环境中，需要使用适当的库来解析 docx 文件
    // 这里只是一个简化的实现，实际应用中应替换为真实的 docx 解析逻辑
    logger.info('处理 DOCX 文件');
    
    // 由于是 Buffer 转换成的 string，这里我们将其当作纯文本处理
    return processTextFile(content, maxLength, minLength, preserveFormatting);
  } catch (error) {
    logger.error(`解析 DOCX 文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    throw new ValidationError('解析 DOCX 文件失败，请确保文件格式正确');
  }
}

function processXliffFile(
  content: string,
  maxLength: number,
  minLength: number
): ProcessedSegment[] {
  try {
    // 注意：在实际环境中，需要使用适当的库来解析 XLIFF 文件
    // 这里只是一个简化的实现，应替换为真实的 XLIFF 解析逻辑
    logger.info('处理 XLIFF 文件');
    
    // 简单实现：查找 <source> 标签内的内容
    const segments: ProcessedSegment[] = [];
    const sourceRegex = /<source>([\s\S]*?)<\/source>/g;
    let match;
    
    while ((match = sourceRegex.exec(content)) !== null) {
      const sourceText = match[1].trim();
      if (sourceText.length >= minLength && sourceText.length <= maxLength) {
        segments.push({
          content: sourceText,
          originalLength: sourceText.length,
          translatedLength: 0,
          status: SegmentStatus.PENDING,
          metadata: {
            path: `xliff.source.${segments.length}`
          }
        });
      }
    }
    
    return segments;
  } catch (error) {
    logger.error(`解析 XLIFF 文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    throw new ValidationError('解析 XLIFF 文件失败，请确保文件格式正确');
  }
}

function processMemoqXliffFile(
  content: string,
  maxLength: number,
  minLength: number
): ProcessedSegment[] {
  try {
    // MemoQ XLIFF 是 XLIFF 的特定变体，可能有特殊处理
    // 这里为简化实现，我们复用 XLIFF 处理逻辑
    logger.info('处理 MemoQ XLIFF 文件');
    return processXliffFile(content, maxLength, minLength);
  } catch (error) {
    logger.error(`解析 MemoQ XLIFF 文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    throw new ValidationError('解析 MemoQ XLIFF 文件失败，请确保文件格式正确');
  }
} 