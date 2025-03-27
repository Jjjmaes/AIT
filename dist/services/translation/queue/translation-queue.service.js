"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationQueueService = void 0;
const uuid_1 = require("uuid");
const queue_task_interface_1 = require("./queue-task.interface");
const logger_1 = __importDefault(require("../../../utils/logger"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class TranslationQueueService {
    constructor(config) {
        this.queue = [];
        this.processing = new Map();
        this.isProcessing = false;
        this.processInterval = null;
        this.config = {
            processInterval: 1000,
            enablePersistence: false,
            ...config
        };
        this.initialize();
    }
    initialize() {
        if (this.config.enablePersistence) {
            this.loadPersistedTasks();
        }
        this.startProcessing();
    }
    startProcessing() {
        if (this.processInterval) {
            clearInterval(this.processInterval);
        }
        this.processInterval = setInterval(() => {
            this.processNextBatch();
        }, this.config.processInterval);
    }
    async processNextBatch() {
        if (this.isProcessing || this.processing.size >= this.config.maxConcurrent) {
            return;
        }
        this.isProcessing = true;
        try {
            const availableSlots = this.config.maxConcurrent - this.processing.size;
            const tasksToProcess = this.queue
                .filter(task => task.status === queue_task_interface_1.QueueTaskStatus.PENDING)
                .sort((a, b) => b.priority - a.priority)
                .slice(0, availableSlots);
            await Promise.all(tasksToProcess.map(task => this.processTask(task)));
        }
        finally {
            this.isProcessing = false;
        }
    }
    async processTask(task) {
        try {
            task.status = queue_task_interface_1.QueueTaskStatus.PROCESSING;
            task.startedAt = new Date();
            task.updatedAt = new Date();
            this.processing.set(task.id, task);
            // 这里将根据任务类型调用不同的处理方法
            switch (task.type) {
                case queue_task_interface_1.QueueTaskType.TRANSLATION:
                    await this.handleTranslationTask(task);
                    break;
                case queue_task_interface_1.QueueTaskType.VALIDATION:
                    await this.handleValidationTask(task);
                    break;
                case queue_task_interface_1.QueueTaskType.QUALITY_CHECK:
                    await this.handleQualityCheckTask(task);
                    break;
            }
            task.status = queue_task_interface_1.QueueTaskStatus.COMPLETED;
            task.completedAt = new Date();
            task.updatedAt = new Date();
        }
        catch (error) {
            task.status = queue_task_interface_1.QueueTaskStatus.FAILED;
            task.error = error instanceof Error ? error.message : 'Unknown error';
            task.updatedAt = new Date();
            if (task.retryCount < this.config.maxRetries) {
                task.retryCount++;
                task.status = queue_task_interface_1.QueueTaskStatus.PENDING;
                task.updatedAt = new Date();
                setTimeout(() => {
                    this.queue.push(task);
                }, this.config.retryDelay);
            }
        }
        finally {
            this.processing.delete(task.id);
            this.persistTasks();
        }
    }
    async handleTranslationTask(task) {
        // TODO: 实现翻译任务处理逻辑
        logger_1.default.info(`Processing translation task: ${task.id}`);
    }
    async handleValidationTask(task) {
        // TODO: 实现验证任务处理逻辑
        logger_1.default.info(`Processing validation task: ${task.id}`);
    }
    async handleQualityCheckTask(task) {
        // TODO: 实现质量检查任务处理逻辑
        logger_1.default.info(`Processing quality check task: ${task.id}`);
    }
    async addTask(task) {
        const newTask = {
            ...task,
            id: (0, uuid_1.v4)(),
            status: queue_task_interface_1.QueueTaskStatus.PENDING,
            retryCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.queue.push(newTask);
        this.persistTasks();
        logger_1.default.info(`Added new task: ${newTask.id}`);
        return newTask.id;
    }
    async cancelTask(taskId) {
        const task = this.queue.find(t => t.id === taskId) || this.processing.get(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        task.status = queue_task_interface_1.QueueTaskStatus.CANCELLED;
        task.updatedAt = new Date();
        if (this.processing.has(taskId)) {
            this.processing.delete(taskId);
            this.queue.push(task);
        }
        this.persistTasks();
        logger_1.default.info(`Cancelled task: ${taskId}`);
    }
    async getTaskStatus(taskId) {
        const task = this.queue.find(t => t.id === taskId) || this.processing.get(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        return task.status;
    }
    async getTask(taskId) {
        return this.queue.find(t => t.id === taskId) || this.processing.get(taskId);
    }
    persistTasks() {
        if (!this.config.enablePersistence || !this.config.persistencePath) {
            return;
        }
        try {
            const tasks = [...this.queue, ...Array.from(this.processing.values())];
            fs_1.default.writeFileSync(path_1.default.join(this.config.persistencePath, 'queue-tasks.json'), JSON.stringify(tasks, null, 2));
        }
        catch (error) {
            logger_1.default.error('Failed to persist tasks:', error);
        }
    }
    loadPersistedTasks() {
        if (!this.config.enablePersistence || !this.config.persistencePath) {
            return;
        }
        try {
            const filePath = path_1.default.join(this.config.persistencePath, 'queue-tasks.json');
            if (fs_1.default.existsSync(filePath)) {
                const tasks = JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
                this.queue = tasks.filter((task) => task.status === queue_task_interface_1.QueueTaskStatus.PENDING);
                this.processing = new Map(tasks
                    .filter((task) => task.status === queue_task_interface_1.QueueTaskStatus.PROCESSING)
                    .map((task) => [task.id, task]));
            }
        }
        catch (error) {
            logger_1.default.error('Failed to load persisted tasks:', error);
        }
    }
    async shutdown() {
        if (this.processInterval) {
            clearInterval(this.processInterval);
            this.processInterval = null;
        }
        this.persistTasks();
    }
}
exports.TranslationQueueService = TranslationQueueService;
