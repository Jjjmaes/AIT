import { Worker, Job, JobProgress } from 'bullmq';
import Redis from 'ioredis';
import logger from '../utils/logger';
import { TranslationJobData } from '../services/translationQueue.service';
import { translationService } from '../services/translation.service';
import { segmentService } from '../services/segment.service';
import { projectService } from '../services/project.service';
import { File, FileStatus } from '../models/file.model';
import { Segment, ISegment, SegmentStatus } from '../models/segment.model';
import { reviewQueueService } from '../services/reviewQueue.service';
import 'dotenv/config'; // Load environment variables
import mongoose from 'mongoose'; // Needed for DB connection
import { aiConfigService } from '../services/aiConfig.service';
import { AppError } from '../utils/errors';

const QUEUE_NAME = 'translation-jobs';

const connectionOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null
};

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/translationPlatform';

// --- Main Job Processing Function ---\n

async function processJob(job: Job<TranslationJobData>): Promise<any> {
  const { type, projectId, fileId, options, userId, requesterRoles } = job.data;
  logger.info(`Processing ${type} translation job ${job.id} for project ${projectId}${fileId ? `, file ${fileId}` : ''}`);

  let totalSegments = 0;
  let processedSegments = 0;
  let erroredSegments = 0;
  const errors: string[] = [];
  let segmentsToTranslate: { segmentId: string, fileId: string }[] = [];

  try {
    if (type === 'file') {
      if (!fileId) throw new Error('Missing fileId for file translation job');
      const result = await segmentService.getSegmentsByFileId(fileId);
      totalSegments = result.total;
      result.segments.forEach((s: ISegment) => {
          if (s.status === SegmentStatus.PENDING || s.status === SegmentStatus.ERROR) {
              segmentsToTranslate.push({ segmentId: s._id.toString(), fileId });
          }
      });
      logger.info(`Job ${job.id}: Found ${totalSegments} segments for file ${fileId}, ${segmentsToTranslate.length} need translation.`);
    } else if (type === 'project') {
      const files = await File.find({ projectId: new mongoose.Types.ObjectId(projectId) }).exec();
      if (!files || files.length === 0) {
          logger.warn(`Job ${job.id}: No files found for project ${projectId}. Nothing to translate.`);
          return { message: 'No files found in project' };
      }
      logger.info(`Job ${job.id}: Found ${files.length} files for project ${projectId}. Fetching segments...`);
      
      let projectSegmentCount = 0;
      for (const file of files) {
          const result = await segmentService.getSegmentsByFileId(file._id.toString());
          projectSegmentCount += result.total;
          result.segments.forEach((s: ISegment) => {
              if (s.status === SegmentStatus.PENDING || s.status === SegmentStatus.ERROR) {
                  segmentsToTranslate.push({ segmentId: s._id.toString(), fileId: file._id.toString() });
              }
          });
      }
      totalSegments = projectSegmentCount;
      logger.info(`Job ${job.id}: Found ${totalSegments} total segments for project ${projectId}, ${segmentsToTranslate.length} need translation.`);
    }

    // Process segments
    for (const { segmentId, fileId: currentFileId } of segmentsToTranslate) {
        let updatedSegment: ISegment | null = null; // Variable to hold result
        try {
            // Pass requesterRoles to translateSegment call in the correct order
            updatedSegment = await translationService.translateSegment(segmentId, userId, requesterRoles, options);
            processedSegments++;
        } catch (error: any) {
            logger.error(`Job ${job.id}: Failed to translate segment ${segmentId} in file ${currentFileId}: ${error.message}`);
            erroredSegments++;
            errors.push(`Segment ${segmentId}: ${error.message}`);
            // Segment status should be updated within translateSegment's catch block
            updatedSegment = null; // Ensure segment is null on error
        }

        // --- Trigger AI Review if Translation Succeeded --- 
        if (updatedSegment && updatedSegment.status === SegmentStatus.TRANSLATED) {
            try {
                // Restore adding job to review queue
                const reviewJobId = await reviewQueueService.addSegmentReviewJob(
                    segmentId, 
                    userId, 
                    requesterRoles // Pass roles here
                );
                if (reviewJobId) {
                     logger.info(`Job ${job.id}: Added segment ${segmentId} to AI review queue (Job ID: ${reviewJobId}).`);
                }
            } catch (queueError: any) {
                logger.error(`Job ${job.id}: Failed to add segment ${segmentId} to AI review queue: ${queueError.message}`, queueError);
                // Do not fail the translation job if queuing review fails
            }
        } else if (updatedSegment && updatedSegment.status === SegmentStatus.TRANSLATED_TM) {
            logger.info(`Job ${job.id}: Segment ${segmentId} was translated by TM, skipping AI review trigger.`);
            // Decide if TM translated segments should also go to review queue?
            // Maybe add an option? For now, skipping.
        } else {
             // Log if segment update failed or status wasn't TRANSLATED
             logger.warn(`Job ${job.id}: Segment ${segmentId} not queued for review (Status: ${updatedSegment?.status || 'Update Failed'}).`);
        }
        // ---------------------------------------------------

        // Update progress (percentage)
        const progress = totalSegments > 0 ? Math.round(((processedSegments + erroredSegments) / totalSegments) * 100) : 100;
        await job.updateProgress(progress);
    }

    logger.info(`Job ${job.id} finished. Processed: ${processedSegments}, Errors: ${erroredSegments}, Total: ${totalSegments}`);

    if (erroredSegments > 0) {
      // Throw an error to mark the job as failed, providing details
      throw new Error(`${erroredSegments} segment(s) failed to translate. Errors: ${errors.join('; ')}`);
    }

    return { processedCount: processedSegments, totalCount: totalSegments };

  } catch (error: any) {
      logger.error(`Job ${job.id} failed catastrophically: ${error.message}`, error);
      // Rethrow the error so BullMQ marks the job as failed
      throw error; 
  }
}

// --- Worker Setup ---\n

async function setupWorker() {
  // Ensure DB connection before starting worker
  try {
    await mongoose.connect(mongoUri);
    logger.info('MongoDB connected successfully for worker.');
  } catch (err) {
    logger.error('MongoDB connection error for worker:', err);
    process.exit(1); // Exit if DB connection fails
  }

  const worker = new Worker<TranslationJobData>(QUEUE_NAME, processJob, {
    connection: connectionOptions,
    concurrency: parseInt(process.env.TRANSLATION_WORKER_CONCURRENCY || '5', 10), // Number of jobs to process concurrently
    limiter: { // Optional: Rate limiting
      max: parseInt(process.env.TRANSLATION_WORKER_RATE_MAX || '10', 10), // Max 10 jobs
      duration: parseInt(process.env.TRANSLATION_WORKER_RATE_DURATION || '1000', 10) // per 1000 ms (1 second)
    }
  });

  worker.on('completed', (job: Job, result: any) => {
    logger.info(`Job ${job.id} completed successfully. Result:`, result);
  });

  worker.on('failed', (job: Job | undefined, error: Error) => {
    // Job might be undefined if connection is lost
    if (job) {
      logger.error(`Job ${job.id} failed. Error: ${error.message}`, { jobId: job.id, data: job.data, error });
    } else {
      logger.error(`A job failed, but job details are unavailable. Error: ${error.message}`, error);
    }
  });

  worker.on('error', (error: Error) => {
    logger.error(`Worker encountered an error: ${error.message}`, error);
  });

  worker.on('progress', (job: Job, progress: JobProgress) => {
    if (typeof progress === 'number') {
      logger.debug(`Job ${job.id} progress: ${progress}%`);
    } else {
      logger.debug(`Job ${job.id} progress updated:`, progress);
    }
  });

  logger.info('Translation worker started...');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down worker gracefully...');
    await worker.close();
    await mongoose.disconnect();
    logger.info('Worker and DB connection closed.');
    process.exit(0);
  });
}

// Restore worker setup
setupWorker(); 