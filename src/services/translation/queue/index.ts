import { TranslationQueueService } from './translation-queue.service';

// 创建翻译队列服务实例，默认配置
export const translationQueueService = new TranslationQueueService({
  processInterval: 1000, // 处理间隔1秒
  maxConcurrent: 5, // 最大并发任务数
  maxRetries: 3, // 最大重试次数
  retryDelay: 5000, // 重试延迟5秒
  timeout: 60000, // 任务超时时间60秒
  priorityLevels: 5, // 优先级级别数量
  enablePersistence: true, // 启用任务持久化
  persistencePath: './data/queue' // 任务持久化路径
});

// 导出队列相关类型和接口
export * from './queue-task.interface';
export * from './queue-config.interface';