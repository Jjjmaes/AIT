"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const performance_monitor_1 = require("../monitoring/performance-monitor");
const queue_task_interface_1 = require("../queue/queue-task.interface");
describe('Performance Monitoring', () => {
    let performanceMonitor;
    const mockCache = {
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(null)
    };
    beforeEach(() => {
        jest.clearAllMocks();
        performanceMonitor = new performance_monitor_1.PerformanceMonitor(mockCache);
    });
    it('should record successful requests', async () => {
        await performanceMonitor.recordRequest(true, 100);
        const metrics = performanceMonitor.getMetrics();
        expect(metrics.totalRequests).toBe(1);
        expect(metrics.successfulRequests).toBe(1);
        expect(metrics.failedRequests).toBe(0);
        expect(metrics.averageProcessingTime).toBe(100);
    });
    it('should record failed requests', async () => {
        await performanceMonitor.recordRequest(false, 100);
        const metrics = performanceMonitor.getMetrics();
        expect(metrics.totalRequests).toBe(1);
        expect(metrics.successfulRequests).toBe(0);
        expect(metrics.failedRequests).toBe(1);
    });
    it('should record cache hits and misses', async () => {
        await performanceMonitor.recordCacheAccess(true);
        await performanceMonitor.recordCacheAccess(false);
        const metrics = performanceMonitor.getMetrics();
        expect(metrics.cacheHits).toBe(1);
        expect(metrics.cacheMisses).toBe(1);
    });
    it('should record queue metrics', async () => {
        await performanceMonitor.recordQueueMetrics(5, 2);
        const metrics = performanceMonitor.getMetrics();
        expect(metrics.queueSize).toBe(5);
        expect(metrics.activeTasks).toBe(2);
    });
    it('should record task completion metrics', async () => {
        await performanceMonitor.recordTaskCompletion(queue_task_interface_1.QueueTaskType.TRANSLATION, true, 100);
        await performanceMonitor.recordTaskCompletion(queue_task_interface_1.QueueTaskType.TRANSLATION, false, 200);
        const taskMetrics = performanceMonitor.getTaskMetrics();
        const translationMetrics = taskMetrics.find(m => m.type === queue_task_interface_1.QueueTaskType.TRANSLATION);
        expect(translationMetrics).toBeDefined();
        expect(translationMetrics?.count).toBe(2);
        expect(translationMetrics?.successRate).toBeGreaterThan(0);
        expect(translationMetrics?.failureRate).toBeGreaterThan(0);
        expect(translationMetrics?.averageProcessingTime).toBe(150); // (100 + 200) / 2
    });
    it('should record retry counts', async () => {
        await performanceMonitor.recordRetry();
        await performanceMonitor.recordRetry();
        const metrics = performanceMonitor.getMetrics();
        expect(metrics.retryCount).toBe(2);
    });
    it('should reset metrics', async () => {
        await performanceMonitor.recordRequest(true, 100);
        await performanceMonitor.recordCacheAccess(true);
        await performanceMonitor.recordTaskCompletion(queue_task_interface_1.QueueTaskType.TRANSLATION, true, 100);
        await performanceMonitor.resetMetrics();
        const metrics = performanceMonitor.getMetrics();
        expect(metrics.totalRequests).toBe(0);
        expect(metrics.successfulRequests).toBe(0);
        expect(metrics.cacheHits).toBe(0);
        const taskMetrics = performanceMonitor.getTaskMetrics();
        const translationMetrics = taskMetrics.find(m => m.type === queue_task_interface_1.QueueTaskType.TRANSLATION);
        expect(translationMetrics?.count).toBe(0);
    });
});
