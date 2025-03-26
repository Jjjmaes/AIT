import { CacheKey } from '../cache/cache-keys.enum';
import { TranslationCacheService } from '../cache/translation-cache.service';
import { QueueTaskType } from '../queue/queue-task.interface';
import { AIServiceResponse } from '../../../types/ai-service.types';

export interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  totalProcessingTime: number;
  cacheHits: number;
  cacheMisses: number;
  queueSize: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  retryCount: number;
  lastUpdated: Date;
}

export interface TaskMetrics {
  type: QueueTaskType;
  count: number;
  averageProcessingTime: number;
  successRate: number;
  failureRate: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private taskMetrics: Map<QueueTaskType, TaskMetrics>;
  private cacheService: TranslationCacheService;

  constructor(cacheService: TranslationCacheService) {
    this.cacheService = cacheService;
    this.metrics = this.initializeMetrics();
    this.taskMetrics = new Map();
    this.initializeTaskMetrics();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      queueSize: 0,
      activeTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      retryCount: 0,
      lastUpdated: new Date()
    };
  }

  private initializeTaskMetrics(): void {
    Object.values(QueueTaskType).forEach(type => {
      this.taskMetrics.set(type, {
        type,
        count: 0,
        averageProcessingTime: 0,
        successRate: 0,
        failureRate: 0
      });
    });
  }

  public async recordRequest(successOrResponse: boolean | AIServiceResponse | null, processingTime?: number): Promise<void> {
    let isSuccess = false;
    let time = 0;

    if (typeof successOrResponse === 'boolean') {
      isSuccess = successOrResponse;
      time = processingTime || 0;
    } else {
      isSuccess = !!successOrResponse;
      time = successOrResponse?.metadata?.processingTime || 0;
    }

    this.metrics.totalRequests++;
    
    if (isSuccess) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    this.metrics.totalProcessingTime += time;
    
    // 如果是失败的请求，也要计算到平均处理时间中
    this.metrics.averageProcessingTime = this.metrics.totalRequests > 0
      ? this.metrics.totalProcessingTime / this.metrics.totalRequests
      : 0;
    
    this.metrics.lastUpdated = new Date();
    await this.updateCache();
  }

  public async recordCacheAccess(hit: boolean): Promise<void> {
    if (hit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
    await this.updateCache();
  }

  public async recordQueueMetrics(queueSize: number, activeTasks: number): Promise<void> {
    this.metrics.queueSize = queueSize;
    this.metrics.activeTasks = activeTasks;
    await this.updateCache();
  }

  public async recordTaskCompletion(
    type: QueueTaskType,
    success: boolean,
    processingTime: number
  ): Promise<void> {
    const metrics = this.taskMetrics.get(type);
    if (metrics) {
      metrics.count++;
      metrics.averageProcessingTime = 
        (metrics.averageProcessingTime * (metrics.count - 1) + processingTime) / metrics.count;
      
      if (success) {
        this.metrics.completedTasks++;
      } else {
        this.metrics.failedTasks++;
      }
      
      // 计算成功率和失败率，并保留两位小数
      const total = this.metrics.completedTasks + this.metrics.failedTasks;
      if (total > 0) {
        metrics.successRate = parseFloat((this.metrics.completedTasks / total).toFixed(2));
        metrics.failureRate = parseFloat((this.metrics.failedTasks / total).toFixed(2));
      }
    }
    await this.updateCache();
  }

  public async recordRetry(): Promise<void> {
    this.metrics.retryCount++;
    await this.updateCache();
  }

  private async updateCache(): Promise<void> {
    await this.cacheService.set(CacheKey.PERFORMANCE_METRICS, this.metrics);
    await this.cacheService.set(CacheKey.TASK_STATUS, Array.from(this.taskMetrics.values()));
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getTaskMetrics(): TaskMetrics[] {
    return Array.from(this.taskMetrics.values());
  }

  public async resetMetrics(): Promise<void> {
    this.metrics = this.initializeMetrics();
    this.initializeTaskMetrics();
    await this.updateCache();
  }
} 