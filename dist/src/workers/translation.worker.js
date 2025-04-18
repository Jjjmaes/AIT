"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata"); // MUST be the first import
const bullmq_1 = require("bullmq");
const logger_1 = __importDefault(require("../utils/logger"));
require("dotenv/config"); // Load environment variables
const mongoose_1 = __importDefault(require("mongoose")); // Needed for DB connection
const mongoose_2 = require("mongoose");
const typedi_1 = require("typedi"); // Import TypeDI Container
// --- Pre-import ALL Mongoose Models to ensure registration ---
require("../models/user.model");
require("../models/project.model");
require("../models/file.model");
require("../models/segment.model");
require("../models/aiConfig.model");
require("../models/promptTemplate.model");
require("../models/terminology.model"); // Assuming this is needed
require("../models/translationMemory.model"); // Assuming this is needed
const translation_service_1 = require("../services/translation.service"); // Keep class import
// File model is pre-imported, but keep type import if needed elsewhere
const file_model_1 = require("../models/file.model");
// Segment model is pre-imported, but keep type import if needed elsewhere
const segment_model_1 = require("../models/segment.model");
const errors_1 = require("../utils/errors");
// Project model is pre-imported, but we still need the type
const project_model_1 = require("../models/project.model");
const QUEUE_NAME = 'translation-jobs';
const connectionOptions = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null
};
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/translationPlatform';
// --- Main Job Processing Function ---\n
async function processJob(job) {
    // Log raw job data first
    logger_1.default.info(`[Worker Job ${job.id}] START Processing job. Raw Data:`, job.data);
    // Get TranslationService instance from TypeDI Container
    const translationService = typedi_1.Container.get(translation_service_1.TranslationService);
    // Explicitly type options when destructuring and provide a default value
    const { type, projectId, fileId, options = {}, userId, requesterRoles, aiConfigId, promptTemplateId } = job.data;
    // Explicitly log the extracted values
    logger_1.default.debug(`[Worker Job ${job.id}] Extracted - promptTemplateId: ${promptTemplateId}, aiConfigId: ${aiConfigId}`);
    if (!aiConfigId) {
        const errMsg = `Job ${job.id} is missing required aiConfigId. Value received: ${aiConfigId}`;
        logger_1.default.error(`[Worker Job ${job.id}] Validation failed: ${errMsg}`);
        throw new errors_1.AppError(errMsg, 400);
    }
    if (!promptTemplateId) {
        // Add value to error message and log before throwing
        const errMsg = `Job ${job.id} is missing required promptTemplateId. Value received: ${promptTemplateId}`;
        logger_1.default.error(`[Worker Job ${job.id}] Validation failed: ${errMsg}`);
        throw new errors_1.AppError(errMsg, 400);
    }
    logger_1.default.info(`[Worker Job ${job.id}] Processing Details - Type: ${type}, Project: ${projectId}, File: ${fileId || 'N/A'}, AI Config: ${aiConfigId}, Prompt: ${promptTemplateId}`);
    let totalSegmentsProcessed = 0;
    let totalSegmentsErrored = 0;
    const errors = [];
    let determinedSourceLang;
    let determinedTargetLang;
    // Add a variable to track the total number of segments considered by the job
    let totalSegmentsInScope = 0;
    try {
        if (type === 'file') {
            if (!fileId)
                throw new errors_1.AppError('Missing fileId for file translation job', 400);
            const fileObjectId = new mongoose_2.Types.ObjectId(fileId); // Keep ObjectId
            // --- Determine Languages (similar logic as before) ---
            const fileDoc = await file_model_1.File.findById(fileId).exec();
            if (!fileDoc)
                throw new errors_1.AppError(`File not found: ${fileId}`, 404);
            const projectDoc = await project_model_1.Project.findById(fileDoc.projectId).exec();
            if (!projectDoc)
                throw new errors_1.AppError(`Project ${fileDoc.projectId} not found for file ${fileId}`, 404);
            const projectSourceLang = projectDoc.languagePairs?.[0]?.source;
            const projectTargetLang = projectDoc.languagePairs?.[0]?.target;
            if (!projectSourceLang || !projectTargetLang) {
                throw new errors_1.AppError(`Project ${projectDoc._id} is missing language pair information.`, 400);
            }
            determinedSourceLang = options?.sourceLanguage || projectSourceLang;
            determinedTargetLang = options?.targetLanguage || projectTargetLang;
            if (!determinedSourceLang || !determinedTargetLang) {
                throw new errors_1.AppError(`Could not determine Source/Target language for file ${fileId}.`, 400);
            }
            logger_1.default.debug(`[Worker Job ${job.id}] Determined Languages for file ${fileId}: ${determinedSourceLang} -> ${determinedTargetLang}`);
            // --------------------------------------------------------
            // --- Get Total Segments for Progress Reporting ---      
            totalSegmentsInScope = await segment_model_1.Segment.countDocuments({ fileId: fileId, status: { $in: [segment_model_1.SegmentStatus.PENDING, segment_model_1.SegmentStatus.ERROR, segment_model_1.SegmentStatus.TRANSLATION_FAILED] } });
            // TODO: Add SegmentStatus.TRANSLATED_TM if options.retranslateTM is true for accurate progress scope?
            logger_1.default.info(`[Worker Job ${job.id}] Found ${totalSegmentsInScope} segments potentially needing translation for file ${fileId}.`);
            // -------------------------------------------------
            if (totalSegmentsInScope === 0) {
                logger_1.default.info(`[Worker Job ${job.id}] No segments require translation for file ${fileId}.`);
                await job.updateProgress(100);
                return { message: 'No segments required translation for this file.' };
            }
            // --- Call Batch Translation Service --- 
            logger_1.default.info(`[Worker Job ${job.id}] Calling batch translation service (translateMultipleSegments) for file ${fileId}...`);
            // Combine options with IDs needed by the service method signature
            const serviceOptions = {
                ...options,
                sourceLanguage: determinedSourceLang,
                targetLanguage: determinedTargetLang,
                aiModel: options.aiModel,
                temperature: options.temperature,
                // Include IDs within the options object passed as the second argument
                aiConfigId: aiConfigId,
                promptTemplateId: promptTemplateId
            };
            // Call translateMultipleSegments with ObjectId and combined options
            const batchResult = await translationService.translateMultipleSegments(fileObjectId, serviceOptions // Pass combined options object
            );
            logger_1.default.info(`[Worker Job ${job.id}] Batch translation service finished for file ${fileId}. Success: ${batchResult.success}, Updated: ${batchResult.updatedCount}, Failed: ${batchResult.failedSegments.length}`);
            // ----------------------------------------
            // --- Update Job Status Based on Actual Batch Result ---
            totalSegmentsProcessed = batchResult.updatedCount;
            totalSegmentsErrored = batchResult.failedSegments.length;
            if (!batchResult.success || totalSegmentsErrored > 0) {
                const errorDetail = batchResult.failedSegments.length > 0
                    ? `Failed segments: ${batchResult.failedSegments.join(', ')}`
                    : batchResult.message;
                errors.push(`Batch translation failed for file ${fileId}. ${errorDetail}`);
            }
            await job.updateProgress(100);
            // ---------------------------------------------
        }
        else if (type === 'project') {
            if (!projectId)
                throw new errors_1.AppError('Missing projectId for project translation job', 400);
            // --- Determine Languages for Project (similar logic as before) ---
            const projectDoc = await project_model_1.Project.findById(projectId).exec();
            if (!projectDoc)
                throw new errors_1.AppError(`Project not found: ${projectId}`, 404);
            const projectSourceLang = projectDoc.languagePairs?.[0]?.source;
            const projectTargetLang = projectDoc.languagePairs?.[0]?.target;
            if (!projectSourceLang || !projectTargetLang) {
                throw new errors_1.AppError(`Project ${projectDoc._id} is missing language pair information.`, 400);
            }
            determinedSourceLang = options?.sourceLanguage || projectSourceLang;
            determinedTargetLang = options?.targetLanguage || projectTargetLang;
            if (!determinedSourceLang || !determinedTargetLang) {
                throw new errors_1.AppError(`Could not determine Source/Target language for project ${projectId}.`, 400);
            }
            logger_1.default.debug(`[Worker Job ${job.id}] Determined Languages for project ${projectId}: ${determinedSourceLang} -> ${determinedTargetLang}`);
            // ---------------------------------------------------------------
            const filesInProject = await file_model_1.File.find({
                projectId: new mongoose_1.default.Types.ObjectId(projectId),
                // Consider only processing files that are ready (e.g., EXTRACTED)
                // status: FileStatus.EXTRACTED 
            }).exec();
            if (!filesInProject || filesInProject.length === 0) {
                logger_1.default.warn(`Job ${job.id}: No files found for project ${projectId}. Nothing to translate.`);
                await job.updateProgress(100);
                return { message: 'No files found in project' };
            }
            logger_1.default.info(`[Worker Job ${job.id}] Found ${filesInProject.length} files for project ${projectId}. Processing files sequentially...`);
            totalSegmentsInScope = await segment_model_1.Segment.countDocuments({
                fileId: { $in: filesInProject.map(f => f._id) },
                status: { $in: [segment_model_1.SegmentStatus.PENDING, segment_model_1.SegmentStatus.ERROR, segment_model_1.SegmentStatus.TRANSLATION_FAILED] }
            });
            // TODO: Add TM condition for scope count?
            logger_1.default.info(`[Worker Job ${job.id}] Found approx ${totalSegmentsInScope} segments potentially needing translation across project ${projectId}.`);
            let cumulativeProcessed = 0;
            let cumulativeErrored = 0;
            // Process each file in the project sequentially
            for (let i = 0; i < filesInProject.length; i++) {
                const currentFile = filesInProject[i];
                const currentFileId = currentFile._id; // Keep as ObjectId
                const currentFileIdString = currentFileId.toString();
                const segmentsInThisFile = await segment_model_1.Segment.countDocuments({ fileId: currentFileId, status: { $in: [segment_model_1.SegmentStatus.PENDING, segment_model_1.SegmentStatus.ERROR, segment_model_1.SegmentStatus.TRANSLATION_FAILED] } });
                logger_1.default.info(`[Worker Job ${job.id}] Processing file ${i + 1}/${filesInProject.length}: ${currentFileIdString} (${segmentsInThisFile} potential segments)...`);
                try {
                    // --- Call Batch Translation Service per File --- 
                    // Combine options with IDs needed by the service method signature
                    const serviceOptions = {
                        ...options,
                        sourceLanguage: determinedSourceLang,
                        targetLanguage: determinedTargetLang,
                        aiModel: options.aiModel,
                        temperature: options.temperature,
                        aiConfigId: aiConfigId,
                        promptTemplateId: promptTemplateId
                    };
                    // Call translateMultipleSegments with ObjectId and combined options
                    const batchResult = await translationService.translateMultipleSegments(currentFileId, serviceOptions // Pass combined options object
                    );
                    logger_1.default.info(`[Worker Job ${job.id}] Batch translation service finished for file ${currentFileIdString}. Success: ${batchResult.success}, Updated: ${batchResult.updatedCount}, Failed: ${batchResult.failedSegments.length}`);
                    // -----------------------------------------
                    // Accumulate actual results
                    cumulativeProcessed += batchResult.updatedCount;
                    cumulativeErrored += batchResult.failedSegments.length;
                    if (!batchResult.success || batchResult.failedSegments.length > 0) {
                        const errorDetail = batchResult.failedSegments.length > 0
                            ? `Failed segments: ${batchResult.failedSegments.join(', ')}`
                            : batchResult.message;
                        errors.push(`Batch translation failed for file ${currentFileIdString}. ${errorDetail}`);
                    }
                }
                catch (fileError) {
                    logger_1.default.error(`[Worker Job ${job.id}] Error processing file ${currentFileIdString} within project job: ${fileError.message}`, fileError);
                    errors.push(`Failed to process file ${currentFileIdString}: ${fileError.message}`);
                    cumulativeErrored += segmentsInThisFile;
                }
                // --- Update Overall Project Progress --- 
                let currentProgress = 0;
                if (totalSegmentsInScope > 0) {
                    currentProgress = Math.round(((cumulativeProcessed + cumulativeErrored) / totalSegmentsInScope) * 100);
                }
                currentProgress = Math.min(currentProgress, 100);
                logger_1.default.debug(`[Worker Job ${job.id}] Updating BullMQ project progress: ${currentProgress}%`);
                await job.updateProgress(currentProgress);
                // -------------------------------------
            }
            // Set final counts based on accumulation
            totalSegmentsProcessed = cumulativeProcessed;
            totalSegmentsErrored = cumulativeErrored;
        }
        else {
            throw new errors_1.AppError(`Unsupported job type: ${type}`, 400);
        }
        // --- Job Completion Logic --- (Uses actual accumulated counts)
        logger_1.default.info(`[Worker Job ${job.id}] FINISHED processing. Actual Processed: ${totalSegmentsProcessed}, Actual Errored: ${totalSegmentsErrored}`);
        if (errors.length > 0) {
            logger_1.default.error(`[Worker Job ${job.id}] Completed with errors:`, errors);
            throw new Error(`Job completed with errors affecting ${totalSegmentsErrored} segments across ${errors.length} files/batches. First error: ${errors[0]}`);
        }
        // Return actual counts
        return {
            message: `Job completed successfully. Segments processed: ${totalSegmentsProcessed}.`,
            processedSegments: totalSegmentsProcessed,
            erroredSegments: totalSegmentsErrored
        };
    }
    catch (error) {
        logger_1.default.error(`[Worker Job ${job.id}] FATAL ERROR during processing: ${error.message}`, {
            stack: error.stack,
            jobData: job.data // Log job data on fatal error
        });
        // Update progress to 100% but throw error to mark as failed?
        // Or leave progress as is? Let's update to 100 and fail.
        try {
            await job.updateProgress(100);
        }
        catch (progressError) {
            logger_1.default.error(`[Worker Job ${job.id}] Failed to update progress during error handling:`, progressError);
        }
        // Rethrow the error to ensure BullMQ marks the job as failed
        throw error;
    }
}
// --- Worker Setup ---\n
async function setupWorker() {
    // Ensure reflect-metadata is first (already confirmed)
    // Attempt to prime TypeDI container (optional, keep or remove based on testing)
    try {
        typedi_1.Container.get(translation_service_1.TranslationService);
        logger_1.default.info('Attempted to prime TypeDI container for TranslationService.');
    }
    catch (diError) {
        logger_1.default.warn('Priming TypeDI container during setup failed:', diError);
    }
    // Ensure DB connection before starting worker
    try {
        await mongoose_1.default.connect(mongoUri);
        logger_1.default.info('MongoDB connected successfully for worker.');
    }
    catch (err) {
        logger_1.default.error('MongoDB connection error for worker:', err);
        process.exit(1); // Exit if DB connection fails
    }
    const worker = new bullmq_1.Worker(QUEUE_NAME, processJob, {
        connection: connectionOptions,
        concurrency: parseInt(process.env.TRANSLATION_WORKER_CONCURRENCY || '5', 10), // Number of jobs to process concurrently
        limiter: {
            max: parseInt(process.env.TRANSLATION_WORKER_RATE_MAX || '10', 10), // Max 10 jobs
            duration: parseInt(process.env.TRANSLATION_WORKER_RATE_DURATION || '1000', 10) // per 1000 ms (1 second)
        }
    });
    worker.on('completed', (job, result) => {
        logger_1.default.info(`Job ${job.id} completed successfully. Result:`, result);
    });
    worker.on('failed', (job, error) => {
        // Job might be undefined if connection is lost
        if (job) {
            logger_1.default.error(`Job ${job.id} failed. Error: ${error.message}`, { jobId: job.id, data: job.data, error });
        }
        else {
            logger_1.default.error(`A job failed, but job details are unavailable. Error: ${error.message}`, error);
        }
    });
    worker.on('error', (error) => {
        logger_1.default.error(`Worker encountered an error: ${error.message}`, error);
    });
    worker.on('progress', (job, progress) => {
        if (typeof progress === 'number') {
            logger_1.default.debug(`Job ${job.id} progress: ${progress}%`);
        }
        else {
            logger_1.default.debug(`Job ${job.id} progress updated:`, progress);
        }
    });
    logger_1.default.info('Translation worker started...');
    // Graceful shutdown
    process.on('SIGINT', async () => {
        logger_1.default.info('SIGINT received, shutting down worker gracefully...');
        await worker.close();
        await mongoose_1.default.disconnect();
        logger_1.default.info('Worker and DB connection closed.');
        process.exit(0);
    });
}
// Restore worker setup
setupWorker();
