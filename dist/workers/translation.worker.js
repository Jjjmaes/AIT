"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const logger_1 = __importDefault(require("../utils/logger"));
const translation_service_1 = require("../services/translation.service");
const segment_service_1 = require("../services/segment.service");
const file_model_1 = require("../models/file.model");
const segment_model_1 = require("../models/segment.model");
require("dotenv/config"); // Load environment variables
const mongoose_1 = __importDefault(require("mongoose")); // Needed for DB connection
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
    const { type, projectId, fileId, options, userId } = job.data;
    logger_1.default.info(`Processing ${type} translation job ${job.id} for project ${projectId}${fileId ? `, file ${fileId}` : ''}`);
    let totalSegments = 0;
    let processedSegments = 0;
    let erroredSegments = 0;
    const errors = [];
    try {
        const segmentsToTranslate = [];
        if (type === 'file') {
            if (!fileId)
                throw new Error('Missing fileId for file translation job');
            const result = await segment_service_1.segmentService.getSegmentsByFileId(fileId);
            totalSegments = result.total;
            result.segments.forEach((s) => {
                if (s.status === segment_model_1.SegmentStatus.PENDING || s.status === segment_model_1.SegmentStatus.ERROR) {
                    segmentsToTranslate.push({ segmentId: s._id.toString(), fileId });
                }
            });
            logger_1.default.info(`Job ${job.id}: Found ${totalSegments} segments for file ${fileId}, ${segmentsToTranslate.length} need translation.`);
        }
        else if (type === 'project') {
            const files = await file_model_1.File.find({ projectId: new mongoose_1.default.Types.ObjectId(projectId) }).exec();
            if (!files || files.length === 0) {
                logger_1.default.warn(`Job ${job.id}: No files found for project ${projectId}. Nothing to translate.`);
                return { message: 'No files found in project' };
            }
            logger_1.default.info(`Job ${job.id}: Found ${files.length} files for project ${projectId}. Fetching segments...`);
            let projectSegmentCount = 0;
            for (const file of files) {
                const result = await segment_service_1.segmentService.getSegmentsByFileId(file._id.toString());
                projectSegmentCount += result.total;
                result.segments.forEach((s) => {
                    if (s.status === segment_model_1.SegmentStatus.PENDING || s.status === segment_model_1.SegmentStatus.ERROR) {
                        segmentsToTranslate.push({ segmentId: s._id.toString(), fileId: file._id.toString() });
                    }
                });
            }
            totalSegments = projectSegmentCount;
            logger_1.default.info(`Job ${job.id}: Found ${totalSegments} total segments for project ${projectId}, ${segmentsToTranslate.length} need translation.`);
        }
        // Process segments sequentially for simplicity, could be parallelized later
        for (const { segmentId, fileId: currentFileId } of segmentsToTranslate) {
            try {
                await translation_service_1.translationService.translateSegment(segmentId, userId, options);
                processedSegments++;
            }
            catch (error) {
                logger_1.default.error(`Job ${job.id}: Failed to translate segment ${segmentId} in file ${currentFileId}: ${error.message}`);
                erroredSegments++;
                errors.push(`Segment ${segmentId}: ${error.message}`);
                // Optionally mark segment as error if translateSegment didn't do it
                try {
                    await segment_service_1.segmentService.updateSegment(segmentId, { status: segment_model_1.SegmentStatus.ERROR, error: error.message });
                }
                catch (updateErr) {
                    logger_1.default.error(`Job ${job.id}: Failed to mark segment ${segmentId} as ERROR after translation failure:`, updateErr);
                }
            }
            // Update progress (percentage)
            const progress = totalSegments > 0 ? Math.round(((processedSegments + erroredSegments) / totalSegments) * 100) : 100;
            await job.updateProgress(progress);
        }
        logger_1.default.info(`Job ${job.id} finished. Processed: ${processedSegments}, Errors: ${erroredSegments}, Total: ${totalSegments}`);
        if (erroredSegments > 0) {
            // Throw an error to mark the job as failed, providing details
            throw new Error(`${erroredSegments} segment(s) failed to translate. Errors: ${errors.join('; ')}`);
        }
        return { processedCount: processedSegments, totalCount: totalSegments };
    }
    catch (error) {
        logger_1.default.error(`Job ${job.id} failed catastrophically: ${error.message}`, error);
        // Rethrow the error so BullMQ marks the job as failed
        throw error;
    }
}
// --- Worker Setup ---\n
async function setupWorker() {
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
setupWorker();
