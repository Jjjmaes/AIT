export interface QueueConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟时间（毫秒） */
  retryDelay: number;
  /** 任务超时时间（毫秒） */
  timeout: number;
  /** 最大并发任务数 */
  maxConcurrent: number;
  /** 优先级级别数量 */
  priorityLevels: number;
  /** 任务处理间隔（毫秒） */
  processInterval?: number;
  /** 是否启用持久化 */
  enablePersistence?: boolean;
  /** 持久化路径 */
  persistencePath?: string;
} 