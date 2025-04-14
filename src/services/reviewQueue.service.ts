import { Queue, Job, JobState } from 'bullmq';
import Redis from 'ioredis';
import logger from '../../utils/logger';
import { handleServiceError } from '../../utils/errorHandler';
import { NotFoundError } from '../../utils/errors';
import 'dotenv/config'; // Load environment variables
// Assuming ReviewOptions might be defined elsewhere, or define inline
// import { ReviewOptions } from '../review.service'; // Or relevant path

const QUEUE_NAME = 'review-jobs';

// Data structure for AI review jobs
export interface ReviewJobData {
  type: 'segment'; // Initially just segment review
  segmentId: string;
  userId: string; // User who initiated the original translation job
  // Add relevant review options if needed (e.g., specific model, template)
  // options?: Partial<ReviewOptions>; 
}

// Status interface (can reuse or adapt from translationQueue)
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

class ReviewQueueService {
  private queue: Queue<ReviewJobData>;
  private connection: Redis;
  private serviceName = 'ReviewQueueService';

  constructor() {
    // Use same connection options as translation queue for simplicity
    const connectionOptions = {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null
    };
    this.connection = new Redis(connectionOptions);
    this.connection.on('error', (err: Error) => logger.error('Redis Connection Error (Review Queue)', err));

    this.queue = new Queue<ReviewJobData>(QUEUE_NAME, {
        connection: this.connection,
        defaultJobOptions: {
            attempts: 2, // Maybe fewer retries for review?
            backoff: {
                type: 'exponential',
                delay: 10000, // Longer delay?
            },
            removeOnComplete: { count: 1000 },
            removeOnFail: { count: 5000 }
        }
    });

    logger.info(`Review queue service initialized. Connected to Redis: ${connectionOptions.host}:${connectionOptions.port}`);
  }

  // Create a unique job ID for segment review
  private getJobId(segmentId: string): string {
      return `review-segment-${segmentId}`; // Allow easy check if job exists
  }

  /**
   * Adds an AI review job for a specific segment.
   * Uses segmentId as part of the jobId to prevent duplicate review jobs for the same segment.
   */
  async addSegmentReviewJob(
    segmentId: string,
    userId: string,
    // options?: Partial<ReviewOptions> 
  ): Promise<string | null> { // Return null if job already exists
    const methodName = 'addSegmentReviewJob';
    const jobId = this.getJobId(segmentId);
    const jobData: ReviewJobData = { type: 'segment', segmentId, userId, /* options */ };
    
    try {
        // Check if a job with this ID already exists (active, waiting, delayed, completed, failed)
        const existingJob = await this.queue.getJob(jobId);
        if (existingJob) {
             const state = await existingJob.getState();
             // Optional: Add logic to retry failed jobs if needed
             // if (state === 'failed') { ... } 
             logger.warn(`[${this.serviceName}.${methodName}] Job ${jobId} for segment ${segmentId} already exists with status ${state}. Skipping add.`);
             return null; // Indicate job was not added
        }

        // Add the job with the specific ID
        await this.queue.add(jobId, jobData, { jobId });
        logger.info(`Added segment review job ${jobId} for segment ${segmentId}`);
        return jobId;
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '添加 AI 审校任务');
    }
  }

  // Add getJobStatus, cancelJob similar to TranslationQueueService if needed

  async close(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
    logger.info('Review queue service shut down.');
  }
}

// Export singleton instance
export const reviewQueueService = new ReviewQueueService();