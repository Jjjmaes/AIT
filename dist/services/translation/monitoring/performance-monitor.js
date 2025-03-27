"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceMonitor = void 0;
const cache_keys_enum_1 = require("../cache/cache-keys.enum");
const queue_task_interface_1 = require("../queue/queue-task.interface");
class PerformanceMonitor {
    constructor(cacheService) {
        this.cacheService = cacheService;
        this.metrics = this.initializeMetrics();
        this.taskMetrics = new Map();
        this.initializeTaskMetrics();
    }
    initializeMetrics() {
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
    initializeTaskMetrics() {
        Object.values(queue_task_interface_1.QueueTaskType).forEach(type => {
            this.taskMetrics.set(type, {
                type,
                count: 0,
                averageProcessingTime: 0,
                successRate: 0,
                failureRate: 0
            });
        });
    }
    async recordRequest(successOrResponse, processingTime) {
        let isSuccess = false;
        let time = 0;
        if (typeof successOrResponse === 'boolean') {
            isSuccess = successOrResponse;
            time = processingTime || 0;
        }
        else {
            isSuccess = !!successOrResponse;
            time = successOrResponse?.metadata?.processingTime || 0;
        }
        this.metrics.totalRequests++;
        if (isSuccess) {
            this.metrics.successfulRequests++;
        }
        else {
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
    async recordCacheAccess(hit) {
        if (hit) {
            this.metrics.cacheHits++;
        }
        else {
            this.metrics.cacheMisses++;
        }
        await this.updateCache();
    }
    async recordQueueMetrics(queueSize, activeTasks) {
        this.metrics.queueSize = queueSize;
        this.metrics.activeTasks = activeTasks;
        await this.updateCache();
    }
    async recordTaskCompletion(type, success, processingTime) {
        const metrics = this.taskMetrics.get(type);
        if (metrics) {
            metrics.count++;
            metrics.averageProcessingTime =
                (metrics.averageProcessingTime * (metrics.count - 1) + processingTime) / metrics.count;
            if (success) {
                this.metrics.completedTasks++;
            }
            else {
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
    async recordRetry() {
        this.metrics.retryCount++;
        await this.updateCache();
    }
    async updateCache() {
        await this.cacheService.set(cache_keys_enum_1.CacheKey.PERFORMANCE_METRICS, this.metrics);
        await this.cacheService.set(cache_keys_enum_1.CacheKey.TASK_STATUS, Array.from(this.taskMetrics.values()));
    }
    getMetrics() {
        return { ...this.metrics };
    }
    getTaskMetrics() {
        return Array.from(this.taskMetrics.values());
    }
    async resetMetrics() {
        this.metrics = this.initializeMetrics();
        this.initializeTaskMetrics();
        await this.updateCache();
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
