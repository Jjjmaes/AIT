import { TranslationQueueService } from '../translation-queue.service';
import { QueueConfig } from '../queue-config.interface';
import { QueueTask, QueueTaskStatus, QueueTaskType } from '../queue-task.interface';

describe('TranslationQueueService', () => {
  let queueService: TranslationQueueService;
  let mockConfig: QueueConfig;

  beforeEach(() => {
    mockConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 5000,
      maxConcurrent: 2,
      priorityLevels: 3,
      processInterval: 100
    };
    queueService = new TranslationQueueService(mockConfig);
  });

  afterEach(async () => {
    await queueService.shutdown();
  });

  describe('addTask', () => {
    it('should add a new task to the queue', async () => {
      const task: Omit<QueueTask, 'id' | 'status' | 'retryCount' | 'createdAt' | 'updatedAt'> = {
        type: QueueTaskType.TRANSLATION,
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
      expect(addedTask?.status).toBe(QueueTaskStatus.PENDING);
      expect(addedTask?.type).toBe(QueueTaskType.TRANSLATION);
    });
  });

  describe('cancelTask', () => {
    it('should cancel a pending task', async () => {
      const task: Omit<QueueTask, 'id' | 'status' | 'retryCount' | 'createdAt' | 'updatedAt'> = {
        type: QueueTaskType.TRANSLATION,
        priority: 1,
        data: {
          text: 'Hello, world!'
        }
      };

      const taskId = await queueService.addTask(task);
      await queueService.cancelTask(taskId);

      const cancelledTask = await queueService.getTask(taskId);
      expect(cancelledTask?.status).toBe(QueueTaskStatus.CANCELLED);
    });

    it('should throw error when cancelling non-existent task', async () => {
      await expect(queueService.cancelTask('non-existent-id'))
        .rejects
        .toThrow('Task not found');
    });
  });

  describe('getTaskStatus', () => {
    it('should return task status', async () => {
      const task: Omit<QueueTask, 'id' | 'status' | 'retryCount' | 'createdAt' | 'updatedAt'> = {
        type: QueueTaskType.TRANSLATION,
        priority: 1,
        data: {
          text: 'Hello, world!'
        }
      };

      const taskId = await queueService.addTask(task);
      const status = await queueService.getTaskStatus(taskId);

      expect(status).toBe(QueueTaskStatus.PENDING);
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
      const processedIds: string[] = [];
      const originalHandleTranslationTask = (queueService as any).handleTranslationTask;
      (queueService as any).handleTranslationTask = jest.fn().mockImplementation(async (task: QueueTask) => {
        processedIds.push(task.id);
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const tasks = [
        {
          type: QueueTaskType.TRANSLATION,
          priority: 1,
          data: { text: 'Low priority' }
        },
        {
          type: QueueTaskType.TRANSLATION,
          priority: 2,
          data: { text: 'High priority' }
        }
      ];

      const taskIds = await Promise.all(tasks.map(task => queueService.addTask(task)));
      
      // 等待足够的时间使任务开始处理
      await new Promise(resolve => setTimeout(resolve, 300));

      // 恢复原始方法
      (queueService as any).handleTranslationTask = originalHandleTranslationTask;
      
      // 验证任务处理的顺序 - 高优先级任务应该先被处理
      expect(processedIds.length).toBeGreaterThan(0);
      if (processedIds.length > 0) {
        expect(processedIds[0]).toBe(taskIds[1]); // 高优先级任务的ID
      }
    });

    it('should respect max concurrent tasks limit', async () => {
      const tasks = Array(5).fill(null).map((_, i) => ({
        type: QueueTaskType.TRANSLATION,
        priority: 1,
        data: { text: `Task ${i}` }
      }));

      const taskIds = await Promise.all(tasks.map(task => queueService.addTask(task)));
      
      // Wait for tasks to be processed
      await new Promise(resolve => setTimeout(resolve, 200));

      const activeTasks = await Promise.all(taskIds.map(id => queueService.getTask(id)));
      const processingCount = activeTasks.filter(task => 
        task?.status === QueueTaskStatus.PROCESSING
      ).length;
      
      expect(processingCount).toBeLessThanOrEqual(mockConfig.maxConcurrent);
    });
  });
}); 