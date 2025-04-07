import Queue from 'bull';
import { 
  TranslationJob, 
  TranslationJobStatus,
  TranslationJobType,
  ITranslationQueue,
  TranslationOptions,
  TranslationResult
} from './types';
import { AIProviderManager } from './ai-provider.manager';
import logger from '../utils/logger';

export class TranslationQueue implements ITranslationQueue {
  private queue: Queue.Queue;
  private aiProvider: AIProviderManager;

  constructor() {
    this.queue = new Queue('translation', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      }
    });
    this.aiProvider = new AIProviderManager();
  }

  async addJob(job: TranslationJob): Promise<void> {
    await this.queue.add(job);
    logger.info(`Added translation job ${job.id} to queue`);
  }

  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    completedCount: number;
    totalCount: number;
    error?: string;
  }> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    return {
      status: job.data.status,
      progress: job.progress() || 0,
      completedCount: job.returnvalue?.completedCount || 0,
      totalCount: job.returnvalue?.totalCount || 0,
      error: job.failedReason
    };
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    await job.remove();
    logger.info(`Cancelled translation job ${jobId}`);
  }

  async addSegmentTranslationJob(
    projectId: string,
    fileId: string,
    segmentId: string,
    options: TranslationOptions
  ): Promise<string> {
    const job: TranslationJob = {
      id: segmentId,
      type: 'file',
      projectId,
      fileId,
      options,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await this.addJob(job);
    return job.id;
  }

  async addFileTranslationJob(
    projectId: string,
    fileId: string,
    options: TranslationOptions
  ): Promise<string> {
    const job: TranslationJob = {
      id: fileId,
      type: 'file',
      projectId,
      fileId,
      options,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await this.addJob(job);
    return job.id;
  }

  async addProjectTranslationJob(
    projectId: string,
    options: TranslationOptions
  ): Promise<string> {
    const job: TranslationJob = {
      id: projectId,
      type: 'project',
      projectId,
      options,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await this.addJob(job);
    return job.id;
  }

  async getFileStatus(fileId: string): Promise<{
    status: TranslationJobStatus;
    progress: number;
    completedCount: number;
    totalCount: number;
    error?: string;
  }> {
    const fileJob = await this.queue.getJob(fileId);
    if (!fileJob) {
      throw new Error(`File job ${fileId} not found`);
    }
    return {
      status: fileJob.data.status,
      progress: fileJob.progress() || 0,
      completedCount: fileJob.returnvalue?.completedCount || 0,
      totalCount: fileJob.returnvalue?.totalCount || 0,
      error: fileJob.failedReason
    };
  }

  private async processTranslationJob(job: TranslationJob): Promise<TranslationResult> {
    // Implementation of job processing
    throw new Error('Not implemented');
  }
} 