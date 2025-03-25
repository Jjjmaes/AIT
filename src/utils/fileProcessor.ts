import { FileType } from '../models/file.model';
import { SegmentStatus } from '../models/segment.model';
import { ValidationError } from './errors';

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

  switch (fileType) {
    case FileType.TXT:
      segments = processTextFile(content, maxSegmentLength, minSegmentLength, preserveFormatting);
      break;
    case FileType.JSON:
      try {
        segments = processJsonFile(content, maxSegmentLength, minSegmentLength);
      } catch (error) {
        throw new ValidationError('JSON格式不正确');
      }
      break;
    case FileType.MD:
      segments = processMarkdownFile(content, maxSegmentLength, minSegmentLength, preserveFormatting);
      break;
    default:
      throw new ValidationError(`不支持的文件类型: ${fileType}`);
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