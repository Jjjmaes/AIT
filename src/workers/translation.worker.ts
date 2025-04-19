import 'reflect-metadata'; // MUST be the first import

import { Worker, Job, JobProgress } from 'bullmq';
import Redis from 'ioredis';
import logger from '../utils/logger';
import 'dotenv/config'; // Load environment variables
import mongoose from 'mongoose'; // Needed for DB connection
import { Types } from 'mongoose';
import { Container } from 'typedi'; // Import TypeDI Container
import { TiktokenModel } from 'tiktoken'; // Import TiktokenModel type

// --- Pre-import ALL Mongoose Models to ensure registration ---
import '../models/user.model';
import '../models/project.model';
import '../models/file.model';
import '../models/segment.model';
import '../models/aiConfig.model';
import '../models/promptTemplate.model';
import '../models/terminology.model';
import '../models/translationMemory.model';
// ----------------------------------------------------------

// --- Import Services, Types, and Utilities ---
import { TranslationJobData } from '../services/translationQueue.service';
import { File, IFile, FileStatus } from '../models/file.model';
import { Segment, ISegment, SegmentStatus } from '../models/segment.model';
import { TranslationService } from '../services/translation.service';
import { IAIProviderConfig } from '../models/aiConfig.model';
import { ITermEntry } from '../models/terminology.model';
import { SegmentService } from '../services/segment.service';
import { ProjectService } from '../services/project.service';
import { AIConfigService } from '../services/aiConfig.service';
import { PromptBuildContext } from '../utils/promptProcessor';
import { TranslationMemoryService } from '../services/translationMemory.service';
import { AIServiceFactory } from '../services/translation/ai-adapters/ai-service.factory';
import { AIProvider } from '../services/ai-provider.manager';
import { PromptProcessor } from '../utils/promptProcessor';
import { TerminologyService } from '../services/terminology.service';
import { AIReviewService } from '../services/ai-review.service'; // <-- Restored
import {
    tokenCount,
    splitSegmentsByTokenLimit,
    buildSegmentedUserPrompt,
    parseTranslatedSegments,
    BatchSegment,
    ParsedTranslationMap
} from '../utils/batchUtils';
import { ChatCompletionResponse } from '../services/translation/ai-adapters/base.adapter'; // For AI response type
import { AppError } from '../utils/errors';
import { TranslationOptions } from '../types/translation.types';
import { IProject, Project } from '../models/project.model';

// --- Constants ---
const QUEUE_NAME = 'translation-jobs';
const DEFAULT_MAX_INPUT_TOKENS = 16000; // Default based on GPT-4o, make configurable?
const DEFAULT_TOKENIZER_MODEL: TiktokenModel = 'gpt-4'; // Default tokenizer

const connectionOptions = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null
};

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/translationPlatform';

// --- Main Job Processing Function (Refactored for Batching) ---

async function processJob(job: Job<TranslationJobData>): Promise<any> {
    const jobId = job.id;
    logger.info(`[Worker Job ${jobId}] START Processing job. Raw Data:`, job.data);

    // --- Dependency Injection ---
    const translationService: TranslationService = Container.get(TranslationService);
    const tmService: TranslationMemoryService = Container.get(TranslationMemoryService);
    const termService: TerminologyService = Container.get(TerminologyService);
    const projectService: ProjectService = Container.get(ProjectService);
    const segmentService: SegmentService = Container.get(SegmentService);
    const aiConfigService: AIConfigService = Container.get(AIConfigService);
    const promptProcessor: PromptProcessor = Container.get(PromptProcessor);
    const aiServiceFactory: AIServiceFactory = Container.get(AIServiceFactory);
    // AIReviewService is not directly used in processJob, so no Container.get call to comment here

    // --- Extract Job Data ---
    const {
        type,
        projectId,
        fileId,
        options = {} as TranslationOptions,
        userId,
        requesterRoles = [],
        aiConfigId,
        promptTemplateId
    } = job.data;

    // --- Validation ---
    if (!userId) throw new AppError(`Job ${jobId} is missing required userId.`, 400);
    if (!aiConfigId) throw new AppError(`Job ${jobId} is missing required aiConfigId.`, 400);
    if (!promptTemplateId) throw new AppError(`Job ${jobId} is missing required promptTemplateId.`, 400);
    logger.info(`[Worker Job ${jobId}] Processing Details - Type: ${type}, Project: ${projectId}, File: ${fileId || 'N/A'}, AI Config: ${aiConfigId}, Prompt: ${promptTemplateId}`);

    // --- Global Variables for Job ---
    let totalSegmentsProcessedByAI = 0;
    let totalSegmentsProcessedByTM = 0;
    let totalSegmentsErrored = 0;
    const errors: string[] = [];
    let allSegmentsInScope: BatchSegment[] = []; // All segments initially considered
    let segmentsForBatching: BatchSegment[] = []; // Segments after TM filtering
    let projectDoc: IProject | null = null;
    let determinedSourceLang: string | undefined;
    let determinedTargetLang: string | undefined;
    let termEntries: ITermEntry[] = [];
    let baseSystemPrompt: string | null = null;
    const maxInputTokens = DEFAULT_MAX_INPUT_TOKENS; // Using default, no options.maxTokens
    const tokenizerModel = DEFAULT_TOKENIZER_MODEL;

    try {
        // --- Determine Language and Project Scope ---
        if (type === 'file') {
            if (!fileId) throw new AppError('Missing fileId for file translation job', 400);
            const fileDoc = await File.findById(fileId).populate('projectId').exec();
            if (!fileDoc) throw new AppError(`File not found: ${fileId}`, 404);

            // Improved type guard for populated project
            const populatedProject = fileDoc.projectId;
             if (!populatedProject || typeof populatedProject === 'string' ||
                 !('name' in populatedProject) || !('owner' in populatedProject) || !('languagePairs' in populatedProject)) {
                  throw new AppError(`Project data not properly populated for file ${fileId}`, 500);
             }
             projectDoc = populatedProject as unknown as IProject;
            if (!projectDoc) throw new AppError(`Project not found for file ${fileId}`, 404);

            determinedSourceLang = options?.sourceLanguage || projectDoc.languagePairs?.[0]?.source;
            determinedTargetLang = options?.targetLanguage || projectDoc.languagePairs?.[0]?.target;

            // Query segments for this file
            // Replace ERROR with REVIEW_FAILED
            const queryStatuses = [SegmentStatus.PENDING, SegmentStatus.REVIEW_FAILED, SegmentStatus.TRANSLATION_FAILED];
            if (options?.retranslateTM) queryStatuses.push(SegmentStatus.TRANSLATED_TM);
            // Add other retranslate statuses if options exist (e.g., based on options.retranslateAI, etc.)

            allSegmentsInScope = await Segment.find({
                fileId: fileDoc._id,
                status: { $in: queryStatuses }
            }).sort({ index: 1 }).select({ index: 1, sourceText: 1, _id: 1, fileId: 1 }).lean();

        } else if (type === 'project') {
            if (!projectId) throw new AppError('Missing projectId for project translation job', 400);
            projectDoc = await Project.findById(projectId).exec();
            if (!projectDoc) throw new AppError(`Project not found: ${projectId}`, 404);

            determinedSourceLang = options?.sourceLanguage || projectDoc.languagePairs?.[0]?.source;
            determinedTargetLang = options?.targetLanguage || projectDoc.languagePairs?.[0]?.target;

            const filesInProject = await File.find({ projectId: projectDoc._id }).select('_id').lean();
            if (!filesInProject || filesInProject.length === 0) {
                logger.warn(`Job ${jobId}: No files found for project ${projectId}. Nothing to translate.`);
                await job.updateProgress(100);
                return { message: 'No files found in project' };
            }

            // Replace ERROR with REVIEW_FAILED
            const queryStatuses = [SegmentStatus.PENDING, SegmentStatus.REVIEW_FAILED, SegmentStatus.TRANSLATION_FAILED];
            if (options?.retranslateTM) queryStatuses.push(SegmentStatus.TRANSLATED_TM);
            // Add other retranslate statuses if options exist

            allSegmentsInScope = await Segment.find({
                fileId: { $in: filesInProject.map(f => f._id) },
                status: { $in: queryStatuses } // Added missing status query
            }).sort({ fileId: 1, index: 1 }).select({ index: 1, sourceText: 1, _id: 1, fileId: 1 }).lean();

        } else {
            throw new AppError(`Unsupported job type: ${type}`, 400);
        }

        // --- Validate Languages ---
        if (!determinedSourceLang || !determinedTargetLang) {
            throw new AppError(`Could not determine Source/Target language for job ${jobId} (Project: ${projectDoc?._id}).`, 400);
        }
        logger.debug(`[Worker Job ${jobId}] Determined Languages: ${determinedSourceLang} -> ${determinedTargetLang}`);

        // --- Handle No Segments Found ---
        const totalSegmentsToConsider = allSegmentsInScope.length; // Use correct variable name
        if (totalSegmentsToConsider === 0) {
            logger.info(`[Worker Job ${jobId}] No segments require translation based on criteria.`);
            await job.updateProgress(100);
            if (type === 'file' && fileId) await translationService.translateFileSegments(fileId!); // Add non-null assertion
            // TODO: Add logic to update status for all files in a project?
            return { message: 'No segments required translation based on criteria.' };
        }
        logger.info(`[Worker Job ${jobId}] Found ${totalSegmentsToConsider} segments potentially needing translation.`); // Use correct variable name

        // --- Fetch Terminology (once for the job) ---
        if (projectDoc.terminology) {
            try {
                const terminologyList = await termService.getTerminologyById(projectDoc.terminology.toString());
                if (terminologyList?.terms) {
                    termEntries = terminologyList.terms;
                    logger.info(`[Worker Job ${jobId}] Fetched ${termEntries.length} terms for project ${projectDoc._id}.`);
                }
            } catch (error: any) {
                logger.error(`[Worker Job ${jobId}] Failed to fetch terminology: ${error.message}. Proceeding without terms.`, { error });
            }
        }

        // --- Build Base System Prompt (once for the job) ---
        const promptContext: PromptBuildContext = {
            promptTemplateId: promptTemplateId,
            sourceLanguage: determinedSourceLang,
            targetLanguage: determinedTargetLang,
            domain: options?.domain || projectDoc.domain,
            terms: termEntries
        };
        try {
             baseSystemPrompt = await promptProcessor.buildBaseSystemPrompt(promptContext);
             logger.debug(`[Worker Job ${jobId}] Base system prompt generated (length: ${baseSystemPrompt?.length ?? 0}).`);
        } catch (promptError: any) {
             logger.error(`[Worker Job ${jobId}] Failed to build base system prompt: ${promptError.message}. Proceeding without specific system prompt.`, promptError);
             errors.push(`Failed to build system prompt: ${promptError.message}`);
             baseSystemPrompt = null; // Fallback
        }


        // --- Filter Segments using Translation Memory (TM) ---
        segmentsForBatching = [];
        let processedCountForProgress = 0;

        logger.info(`[Worker Job ${jobId}] Starting TM check for ${totalSegmentsToConsider} segments...`);
        for (const segment of allSegmentsInScope) {
            try {
                // Add non-null assertions as languages/project are validated
                // --- FIX: Clean source text before TM lookup ---
                const cleanedSourceTextForTM = segment.sourceText.replace(/<[^>]*>/g, '');
                logger.debug(`[Worker Job ${jobId}] Cleaned TM lookup text for index ${segment.index}: "${cleanedSourceTextForTM.substring(0, 100)}..."`); // Log cleaned text
                // ---------------------------------------------
                const tmMatches = await tmService.findMatches(
                    cleanedSourceTextForTM, // Use cleaned text
                    determinedSourceLang!,
                    determinedTargetLang!,
                    projectDoc!._id.toString()
                );
                const exactMatch = tmMatches.find(match => match.score === 100);

                if (exactMatch && !options?.retranslateTM) { // Skip if TM found AND not forced retranslation
                    totalSegmentsProcessedByTM++;
                    // Update segment status directly
                    await segmentService.updateSegment(segment._id.toString(), {
                        translation: exactMatch.entry.targetText,
                        status: SegmentStatus.TRANSLATED_TM,
                        translatedLength: exactMatch.entry.targetText.length,
                        // Store translation info in metadata field
                        metadata: { translationInfo: { aiModel: 'TM_100%', tokenCount: 0, processingTime: 0 } },
                        translatedAt: new Date(), // Use translatedAt
                        errorDetails: undefined // Clear previous error details
                    });
                     logger.debug(`[Worker Job ${jobId}] Segment index ${segment.index} (ID: ${segment._id}) processed by TM.`);
                } else {
                    // Segment needs AI translation
                    segmentsForBatching.push(segment);
                }
            } catch (tmError: any) {
                 logger.error(`[Worker Job ${jobId}] Error checking TM for segment index ${segment.index} (ID: ${segment._id}): ${tmError.message}. Adding to AI batch.`, tmError);
                 errors.push(`TM Error for index ${segment.index}: ${tmError.message}`);
                 segmentsForBatching.push(segment); // Add to batch even if TM check failed
                 // Decide if TM error counts as a full segment error later
            }
            // Update progress after each segment check (TM or adding to batch)
            processedCountForProgress++;
            // Rough progress estimate: TM check is part of the work
            const progress = Math.round((processedCountForProgress / totalSegmentsToConsider) * 50); // TM check is roughly 50%? Adjust weight.
            await job.updateProgress(Math.min(progress, 100));
        }
        logger.info(`[Worker Job ${jobId}] TM check completed. ${totalSegmentsProcessedByTM} segments processed by TM. ${segmentsForBatching.length} segments remaining for AI.`);

        // --- Batch and Translate Remaining Segments via AI ---
        if (segmentsForBatching.length > 0) {
            const batches = splitSegmentsByTokenLimit(
                segmentsForBatching,
                baseSystemPrompt || '', // Pass empty string if null
                maxInputTokens,
                tokenizerModel
            );

            logger.info(`[Worker Job ${jobId}] Processing ${segmentsForBatching.length} segments in ${batches.length} batches.`);
            let currentBatchIndex = 0;

            for (const batch of batches) {
                currentBatchIndex++;
                const batchSegmentIds = batch.map(s => s._id.toString());
                logger.info(`[Worker Job ${jobId}] Processing Batch ${currentBatchIndex}/${batches.length} (${batch.length} segments)...`);

                try {
                    // Mark segments in batch as TRANSLATING
                    await Segment.updateMany({ _id: { $in: batchSegmentIds } }, { $set: { status: SegmentStatus.TRANSLATING } });

                    const userPrompt = await buildSegmentedUserPrompt(
                        batch,
                        promptContext
                    );
                    // --- ADDED: Log batch details before sending ---
                    const userPromptTokens = tokenCount(userPrompt, tokenizerModel);
                    logger.info(`[Worker Job ${jobId}] Sending Batch ${currentBatchIndex} (${batch.length} segments, ~${userPromptTokens} user prompt tokens) to AI...`);
                    // ---------------------------------------------
                    // Define batch options for translateBatch call
                    const batchOptions = {
                         ...options, // Pass general options
                         aiModel: options?.aiModel, // Pass specific model override
                         temperature: options?.temperature, // Pass specific temp override
                        // maxTokens: options?.maxOutputTokens // Example: If you add output token limit later
                    };


                    // Call the batch translation method in the service
                    const aiResponse: ChatCompletionResponse = await translationService.translateBatch(
                        baseSystemPrompt || '',
                        userPrompt,
                        aiConfigId,
                        batchOptions // Pass constructed batch options
                    );

                    // --- Log the raw AI response content for debugging ---
                    logger.debug(`[Worker Job ${jobId}] Batch ${currentBatchIndex}: Raw AI Response Content:\n${aiResponse.content || '(No Content)'}`);
                    // ------------------------------------------------------

                    // Parse the AI response
                    const parsedMap: ParsedTranslationMap = parseTranslatedSegments(aiResponse.content || '');
                    logger.debug(`[Worker Job ${jobId}] Batch ${currentBatchIndex}: Parsed ${Object.keys(parsedMap).length} results from AI.`);

                    // --- Update Segments in Batch ---
                    let batchSuccessCount = 0;
                    let batchErrorCount = 0;
                    for (const segment of batch) {
                        const segmentIdStr = segment._id.toString();
                        const translation = parsedMap[segment.index];

                        if (translation !== undefined && translation !== null) {
                            // Successfully translated
                            const segmentPromptTemplateId = promptTemplateId ? new Types.ObjectId(promptTemplateId) : undefined;
                            await segmentService.updateSegment(segmentIdStr, {
                                translation: translation,
                                status: SegmentStatus.TRANSLATED,
                                translatedLength: translation.length,
                                // Store translation info in metadata field
                                metadata: {
                                    translationInfo: {
                                        aiModel: aiResponse.model,
                                        promptTemplateId: segmentPromptTemplateId,
                                        tokenCount: aiResponse.usage?.total_tokens,
                                    }
                                },
                                translatedAt: new Date(), // Use translatedAt
                                errorDetails: undefined // Clear previous error details
                            });
                            // --- ADDED: Log the successful translation --- 
                            logger.debug(`[Worker Job ${jobId}] Batch ${currentBatchIndex}, Segment ${segment.index} (ID: ${segmentIdStr}) Translated: "${translation}"`);
                            // -------------------------------------------
                            batchSuccessCount++;
                        } else {
                            // Translation missing or parsing failed for this segment
                            const errMsg = `Translation not found in AI response for segment index ${segment.index} (ID: ${segmentIdStr})`;
                            logger.error(`[Worker Job ${jobId}] ${errMsg}`);
                            errors.push(errMsg);
                            await segmentService.updateSegment(segmentIdStr, {
                                status: SegmentStatus.TRANSLATION_FAILED,
                                // Use errorDetails field
                                errorDetails: errMsg
                            });
                            batchErrorCount++;
                        }
                         // Update progress after each segment update within the batch
                         processedCountForProgress++;
                         // Progress: 50% (TM) + 50% * (AI processed / AI total)
                         const aiSegmentsProcessed = processedCountForProgress - totalSegmentsProcessedByTM;
                         const aiProgress = segmentsForBatching.length > 0 ? aiSegmentsProcessed / segmentsForBatching.length : 1; // Avoid division by zero
                         const overallProgress = Math.round(50 + 50 * aiProgress);
                         await job.updateProgress(Math.min(overallProgress, 100));
                    } // End for segment in batch
                     logger.info(`[Worker Job ${jobId}] Batch ${currentBatchIndex} update complete. Success: ${batchSuccessCount}, Failed: ${batchErrorCount}.`);
                     totalSegmentsProcessedByAI += batchSuccessCount;
                     totalSegmentsErrored += batchErrorCount;

                } catch (batchError: any) {
                    const batchErrorMsg = `FATAL ERROR processing Batch ${currentBatchIndex}: ${batchError.message}`;
                    logger.error(`[Worker Job ${jobId}] ${batchErrorMsg}`, batchError);
                    errors.push(batchErrorMsg);
                    totalSegmentsErrored += batch.length; // Assume all segments in the failed batch errored

                    // Attempt to mark all segments in the failed batch as ERROR
                    try {
                         // Use TRANSLATION_FAILED and errorDetails
                         await Segment.updateMany({ _id: { $in: batchSegmentIds } }, { $set: { status: SegmentStatus.TRANSLATION_FAILED, errorDetails: batchErrorMsg } });
                    } catch (updateErr) {
                         logger.error(`[Worker Job ${jobId}] Failed to mark segments as ERROR after batch failure`, updateErr);
                    }
                     // Update progress assuming the whole batch errored
                     processedCountForProgress += batch.length; // Increment by full batch size
                     const aiSegmentsProcessed = processedCountForProgress - totalSegmentsProcessedByTM;
                     const aiProgress = segmentsForBatching.length > 0 ? aiSegmentsProcessed / segmentsForBatching.length : 1;
                     const overallProgress = Math.round(50 + 50 * aiProgress);
                     await job.updateProgress(Math.min(overallProgress, 100));
                }
            } // End for each batch
        } // End if segmentsForBatching > 0

        // --- Final File/Project Status Update ---
        logger.info(`[Worker Job ${jobId}] All batches processed. Attempting final status updates...`);
        if (type === 'file' && fileId) {
            try {
                await translationService.translateFileSegments(fileId!); // Add non-null assertion
            } catch (statusError: any) {
                 logger.error(`[Worker Job ${jobId}] Error calling final translateFileSegments for file ${fileId}: ${statusError.message}`);
                 errors.push(`Final status update failed for file ${fileId}: ${statusError.message}`);
            }
        } else if (type === 'project') {
            // Update status for all files involved in the project job
            // Ensure correct file IDs are extracted (handle potential nulls from lean)
            const fileIdsInProject = [...new Set(allSegmentsInScope.map(s => s.fileId?.toString()).filter(id => !!id))] as string[];
            logger.info(`[Worker Job ${jobId}] Updating final status for ${fileIdsInProject.length} files in project...`);
            for (const fId of fileIdsInProject) {
                 try {
                     await translationService.translateFileSegments(fId);
                 } catch (statusError: any) {
                     logger.error(`[Worker Job ${jobId}] Error calling final translateFileSegments for file ${fId} in project job: ${statusError.message}`);
                     errors.push(`Final status update failed for file ${fId}: ${statusError.message}`);
                 }
            }
        }
        // --- END Final File/Project Status Update ---

        // --- Job Completion Logic ---
        const totalProcessed = totalSegmentsProcessedByTM + totalSegmentsProcessedByAI; // Use correct variable
        logger.info(`[Worker Job ${jobId}] FINISHED processing. TM Processed: ${totalSegmentsProcessedByTM}, AI Processed: ${totalSegmentsProcessedByAI}, Errored: ${totalSegmentsErrored} (out of ${totalSegmentsToConsider} initially).`);

        if (errors.length > 0 || totalSegmentsErrored > 0) {
            logger.error(`[Worker Job ${jobId}] Completed with errors:`, errors);
            const summaryError = new Error(`Job completed with ${totalSegmentsErrored} errored segments and ${errors.length} logged errors. First error: ${errors[0] || 'N/A'}`);
            (summaryError as any).details = errors;
            throw summaryError;
        }

        return {
            message: `Job completed successfully. TM Processed: ${totalSegmentsProcessedByTM}, AI Processed: ${totalSegmentsProcessedByAI}.`,
            processedByTM: totalSegmentsProcessedByTM,
            processedByAI: totalSegmentsProcessedByAI,
            erroredSegments: totalSegmentsErrored,
            totalInitialSegments: totalSegmentsToConsider
        };

    } catch (error: any) {
        logger.error(`[Worker Job ${jobId}] FATAL ERROR during processing: ${error.message}`, {
            stack: error.stack,
            jobData: job.data
        });
        try {
            await job.updateProgress(100); // Mark progress done even on fatal error
        } catch (progressError) {
            logger.error(`[Worker Job ${jobId}] Failed to update progress during fatal error handling:`, progressError);
        }
        // TODO: Consider marking remaining PENDING/TRANSLATING segments as error on fatal worker crash?
        // await Segment.updateMany({ _id: { $in: allSegmentsInScope.map(s=>s._id) }, status: { $in: [SegmentStatus.PENDING, SegmentStatus.TRANSLATING]}}, { $set: { status: SegmentStatus.TRANSLATION_FAILED, errorDetails: `Worker fatal error: ${error.message}`}});

        throw error; // Rethrow original error to fail the BullMQ job
    }
} // End processJob function

// --- Worker Setup ---

async function setupWorker() {
  // Ensure reflect-metadata is first (already confirmed)

  // Restore priming block
  try {
    // --- Prime ProjectService FIRST --- 
    Container.get(ProjectService);
    logger.info('Primed ProjectService.');
    // --- Prime other services ---
    Container.get(TranslationService);
    Container.get(TranslationMemoryService);
    Container.get(TerminologyService);
    Container.get(SegmentService);
    Container.get(AIConfigService);
    Container.get(PromptProcessor);
    Container.get(AIServiceFactory);
    Container.get(AIReviewService); // Ensure this is primed too if needed
    logger.info('Attempted to prime TypeDI container for key services.');
  } catch (diError) {
    logger.warn('Priming TypeDI container during setup failed:', diError);
     // Optionally re-throw or exit if priming is critical
     // throw diError; 
     // process.exit(1);
  }

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
    // Consider concurrency carefully with batching. Maybe start with 1?
    concurrency: parseInt(process.env.TRANSLATION_WORKER_CONCURRENCY || '1', 10),
    limiter: {
      max: parseInt(process.env.TRANSLATION_WORKER_RATE_MAX || '5', 10), // Adjust rate limit based on batching performance
      duration: parseInt(process.env.TRANSLATION_WORKER_RATE_DURATION || '1000', 10)
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
      // Add job type/id to progress log for clarity
       logger.debug(`Job ${job.id} progress: ${progress}%`);
    } else {
       logger.debug(`Job ${job.id} progress updated:`, progress);
    }
  });

  logger.info('Translation worker started (BATCH MODE)...'); // Indicate batch mode

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down worker gracefully...');
    await worker.close();
    await mongoose.disconnect();
    logger.info('Worker and DB connection closed.');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down worker gracefully...');
    await worker.close();
    await mongoose.disconnect();
    logger.info('Worker and DB connection closed.');
    process.exit(1); // Use exit code 1 for SIGTERM? Or 0? Often 1 or >0 indicates external termination.
  });
}

// Start the worker
setupWorker();
