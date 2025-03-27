"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const performance_monitor_1 = require("../performance-monitor");
const queue_task_interface_1 = require("../../queue/queue-task.interface");
const cache_keys_enum_1 = require("../../cache/cache-keys.enum");
describe('PerformanceMonitor', () => {
    let monitor;
    let mockCacheService;
    beforeEach(() => {
        mockCacheService = {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
            clear: jest.fn(),
            shutdown: jest.fn()
        };
        monitor = new performance_monitor_1.PerformanceMonitor(mockCacheService);
    });
    describe('recordRequest', () => {
        it('should record successful request', async () => {
            await monitor.recordRequest(true, 100);
            const metrics = monitor.getMetrics();
            expect(metrics.totalRequests).toBe(1);
            expect(metrics.successfulRequests).toBe(1);
            expect(metrics.failedRequests).toBe(0);
            expect(metrics.averageProcessingTime).toBe(100);
            expect(metrics.totalProcessingTime).toBe(100);
            expect(mockCacheService.set).toHaveBeenCalledWith(cache_keys_enum_1.CacheKey.PERFORMANCE_METRICS, expect.any(Object));
        });
        it('should record failed request', async () => {
            await monitor.recordRequest(false, 200);
            const metrics = monitor.getMetrics();
            expect(metrics.totalRequests).toBe(1);
            expect(metrics.successfulRequests).toBe(0);
            expect(metrics.failedRequests).toBe(1);
            expect(metrics.averageProcessingTime).toBe(200);
            expect(metrics.totalProcessingTime).toBe(200);
        });
        it('should calculate correct average processing time for multiple requests', async () => {
            await monitor.recordRequest(true, 100);
            await monitor.recordRequest(true, 200);
            await monitor.recordRequest(false, 300);
            const metrics = monitor.getMetrics();
            expect(metrics.averageProcessingTime).toBe(200); // (100 + 200 + 300) / 3
        });
    });
    describe('recordCacheAccess', () => {
        it('should record cache hit', async () => {
            await monitor.recordCacheAccess(true);
            const metrics = monitor.getMetrics();
            expect(metrics.cacheHits).toBe(1);
            expect(metrics.cacheMisses).toBe(0);
        });
        it('should record cache miss', async () => {
            await monitor.recordCacheAccess(false);
            const metrics = monitor.getMetrics();
            expect(metrics.cacheHits).toBe(0);
            expect(metrics.cacheMisses).toBe(1);
        });
    });
    describe('recordQueueMetrics', () => {
        it('should update queue metrics', async () => {
            await monitor.recordQueueMetrics(10, 5);
            const metrics = monitor.getMetrics();
            expect(metrics.queueSize).toBe(10);
            expect(metrics.activeTasks).toBe(5);
        });
    });
    describe('recordTaskCompletion', () => {
        it('should record successful task completion', async () => {
            await monitor.recordTaskCompletion(queue_task_interface_1.QueueTaskType.TRANSLATION, true, 100);
            const metrics = monitor.getMetrics();
            const taskMetrics = monitor.getTaskMetrics();
            expect(metrics.completedTasks).toBe(1);
            expect(metrics.failedTasks).toBe(0);
            expect(taskMetrics[0].successRate).toBe(1);
            expect(taskMetrics[0].failureRate).toBe(0);
            expect(taskMetrics[0].averageProcessingTime).toBe(100);
        });
        it('should record failed task completion', async () => {
            await monitor.recordTaskCompletion(queue_task_interface_1.QueueTaskType.TRANSLATION, false, 200);
            const metrics = monitor.getMetrics();
            const taskMetrics = monitor.getTaskMetrics();
            expect(metrics.completedTasks).toBe(0);
            expect(metrics.failedTasks).toBe(1);
            expect(taskMetrics[0].successRate).toBe(0);
            expect(taskMetrics[0].failureRate).toBe(1);
            expect(taskMetrics[0].averageProcessingTime).toBe(200);
        });
        it('should calculate correct success rate for multiple tasks', async () => {
            await monitor.recordTaskCompletion(queue_task_interface_1.QueueTaskType.TRANSLATION, true, 100);
            await monitor.recordTaskCompletion(queue_task_interface_1.QueueTaskType.TRANSLATION, true, 200);
            await monitor.recordTaskCompletion(queue_task_interface_1.QueueTaskType.TRANSLATION, false, 300);
            const taskMetrics = monitor.getTaskMetrics();
            expect(taskMetrics[0].successRate).toBe(0.67); // 2/3
            expect(taskMetrics[0].failureRate).toBe(0.33); // 1/3
            expect(taskMetrics[0].averageProcessingTime).toBe(200); // (100 + 200 + 300) / 3
        });
    });
    describe('recordRetry', () => {
        it('should increment retry count', async () => {
            await monitor.recordRetry();
            const metrics = monitor.getMetrics();
            expect(metrics.retryCount).toBe(1);
        });
    });
    describe('resetMetrics', () => {
        it('should reset all metrics to initial values', async () => {
            // Record some metrics first
            await monitor.recordRequest(true, 100);
            await monitor.recordCacheAccess(true);
            await monitor.recordQueueMetrics(10, 5);
            await monitor.recordTaskCompletion(queue_task_interface_1.QueueTaskType.TRANSLATION, true, 100);
            await monitor.recordRetry();
            // Reset metrics
            await monitor.resetMetrics();
            const metrics = monitor.getMetrics();
            expect(metrics.totalRequests).toBe(0);
            expect(metrics.successfulRequests).toBe(0);
            expect(metrics.failedRequests).toBe(0);
            expect(metrics.averageProcessingTime).toBe(0);
            expect(metrics.totalProcessingTime).toBe(0);
            expect(metrics.cacheHits).toBe(0);
            expect(metrics.cacheMisses).toBe(0);
            expect(metrics.queueSize).toBe(0);
            expect(metrics.activeTasks).toBe(0);
            expect(metrics.completedTasks).toBe(0);
            expect(metrics.failedTasks).toBe(0);
            expect(metrics.retryCount).toBe(0);
            const taskMetrics = monitor.getTaskMetrics();
            expect(taskMetrics[0].count).toBe(0);
            expect(taskMetrics[0].successRate).toBe(0);
            expect(taskMetrics[0].failureRate).toBe(0);
            expect(taskMetrics[0].averageProcessingTime).toBe(0);
        });
    });
    describe('getMetrics', () => {
        it('should return a copy of metrics', async () => {
            await monitor.recordRequest(true, 100);
            const metrics1 = monitor.getMetrics();
            const metrics2 = monitor.getMetrics();
            expect(metrics1).toEqual(metrics2);
            expect(metrics1).not.toBe(metrics2); // Should be different objects
        });
    });
    describe('getTaskMetrics', () => {
        it('should return metrics for all task types', () => {
            const taskMetrics = monitor.getTaskMetrics();
            expect(taskMetrics.length).toBe(Object.keys(queue_task_interface_1.QueueTaskType).length);
            expect(taskMetrics.every(metric => metric.count === 0 &&
                metric.successRate === 0 &&
                metric.failureRate === 0 &&
                metric.averageProcessingTime === 0)).toBe(true);
        });
    });
});
