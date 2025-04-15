"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const logger_1 = __importDefault(require("../utils/logger"));
const review_service_1 = require("../services/review.service"); // Correct path
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
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
async function processReviewJob(job) {
    // Extract roles from job data
    const { type, segmentId, userId, requesterRoles, projectId /*, options */ } = job.data;
    const jobId = job.id || `review-segment-${segmentId}`; // Use job ID if available
    logger_1.default.info(`Processing ${type} review job ${jobId} for segment ${segmentId}, initiated by user ${userId}`);
    try {
        // Call the appropriate method from ReviewService to perform the AI review
        // We assume startAIReview handles finding the segment, calling the AI, and updating the segment
        // Pass necessary options if the job data includes them
        const resultSegment = await review_service_1.reviewService.startAIReview(segmentId, userId, // Pass the user who initiated the original translation
        requesterRoles, // Pass the roles
        {
            projectId: projectId, // Pass projectId if available in job data
            /* Pass any other review options from job.data.options if implemented */
        });
        logger_1.default.info(`Job ${jobId}: AI Review processed successfully for segment ${segmentId}. Final status: ${resultSegment.status}`);
        // Return relevant result, e.g., the final status or identified issues count
        return {
            success: true,
            status: resultSegment.status,
            issuesFound: resultSegment.issues?.length || 0
        };
    }
    catch (error) {
        logger_1.default.error(`Job ${jobId} (Segment ${segmentId}) failed during AI Review processing: ${error.message}`, error);
        // Rethrow the error so BullMQ marks the job as failed
        // The ReviewService itself should handle marking the segment status as ERROR
        throw error;
    }
}
// --- Worker Setup ---
async function setupWorker() {
    // Ensure DB connection before starting worker
    try {
        await mongoose_1.default.connect(mongoUri);
        logger_1.default.info('MongoDB connected successfully for Review Worker.');
    }
    catch (err) {
        logger_1.default.error('MongoDB connection error for Review Worker:', err);
        process.exit(1); // Exit if DB connection fails
    }
    const worker = new bullmq_1.Worker(QUEUE_NAME, processReviewJob, {
        connection: connectionOptions,
        concurrency: parseInt(process.env.REVIEW_WORKER_CONCURRENCY || '3', 10), // Maybe lower concurrency for review?
        limiter: {
            max: parseInt(process.env.REVIEW_WORKER_RATE_MAX || '5', 10),
            duration: parseInt(process.env.REVIEW_WORKER_RATE_DURATION || '1000', 10)
        }
    });
    worker.on('completed', (job, result) => {
        logger_1.default.info(`Review Job ${job.id} completed successfully. Result:`, result);
    });
    worker.on('failed', (job, error) => {
        if (job) {
            logger_1.default.error(`Review Job ${job.id} failed. Error: ${error.message}`, { jobId: job.id, data: job.data, error });
        }
        else {
            logger_1.default.error(`A review job failed, but job details are unavailable. Error: ${error.message}`, error);
        }
    });
    worker.on('error', (error) => {
        logger_1.default.error(`Review Worker encountered an error: ${error.message}`, error);
    });
    // No progress reporting needed for this simple worker unless startAIReview provides it
    logger_1.default.info('AI Review worker started...');
    // Graceful shutdown
    process.on('SIGINT', async () => {
        logger_1.default.info('SIGINT received, shutting down review worker gracefully...');
        await worker.close();
        await mongoose_1.default.disconnect();
        logger_1.default.info('Review Worker and DB connection closed.');
        process.exit(0);
    });
}
// Temporarily comment out worker setup to disable Redis dependency
// setupWorker();
