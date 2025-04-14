import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import logger from '../utils/logger';
import { ReviewJobData } from '../services/reviewQueue.service'; // Correct path
import { reviewService } from '../services/review.service'; // Correct path
import 'dotenv/config';
import mongoose from 'mongoose';

const QUEUE_NAME = 'review-jobs'; // Listen to the correct queue

const connectionOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null
};

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/translationPlatform';

// --- Main Job Processing Function ---

// This function processes a single review job
async function processReviewJob(job: Job<ReviewJobData>): Promise<any> {
  const { type, segmentId, userId /*, options */ } = job.data; // Extract data
  const jobId = job.id || `review-segment-${segmentId}`; // Use job ID if available
  logger.info(`Processing ${type} review job ${jobId} for segment ${segmentId}, initiated by user ${userId}`);

  try {
      // Call the appropriate method from ReviewService to perform the AI review
      // We assume startAIReview handles finding the segment, calling the AI, and updating the segment
      // Pass necessary options if the job data includes them
      const resultSegment = await reviewService.startAIReview(
          segmentId, 
          userId, // Pass the user who initiated the original translation
          { /* Pass any review options from job.data.options if implemented */ } 
      );

      logger.info(`Job ${jobId}: AI Review processed successfully for segment ${segmentId}. Final status: ${resultSegment.status}`);
      
      // Return relevant result, e.g., the final status or identified issues count
      return { 
          success: true, 
          status: resultSegment.status, 
          issuesFound: resultSegment.issues?.length || 0 
      };

  } catch (error: any) {
      logger.error(`Job ${jobId} (Segment ${segmentId}) failed during AI Review processing: ${error.message}`, error);
      // Rethrow the error so BullMQ marks the job as failed
      // The ReviewService itself should handle marking the segment status as ERROR
      throw error; 
  }
}

// --- Worker Setup ---

async function setupWorker() {
  // Ensure DB connection before starting worker
  try {
    await mongoose.connect(mongoUri);
    logger.info('MongoDB connected successfully for Review Worker.');
  } catch (err) {
    logger.error('MongoDB connection error for Review Worker:', err);
    process.exit(1); // Exit if DB connection fails
  }

  const worker = new Worker<ReviewJobData>(QUEUE_NAME, processReviewJob, {
    connection: connectionOptions,
    concurrency: parseInt(process.env.REVIEW_WORKER_CONCURRENCY || '3', 10), // Maybe lower concurrency for review?
    limiter: { // Optional: Rate limiting (potentially different from translation)
      max: parseInt(process.env.REVIEW_WORKER_RATE_MAX || '5', 10), 
      duration: parseInt(process.env.REVIEW_WORKER_RATE_DURATION || '1000', 10) 
    }
  });

  worker.on('completed', (job: Job, result: any) => {
    logger.info(`Review Job ${job.id} completed successfully. Result:`, result);
  });

  worker.on('failed', (job: Job | undefined, error: Error) => {
    if (job) {
      logger.error(`Review Job ${job.id} failed. Error: ${error.message}`, { jobId: job.id, data: job.data, error });
    } else {
      logger.error(`A review job failed, but job details are unavailable. Error: ${error.message}`, error);
    }
  });

  worker.on('error', (error: Error) => {
    logger.error(`Review Worker encountered an error: ${error.message}`, error);
  });

  // No progress reporting needed for this simple worker unless startAIReview provides it

  logger.info('AI Review worker started...');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down review worker gracefully...');
    await worker.close();
    await mongoose.disconnect();
    logger.info('Review Worker and DB connection closed.');
    process.exit(0);
  });
}

setupWorker();