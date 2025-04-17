import { Queue, Job, Worker, JobState } from 'bullmq';
import Redis from 'ioredis';
import logger from '../utils/logger';
import { TranslationOptions } from '../types/translation.types';
import { handleServiceError } from '../utils/errorHandler';
import { NotFoundError } from '../utils/errors';
import 'dotenv/config'; // Load environment variables

const QUEUE_NAME = 'translation-jobs';

// Export the job data interface
export interface TranslationJobData {
  type: 'file' | 'project';
  projectId: string;
  fileId?: string; // Only for file type
  userId: string; // User who initiated the job
  requesterRoles: string[]; // Roles of the user who initiated
  aiConfigId: string; // Make required again
  promptTemplateId: string;
  options?: TranslationOptions; // Optional translation settings
}

// Export the status interface
export interface JobStatus {
  jobId: string;
  status: JobState | 'unknown';
  progress: string | number | object | boolean;
  failedReason?: string;
  returnValue?: any;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}

class TranslationQueueService {
  // Make queue and connection optional or handle initialization differently
  private queue?: Queue<TranslationJobData>; 
  private connection?: Redis;
  private serviceName = 'TranslationQueueService';

  constructor() {
    const connectionOptions = {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null // BullMQ specific option
    };
    
    // Uncomment Redis connection and queue creation
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
    
   // Remove temporary warning
   // logger.warn(`Translation queue service initialized WITHOUT Redis connection (temporary).`);
  }

  private getJobId(type: 'file' | 'project', id: string): string {
      // Create a potentially more readable job ID
      return `${type}-${id}-${Date.now()}`;
  }

  async addFileTranslationJob(
    projectId: string,
    fileId: string,
    aiConfigId: string, 
    promptTemplateId: string,
    options: TranslationOptions, 
    userId: string, 
    requesterRoles: string[]
  ): Promise<string> {
    const methodName = 'addFileTranslationJob';
    const jobId = this.getJobId('file', fileId);
    const jobData: TranslationJobData = { 
        type: 'file', 
        projectId, 
        fileId, 
        userId, 
        requesterRoles, 
        aiConfigId, 
        promptTemplateId,
        options 
    };
    try {
      // Add check for queue existence
      if (!this.queue) {
        throw new Error('Translation queue is not initialized.');
      }
      // Uncomment adding to the queue
      await this.queue.add(jobId, jobData, { jobId });
      // Remove temporary log
      // logger.warn(`TEMPORARY: Skipped adding file translation job ${jobId} to queue.`);
      return jobId;
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '文件翻译任务');
    }
  }

  async addProjectTranslationJob(
    projectId: string,
    aiConfigId: string, 
    promptTemplateId: string, 
    options: TranslationOptions,
    userId: string, // Pass userId
    requesterRoles: string[] // Pass requesterRoles
  ): Promise<string> {
     const methodName = 'addProjectTranslationJob';
     const jobId = this.getJobId('project', projectId);
     const jobData: TranslationJobData = { 
        type: 'project', 
        projectId, 
        aiConfigId, 
        promptTemplateId, 
        options, 
        userId, 
        requesterRoles 
     };
     try {
       // Add check for queue existence
       if (!this.queue) {
         throw new Error('Translation queue is not initialized.');
       }
       // Uncomment adding to the queue
       await this.queue.add(jobId, jobData, { jobId });
       // Remove temporary log
       // logger.warn(`TEMPORARY: Skipped adding project translation job ${jobId} to queue.`);
       return jobId;
     } catch (error) {
       logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
       throw handleServiceError(error, this.serviceName, methodName, '项目翻译任务');
     }
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    // Uncomment actual job status logic
    // logger.warn(`TEMPORARY: Returning dummy status for job ${jobId} as queue is disabled.`);
    // return { jobId, status: 'unknown', progress: 0, timestamp: Date.now() };
    const methodName = 'getJobStatus';
    try {
      if (!this.queue) throw new Error('Queue not initialized'); // Add check
      const job = await this.queue.getJob(jobId);
      if (!job) {
        throw new NotFoundError(`任务 ${jobId} 未找到`);
      }

      const state = await job.getState();
      const progress = job.progress;
      
      return {
        jobId: job.id || jobId,
        status: state,
        progress: progress,
        failedReason: job.failedReason,
        returnValue: job.returnvalue,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn
      };
    } catch (error) {
        if (!(error instanceof NotFoundError)) {
            logger.error(`Error in ${this.serviceName}.${methodName} for job ${jobId}:`, error);
        }
        throw handleServiceError(error, this.serviceName, methodName, '获取任务状态');
    }
  }

  async cancelJob(jobId: string): Promise<void> {
     // Uncomment actual cancel logic
     // logger.warn(`TEMPORARY: Skipped cancelling job ${jobId} as queue is disabled.`);
     // return;
    const methodName = 'cancelJob';
    try {
      if (!this.queue) throw new Error('Queue not initialized'); // Add check
      const job = await this.queue.getJob(jobId);
      if (!job) {
         logger.warn(`Attempted to cancel non-existent job ${jobId}`);
         return; // Or throw NotFoundError if preferred
      }
        
      const state = await job.getState();
      // Only allow cancelling active or waiting jobs
      if (state === 'active' || state === 'waiting' || state === 'delayed') {
          if (state === 'active') {
              // Attempt to send interrupt signal? Depends on worker logic.
              // For now, just remove.
              logger.info(`Job ${jobId} is active, attempting removal.`);
          }
          // Remove the job from the queue
          await job.remove();
          logger.info(`Job ${jobId} removed from queue.`);
      } else {
          logger.warn(`Job ${jobId} cannot be cancelled in state: ${state}`);
          // Optional: throw error if cancellation is expected to always succeed on valid ID
      }
    } catch (error) {
        logger.error(`Error in ${this.serviceName}.${methodName} for job ${jobId}:`, error);
        throw handleServiceError(error, this.serviceName, methodName, '取消任务');
    }
  }

  // Graceful shutdown
  async close(): Promise<void> {
    // Uncomment closing logic
    await this.queue?.close();
    await this.connection?.quit();
    logger.info('Translation queue service connections closed.'); // Updated message
    // logger.info('Translation queue service shutdown skipped (temporary).');
  }
}

// Export singleton instance
export const translationQueueService = new TranslationQueueService(); 