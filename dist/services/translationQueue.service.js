"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translationQueueService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const errorHandler_1 = require("../utils/errorHandler");
require("dotenv/config"); // Load environment variables
const QUEUE_NAME = 'translation-jobs';
class TranslationQueueService {
    constructor() {
        this.serviceName = 'TranslationQueueService';
        const connectionOptions = {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null // BullMQ specific option
        };
        // Optionally, only connect if Redis is configured or needed
        // For now, we comment out the connection and queue creation
        /*
        this.connection = new Redis(connectionOptions);
        this.connection.on('error', (err: Error) => logger.error('Redis Connection Error', err));
    
        this.queue = new Queue<TranslationJobData>(QUEUE_NAME, {
            connection: this.connection,
            defaultJobOptions: {
                attempts: 3, // Retry failed jobs 3 times
                backoff: {
                    type: 'exponential',
                    delay: 5000, // Wait 5s, 10s, 20s before retries
                },
                removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
                removeOnFail: { count: 5000 } // Keep last 5000 failed jobs
            }
        });
        logger.info(`Translation queue service initialized. Connected to Redis: ${connectionOptions.host}:${connectionOptions.port}`);
        */
        logger_1.default.warn(`Translation queue service initialized WITHOUT Redis connection (temporary).`);
    }
    getJobId(type, id) {
        // Create a potentially more readable job ID
        return `${type}-${id}-${Date.now()}`;
    }
    async addFileTranslationJob(projectId, fileId, options, userId, // Pass userId
    requesterRoles // Pass requesterRoles
    ) {
        const methodName = 'addFileTranslationJob';
        const jobId = this.getJobId('file', fileId);
        const jobData = { type: 'file', projectId, fileId, options, userId, requesterRoles };
        try {
            // Temporarily bypass adding to the queue
            // await this.queue.add(jobId, jobData, { jobId });
            logger_1.default.warn(`TEMPORARY: Skipped adding file translation job ${jobId} to queue.`);
            return jobId;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '文件翻译任务');
        }
    }
    async addProjectTranslationJob(projectId, options, userId, // Pass userId
    requesterRoles // Pass requesterRoles
    ) {
        const methodName = 'addProjectTranslationJob';
        const jobId = this.getJobId('project', projectId);
        const jobData = { type: 'project', projectId, options, userId, requesterRoles };
        try {
            // Temporarily bypass adding to the queue
            // await this.queue.add(jobId, jobData, { jobId });
            logger_1.default.warn(`TEMPORARY: Skipped adding project translation job ${jobId} to queue.`);
            return jobId;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '项目翻译任务');
        }
    }
    async getJobStatus(jobId) {
        // Temporarily return default status
        logger_1.default.warn(`TEMPORARY: Returning dummy status for job ${jobId} as queue is disabled.`);
        return { jobId, status: 'unknown', progress: 0, timestamp: Date.now() };
        // const methodName = 'getJobStatus';
        // try {
        //   const job = await this.queue?.getJob(jobId);
        //   if (!job) {
        //     throw new NotFoundError(`任务 ${jobId} 未找到`);
        //   }
        //   const state = await job.getState();
        //   const progress = job.progress;
        //   return {
        //     jobId: job.id || jobId,
        //     status: state,
        //     progress: progress,
        //     failedReason: job.failedReason,
        //     returnValue: job.returnvalue,
        //     timestamp: job.timestamp,
        //     processedOn: job.processedOn,
        //     finishedOn: job.finishedOn
        //   };
        // } catch (error) {
        //     if (!(error instanceof NotFoundError)) {
        //         logger.error(`Error in ${this.serviceName}.${methodName} for job ${jobId}:`, error);
        //     }
        //     throw handleServiceError(error, this.serviceName, methodName, '获取任务状态');
        // }
    }
    async cancelJob(jobId) {
        // Temporarily do nothing
        logger_1.default.warn(`TEMPORARY: Skipped cancelling job ${jobId} as queue is disabled.`);
        return;
        // const methodName = 'cancelJob';
        // try {
        //   const job = await this.queue?.getJob(jobId);
        //   if (!job) {
        //      logger.warn(`Attempted to cancel non-existent job ${jobId}`);
        //      return; // Or throw NotFoundError if preferred
        //   }
        //   const state = await job.getState();
        //   // Only allow cancelling active or waiting jobs
        //   if (state === 'active' || state === 'waiting' || state === 'delayed') {
        //       if (state === 'active') {
        //           // Attempt to send interrupt signal? Depends on worker logic.
        //           // For now, just remove.
        //           logger.info(`Job ${jobId} is active, attempting removal.`);
        //       }
        //       // Remove the job from the queue
        //       await job.remove();
        //       logger.info(`Job ${jobId} removed from queue.`);
        //   } else {
        //       logger.warn(`Job ${jobId} cannot be cancelled in state: ${state}`);
        //       // Optional: throw error if cancellation is expected to always succeed on valid ID
        //   }
        // } catch (error) {
        //     logger.error(`Error in ${this.serviceName}.${methodName} for job ${jobId}:`, error);
        //     throw handleServiceError(error, this.serviceName, methodName, '取消任务');
        // }
    }
    // Graceful shutdown
    async close() {
        // Temporarily do nothing
        // await this.queue?.close();
        // await this.connection?.quit();
        logger_1.default.info('Translation queue service shutdown skipped (temporary).');
    }
}
// Export singleton instance
exports.translationQueueService = new TranslationQueueService();
