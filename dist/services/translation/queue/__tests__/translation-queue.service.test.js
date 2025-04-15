"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const translation_queue_service_1 = require("../translation-queue.service");
const queue_task_interface_1 = require("../queue-task.interface");
describe('TranslationQueueService', () => {
    let queueService;
    let mockConfig;
    beforeEach(() => {
        mockConfig = {
            maxRetries: 3,
            retryDelay: 1000,
            timeout: 5000,
            maxConcurrent: 2,
            priorityLevels: 3,
            processInterval: 100
        };
        queueService = new translation_queue_service_1.TranslationQueueService(mockConfig);
    });
    afterEach(async () => {
        await queueService.shutdown();
    });
    describe('addTask', () => {
        it('should add a new task to the queue', async () => {
            const task = {
                type: queue_task_interface_1.QueueTaskType.TRANSLATION,
                priority: 1,
                data: {
                    text: 'Hello, world!',
                    options: {
                        sourceLanguage: 'en',
                        targetLanguage: 'zh'
                    }
                }
            };
            const taskId = await queueService.addTask(task);
            const addedTask = await queueService.getTask(taskId);
            expect(addedTask).toBeDefined();
            expect(addedTask?.id).toBe(taskId);
            expect(addedTask?.status).toBe(queue_task_interface_1.QueueTaskStatus.PENDING);
            expect(addedTask?.type).toBe(queue_task_interface_1.QueueTaskType.TRANSLATION);
        });
    });
    describe('cancelTask', () => {
        it('should cancel a pending task', async () => {
            const task = {
                type: queue_task_interface_1.QueueTaskType.TRANSLATION,
                priority: 1,
                data: {
                    text: 'Hello, world!'
                }
            };
            const taskId = await queueService.addTask(task);
            await queueService.cancelTask(taskId);
            const cancelledTask = await queueService.getTask(taskId);
            expect(cancelledTask?.status).toBe(queue_task_interface_1.QueueTaskStatus.CANCELLED);
        });
        it('should throw error when cancelling non-existent task', async () => {
            await expect(queueService.cancelTask('non-existent-id'))
                .rejects
                .toThrow('Task not found');
        });
    });
    describe('getTaskStatus', () => {
        it('should return task status', async () => {
            const task = {
                type: queue_task_interface_1.QueueTaskType.TRANSLATION,
                priority: 1,
                data: {
                    text: 'Hello, world!'
                }
            };
            const taskId = await queueService.addTask(task);
            const status = await queueService.getTaskStatus(taskId);
            expect(status).toBe(queue_task_interface_1.QueueTaskStatus.PENDING);
        });
        it('should throw error when getting status of non-existent task', async () => {
            await expect(queueService.getTaskStatus('non-existent-id'))
                .rejects
                .toThrow('Task not found');
        });
    });
    describe('task processing', () => {
        it('should process tasks in priority order', async () => {
            // 模拟处理方法，记录处理顺序
            const processedIds = [];
            const originalHandleTranslationTask = queueService.handleTranslationTask;
            queueService.handleTranslationTask = jest.fn().mockImplementation(async (task) => {
                processedIds.push(task.id);
                await new Promise(resolve => setTimeout(resolve, 10));
            });
            const tasks = [
                {
                    type: queue_task_interface_1.QueueTaskType.TRANSLATION,
                    priority: 1,
                    data: { text: 'Low priority' }
                },
                {
                    type: queue_task_interface_1.QueueTaskType.TRANSLATION,
                    priority: 2,
                    data: { text: 'High priority' }
                }
            ];
            const taskIds = await Promise.all(tasks.map(task => queueService.addTask(task)));
            // 等待足够的时间使任务开始处理
            await new Promise(resolve => setTimeout(resolve, 300));
            // 恢复原始方法
            queueService.handleTranslationTask = originalHandleTranslationTask;
            // 验证任务处理的顺序 - 高优先级任务应该先被处理
            expect(processedIds.length).toBeGreaterThan(0);
            if (processedIds.length > 0) {
                expect(processedIds[0]).toBe(taskIds[1]); // 高优先级任务的ID
            }
        });
        it('should respect max concurrent tasks limit', async () => {
            const tasks = Array(5).fill(null).map((_, i) => ({
                type: queue_task_interface_1.QueueTaskType.TRANSLATION,
                priority: 1,
                data: { text: `Task ${i}` }
            }));
            const taskIds = await Promise.all(tasks.map(task => queueService.addTask(task)));
            // Wait for tasks to be processed
            await new Promise(resolve => setTimeout(resolve, 200));
            const activeTasks = await Promise.all(taskIds.map(id => queueService.getTask(id)));
            const processingCount = activeTasks.filter(task => task?.status === queue_task_interface_1.QueueTaskStatus.PROCESSING).length;
            expect(processingCount).toBeLessThanOrEqual(mockConfig.maxConcurrent);
        });
    });
});
