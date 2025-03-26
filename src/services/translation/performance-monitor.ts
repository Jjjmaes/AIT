import { TranslationCacheService } from './cache/translation-cache.service';
import { QueueTaskType, TaskMetrics } from './queue/queue-task.interface';
import { AIServiceResponse } from '../../types/ai-service.types';

export interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private taskMetrics: Map<QueueTaskType, TaskMetrics>;
  private cacheService: TranslationCacheService;

  constructor(cacheService: TranslationCacheService) {
    this.cacheService = cacheService;
    this.metrics = this.initializeMetrics();
    this.taskMetrics = this.initializeTaskMetrics();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageProcessingTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0
    };
  }

  private initializeTaskMetrics(): Map<QueueTaskType, TaskMetrics> {
    const metrics = new Map<QueueTaskType, TaskMetrics>();
    Object.values(QueueTaskType).forEach(type => {
      metrics.set(type, {
        type,
        count: 0,
        successRate: 0,
        failureRate: 0,
        averageProcessingTime: 0
      });
    });
    return metrics;
  }

  public recordRequest(response: AIServiceResponse | null): void {
    this.metrics.totalRequests++;

    if (response) {
      this.metrics.successfulRequests++;
      this.metrics.averageProcessingTime = this.calculateNewAverage(
        this.metrics.averageProcessingTime,
        this.metrics.successfulRequests,
        response.metadata.processingTime
      );
    } else {
      this.metrics.failedRequests++;
    }
  }

  public recordCacheAccess(isHit: boolean): void {
    if (isHit) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
    this.metrics.cacheHitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses);
  }

  public recordTaskCompletion(type: QueueTaskType, isSuccess: boolean, processingTime: number): void {
    const metrics = this.taskMetrics.get(type);
    if (!metrics) return;

    metrics.count++;
    if (isSuccess) {
      metrics.successRate = (metrics.successRate * (metrics.count - 1) + 1) / metrics.count;
      metrics.failureRate = (metrics.failureRate * (metrics.count - 1)) / metrics.count;
    } else {
      metrics.successRate = (metrics.successRate * (metrics.count - 1)) / metrics.count;
      metrics.failureRate = (metrics.failureRate * (metrics.count - 1) + 1) / metrics.count;
    }

    metrics.averageProcessingTime = this.calculateNewAverage(
      metrics.averageProcessingTime,
      metrics.count,
      processingTime
    );
  }

  private calculateNewAverage(currentAverage: number, count: number, newValue: number): number {
    return (currentAverage * (count - 1) + newValue) / count;
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getTaskMetrics(): TaskMetrics[] {
    return Array.from(this.taskMetrics.values());
  }
} 