import { v4 as uuidv4 } from 'uuid';
import { QueueConfig } from './queue-config.interface';
import { QueueTask, QueueTaskStatus, QueueTaskType } from './queue-task.interface';
import logger from '../../../utils/logger';
import fs from 'fs';
import path from 'path';

export class TranslationQueueService {
  private queue: QueueTask[] = [];
  private processing: Map<string, QueueTask> = new Map();
  private config: QueueConfig;
  private isProcessing: boolean = false;
  private processInterval: NodeJS.Timeout | null = null;

  constructor(config: QueueConfig) {
    this.config = {
      processInterval: 1000,
      enablePersistence: false,
      ...config
    };
    this.initialize();
  }

  private initialize(): void {
    if (this.config.enablePersistence) {
      this.loadPersistedTasks();
    }
    this.startProcessing();
  }

  private startProcessing(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }

    this.processInterval = setInterval(() => {
      this.processNextBatch();
    }, this.config.processInterval);
  }

  private async processNextBatch(): Promise<void> {
    if (this.isProcessing || this.processing.size >= this.config.maxConcurrent) {
      return;
    }

    this.isProcessing = true;
    try {
      const availableSlots = this.config.maxConcurrent - this.processing.size;
      const tasksToProcess = this.queue
        .filter(task => task.status === QueueTaskStatus.PENDING)
        .sort((a, b) => b.priority - a.priority)
        .slice(0, availableSlots);

      await Promise.all(
        tasksToProcess.map(task => this.processTask(task))
      );
    } finally {
      this.isProcessing = false;
    }
  }

  private async processTask(task: QueueTask): Promise<void> {
    try {
      task.status = QueueTaskStatus.PROCESSING;
      task.startedAt = new Date();
      task.updatedAt = new Date();
      this.processing.set(task.id, task);

      // 这里将根据任务类型调用不同的处理方法
      switch (task.type) {
        case QueueTaskType.TRANSLATION:
          await this.handleTranslationTask(task);
          break;
        case QueueTaskType.VALIDATION:
          await this.handleValidationTask(task);
          break;
        case QueueTaskType.QUALITY_CHECK:
          await this.handleQualityCheckTask(task);
          break;
      }

      task.status = QueueTaskStatus.COMPLETED;
      task.completedAt = new Date();
      task.updatedAt = new Date();
    } catch (error) {
      task.status = QueueTaskStatus.FAILED;
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.updatedAt = new Date();

      if (task.retryCount < this.config.maxRetries) {
        task.retryCount++;
        task.status = QueueTaskStatus.PENDING;
        task.updatedAt = new Date();
        setTimeout(() => {
          this.queue.push(task);
        }, this.config.retryDelay);
      }
    } finally {
      this.processing.delete(task.id);
      this.persistTasks();
    }
  }

  private async handleTranslationTask(task: QueueTask): Promise<void> {
    // TODO: 实现翻译任务处理逻辑
    logger.info(`Processing translation task: ${task.id}`);
  }

  private async handleValidationTask(task: QueueTask): Promise<void> {
    // TODO: 实现验证任务处理逻辑
    logger.info(`Processing validation task: ${task.id}`);
  }

  private async handleQualityCheckTask(task: QueueTask): Promise<void> {
    // TODO: 实现质量检查任务处理逻辑
    logger.info(`Processing quality check task: ${task.id}`);
  }

  async addTask(task: Omit<QueueTask, 'id' | 'status' | 'retryCount' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const newTask: QueueTask = {
      ...task,
      id: uuidv4(),
      status: QueueTaskStatus.PENDING,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.queue.push(newTask);
    this.persistTasks();
    logger.info(`Added new task: ${newTask.id}`);
    return newTask.id;
  }

  async cancelTask(taskId: string): Promise<void> {
    const task = this.queue.find(t => t.id === taskId) || this.processing.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.status = QueueTaskStatus.CANCELLED;
    task.updatedAt = new Date();

    if (this.processing.has(taskId)) {
      this.processing.delete(taskId);
      this.queue.push(task);
    }

    this.persistTasks();
    logger.info(`Cancelled task: ${taskId}`);
  }

  async getTaskStatus(taskId: string): Promise<QueueTaskStatus> {
    const task = this.queue.find(t => t.id === taskId) || this.processing.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    return task.status;
  }

  async getTask(taskId: string): Promise<QueueTask | undefined> {
    return this.queue.find(t => t.id === taskId) || this.processing.get(taskId);
  }

  private persistTasks(): void {
    if (!this.config.enablePersistence || !this.config.persistencePath) {
      return;
    }

    try {
      const tasks = [...this.queue, ...Array.from(this.processing.values())];
      fs.writeFileSync(
        path.join(this.config.persistencePath, 'queue-tasks.json'),
        JSON.stringify(tasks, null, 2)
      );
    } catch (error) {
      logger.error('Failed to persist tasks:', error);
    }
  }

  private loadPersistedTasks(): void {
    if (!this.config.enablePersistence || !this.config.persistencePath) {
      return;
    }

    try {
      const filePath = path.join(this.config.persistencePath, 'queue-tasks.json');
      if (fs.existsSync(filePath)) {
        const tasks = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.queue = tasks.filter((task: QueueTask) => task.status === QueueTaskStatus.PENDING);
        this.processing = new Map(
          tasks
            .filter((task: QueueTask) => task.status === QueueTaskStatus.PROCESSING)
            .map((task: QueueTask) => [task.id, task])
        );
      }
    } catch (error) {
      logger.error('Failed to load persisted tasks:', error);
    }
  }

  async shutdown(): Promise<void> {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    this.persistTasks();
  }
} 