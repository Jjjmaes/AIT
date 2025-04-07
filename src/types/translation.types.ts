import { Types } from 'mongoose';
import { FileStatus } from '../models/file.model';
import { ProjectStatus } from '../models/project.model';

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
  domain?: string;
  aiProvider?: string;
  aiModel?: string;
  promptTemplateId?: string;
  useTranslationMemory?: boolean;
  useTerminology?: boolean;
  preserveFormatting?: boolean;
  context?: {
    projectName: string;
    fileName?: string;
  };
  temperature?: number;
  priority?: number;
}

// 翻译任务
export interface TranslationTask {
  id: string;
  taskId: string;
  status: TranslationStatus;
  options: TranslationOptions;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  progress: number;
  originalText?: string;
}

// 翻译结果
export interface TranslationResult {
  jobId: string;
  sourceText: string;
  translatedText: string;
  metadata: {
    projectId: string;
    fileId: string;
    segmentId: string;
    sourceLanguage: string;
    targetLanguage: string;
    domain?: string;
    processingTime?: number;
    tokens?: {
      input: number;
      output: number;
    };
    cost?: number;
  };
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
    tokens: {
      input: number;
      output: number;
    };
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
  translateSegment(segmentId: string, projectId: string, options?: TranslationOptions): Promise<TranslationResult>;
  translateMultipleSegments(segmentIds: string[], projectId: string, options?: TranslationOptions): Promise<void>;
  translateFile(fileId: string, projectId: string, options?: TranslationOptions): Promise<string>;
  translateProject(projectId: string, options?: TranslationOptions): Promise<string>;
  getTranslationStatus(jobId: string): Promise<{
    status: TranslationJobStatus;
    progress: number;
    completedCount: number;
    totalCount: number;
    error?: string;
    result?: TranslationResult;
    jobId: string;
  }>;
  getProjectTranslationStatus(projectId: string): Promise<ProjectTranslationStatus>;
  cancelTranslation(jobId: string): Promise<boolean>;
  translateText(text: string, projectId: string, options: TranslationOptions): Promise<string>;
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

export interface ProjectTranslationTask {
  id: string;
  name: string;
  description?: string;
  status: TranslationStatus;
  files: TranslationTask[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
  progress: {
    totalFiles: number;
    completedFiles: number;
    totalSegments: number;
    completedSegments: number;
    failedSegments: number;
    percentage: number;
  };
}

export interface ProjectTranslationOptions {
  sourceLanguage: string;
  targetLanguage: string;
  preserveFormatting?: boolean;
  batchSize?: number;
  maxConcurrentFiles?: number;
  retryCount?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface ProjectTranslationResult {
  projectId: string;
  status: TranslationStatus;
  files: {
    fileId: string;
    status: TranslationStatus;
    segments: TranslationResult[];
  }[];
  summary: {
    totalFiles: number;
    completedFiles: number;
    failedFiles: number;
    totalSegments: number;
    completedSegments: number;
    failedSegments: number;
    totalTokens: number;
    totalCost: number;
    averageQuality: number;
    processingTime: number;
  };
  error?: string;
}

export enum TranslationJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum TranslationJobType {
  SEGMENT = 'segment',
  FILE = 'file',
  PROJECT = 'project'
}

export interface TranslationJob {
  id: string;
  type: TranslationJobType;
  targetId: string;
  projectId: string;
  status: TranslationJobStatus;
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: TranslationResult;
  options: TranslationOptions;
  fileJobIds?: string[];
}

export interface ProjectTranslationStatus {
  projectId: string;
  status: TranslationJobStatus;
  progress: {
    completionPercentage: number;
    translatedWords: number;
    totalWords: number;
  };
  files: {
    total: number;
    completed: number;
    inProgress: number;
    failed: number;
  };
  lastUpdated: Date;
} 