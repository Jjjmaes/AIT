"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewQueueService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const errorHandler_1 = require("../utils/errorHandler");
require("dotenv/config"); // Load environment variables
// Assuming ReviewOptions might be defined elsewhere, or define inline
// import { ReviewOptions } from '../review.service'; // Or relevant path
const QUEUE_NAME = 'review-jobs';
class ReviewQueueService {
    constructor() {
        this.serviceName = 'ReviewQueueService';
        // Use same connection options as translation queue for simplicity
        const connectionOptions = {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null
        };
        // Optionally, only connect if Redis is configured or needed
        // For now, we comment out the connection and queue creation
        /*
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
        */
        logger_1.default.warn(`Review queue service initialized WITHOUT Redis connection (temporary).`);
    }
    // Create a unique job ID for segment review
    getJobId(segmentId) {
        return `review-segment-${segmentId}`; // Allow easy check if job exists
    }
    /**
     * Adds an AI review job for a specific segment.
     * Uses segmentId as part of the jobId to prevent duplicate review jobs for the same segment.
     */
    async addSegmentReviewJob(segmentId, userId, requesterRoles) {
        const methodName = 'addSegmentReviewJob';
        const jobId = this.getJobId(segmentId);
        const jobData = { type: 'segment', segmentId, userId, requesterRoles, /* options */ };
        try {
            // Check if a job with this ID already exists (active, waiting, delayed, completed, failed)
            // Temporarily disable check as queue is disabled
            // const existingJob = await this.queue?.getJob(jobId);
            // if (existingJob) {
            //      const state = await existingJob.getState();
            //      logger.warn(`[${this.serviceName}.${methodName}] Job ${jobId} for segment ${segmentId} already exists with status ${state}. Skipping add.`);
            //      return null; // Indicate job was not added
            // }
            // Add the job with the specific ID
            // Temporarily bypass adding to the queue
            // await this.queue.add(jobId, jobData, { jobId });
            logger_1.default.warn(`TEMPORARY: Skipped adding segment review job ${jobId} to queue.`);
            return jobId; // Still return jobId as if added
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '添加 AI 审校任务');
        }
    }
    // Add getJobStatus, cancelJob similar to TranslationQueueService if needed
    async close() {
        // Temporarily do nothing
        // await this.queue?.close();
        // await this.connection?.quit();
        logger_1.default.info('Review queue service shutdown skipped (temporary).');
    }
}
// Export singleton instance
exports.reviewQueueService = new ReviewQueueService();
