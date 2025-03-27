import { TranslationOptions } from '../../../types/translation.types';

export enum QueueTaskType {
  /** 文本翻译任务 */
  TRANSLATION = 'TRANSLATION',
  /** 批量翻译任务 */
  BATCH_TRANSLATION = 'batch_translation',
  /** 文件翻译任务 */
  FILE_TRANSLATION = 'file_translation',
  /** 翻译质量评估任务 */
  QUALITY_ASSESSMENT = 'quality_assessment',
  /** 审校任务 */
  REVIEW = 'REVIEW',
  /** 术语提取任务 */
  TERMINOLOGY_EXTRACTION = 'terminology_extraction',
  /** 翻译记忆库更新任务 */
  TM_UPDATE = 'tm_update',
  /** 翻译进度更新任务 */
  PROGRESS_UPDATE = 'progress_update',
  /** 翻译统计更新任务 */
  STATS_UPDATE = 'stats_update',
  /** 翻译缓存清理任务 */
  CACHE_CLEANUP = 'cache_cleanup',
  /** 翻译错误处理任务 */
  ERROR_HANDLING = 'error_handling',
  /** 翻译性能监控任务 */
  PERFORMANCE_MONITORING = 'performance_monitoring',
  /** 翻译成本计算任务 */
  COST_CALCULATION = 'cost_calculation',
  /** 翻译报告生成任务 */
  REPORT_GENERATION = 'report_generation',
  /** 翻译配置更新任务 */
  CONFIG_UPDATE = 'config_update',
  /** 翻译模型更新任务 */
  MODEL_UPDATE = 'model_update',
  /** 翻译验证任务 */
  VALIDATION = 'VALIDATION',
  /** 翻译质量检查任务 */
  QUALITY_CHECK = 'QUALITY_CHECK'
}

export enum QueueTaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  RETRYING = 'retrying',
  TIMEOUT = 'timeout'
}

export interface QueueTaskMetadata {
  projectId?: string;
  fileId?: string;
  segmentId?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  model?: string;
  provider?: string;
}

export interface QueueTask {
  /** 任务ID */
  id: string;
  /** 任务类型 */
  type: QueueTaskType;
  /** 任务优先级（数字越大优先级越高） */
  priority: number;
  /** 任务数据 */
  data: {
    text?: string;
    options?: TranslationOptions;
    segments?: string[];
    [key: string]: any;
  };
  /** 任务状态 */
  status: QueueTaskStatus;
  /** 重试次数 */
  retryCount: number;
  /** 错误信息 */
  error?: string;
  /** 任务元数据 */
  metadata?: {
    processingTime?: number;
    startTime?: Date;
    endTime?: Date;
    attempts?: number;
    lastAttempt?: Date;
    nextRetry?: Date;
    progress?: number;
    total?: number;
    current?: number;
    result?: any;
    provider?: string;
    model?: string;
    segmentCount?: number;
    totalProcessingTime?: number;
  };
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 开始处理时间 */
  startedAt?: Date;
  /** 完成时间 */
  completedAt?: Date;
  /** 处理结果 */
  result?: any;
}

export interface TaskMetrics {
  type: QueueTaskType;
  count: number;
  averageProcessingTime: number;
  successRate: number;
  failureRate: number;
} 