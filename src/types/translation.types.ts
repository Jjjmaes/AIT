import { Types } from 'mongoose';
import { FileStatus } from '../models/file.model';
import { ProjectStatus } from '../types/project.types';

// 翻译状态枚举
export enum TranslationStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// 翻译选项
export interface TranslationOptions {
  sourceLanguage: string;
  targetLanguage: string;
  aiProvider?: string;        // AI 服务提供商
  model?: string;            // 使用的模型
  preserveFormatting?: boolean; // 是否保留格式
  useTerminology?: boolean;   // 是否使用术语库
  priority?: 'high' | 'normal' | 'low';
}

// 翻译任务
export interface TranslationTask {
  id: string;
  projectId: Types.ObjectId;
  fileId: Types.ObjectId;
  segmentId: Types.ObjectId;
  status: TranslationStatus;
  options: TranslationOptions;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  progress: number;
}

// 翻译结果
export interface TranslationResult {
  id: string;
  taskId: string;
  projectId: Types.ObjectId;
  fileId: Types.ObjectId;
  segmentId: Types.ObjectId;
  originalText: string;
  translatedText: string;
  status: TranslationStatus;
  quality?: number;
  metadata: {
    aiProvider: string;
    model: string;
    processingTime: number;
    wordCount: number;
    characterCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// 翻译进度更新
export interface TranslationProgressUpdate {
  projectId: Types.ObjectId;
  fileId: Types.ObjectId;
  totalSegments: number;
  processedSegments: number;
  completedSegments: number;
  failedSegments: number;
  progress: number;
  status: TranslationStatus;
  lastUpdated: Date;
}

// AI 服务响应
export interface AIServiceResponse {
  translatedText: string;
  metadata: {
    provider: string;
    model: string;
    processingTime: number;
    confidence: number;
    wordCount: number;
    characterCount: number;
  };
}

// AI 服务适配器接口
export interface IAIServiceAdapter {
  translateText(sourceText: string, options: TranslationOptions): Promise<AIServiceResponse>;
  validateApiKey(): Promise<boolean>;
  getAvailableModels(): Promise<string[]>;
}

// 翻译服务接口
export interface ITranslationService {
  translateSegment(segmentId: string, options: TranslationOptions): Promise<TranslationResult>;
  translateMultipleSegments(segmentIds: string[], options: TranslationOptions): Promise<void>;
  translateFile(fileId: string, options: TranslationOptions): Promise<void>;
  translateText(text: string, options: TranslationOptions): Promise<string>;
  getTranslationStatus(taskId: string): Promise<TranslationStatus>;
  cancelTranslation(taskId: string): Promise<boolean>;
  getTranslationProgress(projectId: string): Promise<TranslationProgressUpdate>;
}

// 翻译队列服务接口
export interface ITranslationQueueService {
  addTask(task: TranslationTask): Promise<string>;
  getTask(taskId: string): Promise<TranslationTask>;
  updateTaskStatus(taskId: string, status: TranslationStatus, error?: string): Promise<void>;
  getQueueStatus(): Promise<{
    totalTasks: number;
    pendingTasks: number;
    processingTasks: number;
    completedTasks: number;
    failedTasks: number;
  }>;
}

// 翻译错误
export interface TranslationError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// 翻译事件
export enum TranslationEventType {
  TASK_CREATED = 'TASK_CREATED',
  TASK_STARTED = 'TASK_STARTED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_FAILED = 'TASK_FAILED',
  TASK_CANCELLED = 'TASK_CANCELLED',
  PROGRESS_UPDATED = 'PROGRESS_UPDATED'
}

export interface TranslationEvent {
  type: TranslationEventType;
  taskId: string;
  projectId: Types.ObjectId;
  fileId: Types.ObjectId;
  data: any;
  timestamp: Date;
} 