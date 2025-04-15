"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceMonitor = void 0;
const queue_task_interface_1 = require("./queue/queue-task.interface");
class PerformanceMonitor {
    constructor(cacheService) {
        this.cacheService = cacheService;
        this.metrics = this.initializeMetrics();
        this.taskMetrics = this.initializeTaskMetrics();
    }
    initializeMetrics() {
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
    initializeTaskMetrics() {
        const metrics = new Map();
        Object.values(queue_task_interface_1.QueueTaskType).forEach(type => {
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
    recordRequest(response) {
        this.metrics.totalRequests++;
        if (response) {
            this.metrics.successfulRequests++;
            this.metrics.averageProcessingTime = this.calculateNewAverage(this.metrics.averageProcessingTime, this.metrics.successfulRequests, response.metadata.processingTime);
        }
        else {
            this.metrics.failedRequests++;
        }
    }
    recordCacheAccess(isHit) {
        if (isHit) {
            this.metrics.cacheHits++;
        }
        else {
            this.metrics.cacheMisses++;
        }
        this.metrics.cacheHitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses);
    }
    recordTaskCompletion(type, isSuccess, processingTime) {
        const metrics = this.taskMetrics.get(type);
        if (!metrics)
            return;
        metrics.count++;
        if (isSuccess) {
            metrics.successRate = (metrics.successRate * (metrics.count - 1) + 1) / metrics.count;
            metrics.failureRate = (metrics.failureRate * (metrics.count - 1)) / metrics.count;
        }
        else {
            metrics.successRate = (metrics.successRate * (metrics.count - 1)) / metrics.count;
            metrics.failureRate = (metrics.failureRate * (metrics.count - 1) + 1) / metrics.count;
        }
        metrics.averageProcessingTime = this.calculateNewAverage(metrics.averageProcessingTime, metrics.count, processingTime);
    }
    calculateNewAverage(currentAverage, count, newValue) {
        return (currentAverage * (count - 1) + newValue) / count;
    }
    getMetrics() {
        return { ...this.metrics };
    }
    getTaskMetrics() {
        return Array.from(this.taskMetrics.values());
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
