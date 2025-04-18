import 'reflect-metadata'; // MUST be the first import

import { Worker, Job, JobProgress } from 'bullmq';
import Redis from 'ioredis';
import logger from '../utils/logger';
import 'dotenv/config'; // Load environment variables
import mongoose from 'mongoose'; // Needed for DB connection

// --- Pre-import ALL Mongoose Models to ensure registration ---
import '../models/user.model';
import '../models/project.model';
import '../models/file.model';
import '../models/segment.model';
import '../models/aiConfig.model';
import '../models/promptTemplate.model';
import '../models/terminology.model'; // Assuming this is needed
import '../models/translationMemory.model'; // Assuming this is needed
// Add any other models used directly or indirectly
// ----------------------------------------------------------

// Import services and other dependencies AFTER models
import { TranslationJobData } from '../services/translationQueue.service';
import { translationService } from '../services/translation.service';
import { segmentService } from '../services/segment.service';
import { projectService } from '../services/project.service';
// File model is pre-imported, but keep type import if needed elsewhere
import { File, FileStatus } from '../models/file.model'; 
// Segment model is pre-imported, but keep type import if needed elsewhere
import { Segment, ISegment, SegmentStatus } from '../models/segment.model';
import { reviewQueueService } from '../services/reviewQueue.service';
import { aiConfigService } from '../services/aiConfig.service';
import { AppError } from '../utils/errors';
import { TranslationOptions } from '../services/types';
// Project model is pre-imported, but we still need the type
import { Project } from '../models/project.model'; 

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
  // Log raw job data first
  logger.info(`[Worker Job ${job.id}] START Processing job. Raw Data:`, job.data); 
  
  // Explicitly type options when destructuring and provide a default value
  const { type, projectId, fileId, options = {} as TranslationOptions, userId, requesterRoles, aiConfigId, promptTemplateId } = job.data;
  
  // Explicitly log the extracted values
  logger.debug(`[Worker Job ${job.id}] Extracted - promptTemplateId: ${promptTemplateId}, aiConfigId: ${aiConfigId}`); 

  if (!aiConfigId) {
    const errMsg = `Job ${job.id} is missing required aiConfigId. Value received: ${aiConfigId}`;
    logger.error(`[Worker Job ${job.id}] Validation failed: ${errMsg}`);
    throw new AppError(errMsg, 400);
  }
  if (!promptTemplateId) {
     // Add value to error message and log before throwing
     const errMsg = `Job ${job.id} is missing required promptTemplateId. Value received: ${promptTemplateId}`; 
     logger.error(`[Worker Job ${job.id}] Validation failed: ${errMsg}`); 
     throw new AppError(errMsg, 400);
  }

  // Renamed log to avoid conflict
  logger.info(`[Worker Job ${job.id}] Processing Details - Type: ${type}, Project: ${projectId}, File: ${fileId || 'N/A'}, AI Config: ${aiConfigId}, Prompt: ${promptTemplateId}`);

  let totalSegments = 0;
  let processedSegments = 0;
  let erroredSegments = 0;
  const errors: string[] = [];
  let segmentsToTranslate: { segmentId: string, fileId: string }[] = [];
  // Define variables to hold the determined languages
  let determinedSourceLang: string | undefined;
  let determinedTargetLang: string | undefined;

  try {
    logger.debug(`[Worker Job ${job.id}] Determining segments to translate... Type: ${type}`);
    if (type === 'file') {
      if (!fileId) throw new Error('Missing fileId for file translation job');
      // Fetch the file document itself
      const fileDoc = await File.findById(fileId).exec();
      if (!fileDoc) throw new AppError(`File not found: ${fileId}`, 404);
      
      // Fetch the project document using the file's projectId
      logger.debug(`[Worker Job ${job.id}] Fetching project ${fileDoc.projectId} for language info...`);
      const projectDoc = await Project.findById(fileDoc.projectId).exec();
      if (!projectDoc) throw new AppError(`Project ${fileDoc.projectId} not found for file ${fileId}`, 404);
      
      // Extract languages from the project (assuming first language pair)
      const projectSourceLang = projectDoc.languagePairs?.[0]?.source;
      const projectTargetLang = projectDoc.languagePairs?.[0]?.target;
      if (!projectSourceLang || !projectTargetLang) {
           throw new AppError(`Project ${projectDoc._id} is missing language pair information.`, 400);
      }
      logger.debug(`[Worker Job ${job.id}] Project languages: ${projectSourceLang} -> ${projectTargetLang}`);

      // Use languages from job options first, fallback to project languages
      determinedSourceLang = (options as TranslationOptions)?.sourceLanguage || projectSourceLang;
      determinedTargetLang = (options as TranslationOptions)?.targetLanguage || projectTargetLang;
      
      // Validate languages were determined
      if (!determinedSourceLang || !determinedTargetLang) {
          // This case should ideally not happen if project languages are mandatory
          throw new AppError(`Could not determine Source/Target language for file ${fileId}.`, 400);
      }
      
      const result = await segmentService.getSegmentsByFileId(fileId);
      totalSegments = result.total;
      result.segments.forEach((s: ISegment) => {
          // Base condition: always include PENDING and ERROR
          let shouldTranslate = s.status === SegmentStatus.PENDING || s.status === SegmentStatus.ERROR;
          // Optionally include TRANSLATED_TM based on the job option
          if (options?.retranslateTM === true && s.status === SegmentStatus.TRANSLATED_TM) {
              shouldTranslate = true;
          }
          if (shouldTranslate) {
              segmentsToTranslate.push({ segmentId: s._id.toString(), fileId });
          }
      });
      logger.info(`[Worker Job ${job.id}] File Job: Determined ${segmentsToTranslate.length} segments to translate.`);
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
              // Base condition: always include PENDING and ERROR
              let shouldTranslate = s.status === SegmentStatus.PENDING || s.status === SegmentStatus.ERROR;
              // Optionally include TRANSLATED_TM based on the job option
              if (options?.retranslateTM === true && s.status === SegmentStatus.TRANSLATED_TM) {
                  shouldTranslate = true;
              }
              if (shouldTranslate) {
                  segmentsToTranslate.push({ segmentId: s._id.toString(), fileId: file._id.toString() });
              }
          });
      }
      totalSegments = projectSegmentCount;
      logger.info(`[Worker Job ${job.id}] Project Job: Determined ${segmentsToTranslate.length} segments to translate.`);
      
      // Fetch the project document directly for project jobs
      logger.debug(`[Worker Job ${job.id}] Fetching project ${projectId} for language info...`);
      const projectDoc = await Project.findById(projectId).exec();
      if (!projectDoc) throw new AppError(`Project not found: ${projectId}`, 404);
      
      // Extract languages from the project (assuming first language pair)
      const projectSourceLang = projectDoc.languagePairs?.[0]?.source;
      const projectTargetLang = projectDoc.languagePairs?.[0]?.target;
      if (!projectSourceLang || !projectTargetLang) {
           throw new AppError(`Project ${projectDoc._id} is missing language pair information.`, 400);
      }
      logger.debug(`[Worker Job ${job.id}] Project languages: ${projectSourceLang} -> ${projectTargetLang}`);
      
      // Use languages from job options first, fallback to project languages
      determinedSourceLang = (options as TranslationOptions)?.sourceLanguage || projectSourceLang;
      determinedTargetLang = (options as TranslationOptions)?.targetLanguage || projectTargetLang;
      
      // Remove the previous fallback logic using firstFileWithLangs
      /*
      const firstFileWithLangs = files.find(f => f.metadata?.sourceLanguage && f.metadata?.targetLanguage);
      determinedSourceLang = (options as TranslationOptions)?.sourceLanguage || firstFileWithLangs?.metadata?.sourceLanguage;
      determinedTargetLang = (options as TranslationOptions)?.targetLanguage || firstFileWithLangs?.metadata?.targetLanguage;
      */
      
      // Validate languages were determined
      if (!determinedSourceLang || !determinedTargetLang) {
          // This case should ideally not happen if project languages are mandatory
          throw new AppError(`Could not determine Source/Target language for project ${projectId}.`, 400);
      }
    }

    logger.debug(`[Worker Job ${job.id}] Determined Languages: ${determinedSourceLang} -> ${determinedTargetLang}`);

    // Process segments
    logger.info(`[Worker Job ${job.id}] Starting segment processing loop for ${segmentsToTranslate.length} segments.`);
    for (const { segmentId, fileId: currentFileId } of segmentsToTranslate) {
        let updatedSegment: ISegment | null = null; // Variable to hold result
        logger.debug(`[Worker Job ${job.id}] Processing segment ${segmentId} in file ${currentFileId}...`);
        try {
            // Ensure options passed to translateSegment include the determined languages
            const finalOptions: TranslationOptions = {
                ...options,
                sourceLanguage: determinedSourceLang!,
                targetLanguage: determinedTargetLang!,
            };
            
            logger.debug(`[Worker Job ${job.id}] Calling translationService.translateSegment for segment ${segmentId}...`);
            updatedSegment = await translationService.translateSegment(
                segmentId, userId, requesterRoles, aiConfigId, promptTemplateId, finalOptions
            );
            processedSegments++;
            logger.debug(`[Worker Job ${job.id}] Successfully processed segment ${segmentId}. Status: ${updatedSegment?.status}`);
        } catch (error: any) {
            logger.error(`[Worker Job ${job.id}] Error processing segment ${segmentId}: ${error.message}`, { error });
            erroredSegments++;
            errors.push(`Segment ${segmentId}: ${String(error?.message ?? 'Unknown segment error')}`);
            updatedSegment = null;
        }

        // --- Trigger AI Review (Keep this logic inside the loop) ---
        if (updatedSegment && updatedSegment.status === SegmentStatus.TRANSLATED) {
            logger.debug(`[Worker Job ${job.id}] Segment ${segmentId} translated by AI, attempting to queue for review...`);
            try {
                // Restore adding job to review queue
                const reviewJobId = await reviewQueueService.addSegmentReviewJob(
                    segmentId, 
                    userId, 
                    requesterRoles // Pass roles here
                );
                if (reviewJobId) {
                     logger.info(`[Worker Job ${job.id}] Added segment ${segmentId} to AI review queue (Job ID: ${reviewJobId}).`);
                }
            } catch (queueError: any) {
                logger.error(`[Worker Job ${job.id}] Failed to add segment ${segmentId} to AI review queue: ${queueError.message}`, queueError);
                // Do not fail the translation job if queuing review fails
            }
        } else if (updatedSegment && updatedSegment.status === SegmentStatus.TRANSLATED_TM) {
             logger.info(`Job ${job.id}: Segment ${segmentId} was translated by TM, skipping AI review trigger.`);
        } else {
             logger.warn(`Job ${job.id}: Segment ${segmentId} not queued for review (Status: ${updatedSegment?.status || 'Update Failed'}).`);
        }
        // ---------------------------------------------------

        // --- Update BullMQ progress (Keep inside loop) ---
        const progress = totalSegments > 0 ? Math.round(((processedSegments + erroredSegments) / totalSegments) * 100) : 100;
        logger.debug(`[Worker Job ${job.id}] Updating BullMQ progress: ${progress}% (${processedSegments + erroredSegments}/${totalSegments})`);
        await job.updateProgress(progress);
        // -----------------------------------------------
    } // <--- End of for...of loop

    // Use logger.info for final job outcome
    logger.info(`[Worker Job ${job.id}] FINISHED Segment Loop. Processed: ${processedSegments}, Errors: ${erroredSegments}, Total Segments in Job: ${totalSegments}`);

    // --- Final File Progress Update (Call ONCE after loop) ---
    const finalFileId = fileId; // Use fileId from the job data (works for 'file' type)
    if (finalFileId && type === 'file') { 
        try {
            logger.info(`[Worker Job ${job.id}] Calling final projectService.updateFileProgress for file ${finalFileId}...`);
            await projectService.updateFileProgress(finalFileId, userId); 
            logger.info(`[Worker Job ${job.id}] Finished final projectService.updateFileProgress for file ${finalFileId}.`);
        } catch (updateError: any) { 
            // Log AND re-throw the error to fail the job if final update fails
            logger.error(`[Worker Job ${job.id}] CRITICAL: Error calling final updateFileProgress for file ${finalFileId}: ${updateError.message}`, updateError);
            throw updateError; // Re-throw the error
        } 
    } else if (type === 'project') {
        // TODO: Implement final status update logic for project jobs
        logger.warn(`[Worker Job ${job.id}] Final status update for project-level jobs not fully implemented.`);
    }
    // --- End Final File Progress Update ---

    if (erroredSegments > 0) {
      // Throw an error to mark the job as failed, providing details
      const failureMsg = `${erroredSegments} segment(s) failed to translate. Errors: ${errors.join('; ')}`;
      logger.error(`[Worker Job ${job.id}] Failing job due to segment errors: ${failureMsg}`);
      // --- REMOVE TEMPORARY DIAGNOSTIC ---
      // throw new Error('HARDCODED_JOB_FAILURE_DUE_TO_SEGMENT_ERRORS');
      // --- END TEMPORARY DIAGNOSTIC ---
      throw new Error(failureMsg); // Throw the actual error message
    }

    logger.info(`[Worker Job ${job.id}] COMPLETED Successfully.`);
    return { processedCount: processedSegments, totalCount: totalSegments };

  } catch (error: any) {
      // Log catastrophic errors
      logger.error(`[Worker Job ${job.id}] FAILED Catastrophically: ${error.message}`, { error }); // Log full error object
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