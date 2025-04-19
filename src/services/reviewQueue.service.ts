import { Queue, Job, JobState } from 'bullmq';
import Redis from 'ioredis';
import logger from '../utils/logger';
import { handleServiceError } from '../utils/errorHandler';
import { AppError } from '../utils/errors';
import 'dotenv/config'; // Load environment variables
// Remove TypeDI imports if no longer needed for this file
// import { Inject, Service } from 'typedi';
// import { WinstonLoggerToken } from '../config/logger.config'; // Removed incorrect import

const QUEUE_NAME = 'review-jobs';

// Job data structure - Now for FILE or PROJECT review
export interface ReviewJobData {
  type: 'file' | 'project'; // Type of review job
  userId: string; // User who initiated the review
  requesterRoles: string[]; // Roles of the user who initiated
  projectId: string; // Always include project ID
  fileId?: string; // Include file ID if type is 'file'
  // Options passed from frontend/API
  options: {
    aiConfigId: string;
    reviewPromptTemplateId: string;
    // Add other relevant review options here, e.g., force re-review?
  };
}

// Define possible job states if needed (BullMQ uses standard ones)
// export type ReviewJobStatus = JobState | 'custom_state'; 

export interface JobStatus {
    jobId: string;
    status: JobState | 'unknown'; // Use BullMQ's JobState
    progress: number;
    failedReason?: string;
    returnValue?: any;
}

// Remove @Service() decorator if not using TypeDI injection here
class ReviewQueueService {
  private queue: Queue<ReviewJobData>;
  private connection: Redis;
  private readonly serviceName = 'ReviewQueueService';

  // Revert constructor to not inject logger
  constructor() {
    const connectionOptions = {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null
    };

    this.connection = new Redis(connectionOptions);
    this.connection.on('error', (err: Error) => logger.error('Redis Connection Error (Review Queue)', err)); // Use imported logger

    this.queue = new Queue<ReviewJobData>(QUEUE_NAME, {
        connection: this.connection,
        defaultJobOptions: {
            attempts: 2,
            backoff: {
                type: 'exponential',
                delay: 10000,
            },
            removeOnComplete: { count: 1000 },
            removeOnFail: { count: 5000 }
        }
    });
    logger.info(`Review queue service initialized. Connected to Redis: ${connectionOptions.host}:${connectionOptions.port}`); // Use imported logger
  }

  // Create a unique job ID for segment review
  private getJobId(segmentId: string): string {
      return `review-segment-${segmentId}`; // Allow easy check if job exists
  }

  /**
   * Adds an AI review job for an entire file.
   * The worker will handle fetching and batching segments.
   */
  async addFileReviewJob(
    jobDetails: Omit<ReviewJobData, 'type'> & { type: 'file', fileId: string } // Enforce file type
  ): Promise<Job<ReviewJobData>> {
    const methodName = 'addFileReviewJob';
    if (!this.queue) {
      // This check might be redundant if constructor ensures queue is initialized
      logger.error(`[${this.serviceName}.${methodName}] Attempted to add job but queue is not initialized.`); // Use imported logger
      throw new AppError('Review queue is not initialized.', 500);
    }
    const { fileId, projectId } = jobDetails;
    // Use a job ID related to the file review request
    const jobId = `file-review-${fileId}-${Date.now()}`;

    try {
      const job = await this.queue.add(jobId, jobDetails, { jobId });
      logger.info(`[${this.serviceName}.${methodName}] Queued AI review job ${jobId} for file ${fileId} in project ${projectId}`); // Use imported logger
      return job;
    } catch (error) {
      logger.error(`[${this.serviceName}.${methodName}] Error queuing review job for file ${fileId}:`, error); // Use imported logger
      throw handleServiceError(error, this.serviceName, methodName, '添加文件审校任务');
    }
  }

  // Add getJobStatus, cancelJob similar to TranslationQueueService if needed

  async close(): Promise<void> {
    try {
        await this.queue?.close();
        await this.connection?.quit();
        logger.info('Review queue service shutdown complete.'); // Use imported logger
    } catch (error) {
        logger.error('Error closing review queue service:', error); // Use imported logger
    }
  }
}

// Export the class itself, but also create a singleton instance for direct use
// This matches the pattern likely used elsewhere (e.g., logger)
const reviewQueueService = new ReviewQueueService();
export { ReviewQueueService, reviewQueueService };