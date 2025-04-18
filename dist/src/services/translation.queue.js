"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationQueue = void 0;
const bull_1 = __importDefault(require("bull"));
const ai_provider_manager_1 = require("./ai-provider.manager");
const logger_1 = __importDefault(require("../utils/logger"));
class TranslationQueue {
    constructor() {
        this.queue = new bull_1.default('translation', {
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379')
            }
        });
        this.aiProvider = new ai_provider_manager_1.AIProviderManager();
    }
    async addJob(job) {
        await this.queue.add(job);
        logger_1.default.info(`Added translation job ${job.id} to queue`);
    }
    async getJobStatus(jobId) {
        const job = await this.queue.getJob(jobId);
        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }
        return {
            status: job.data.status,
            progress: job.progress() || 0,
            completedCount: job.returnvalue?.completedCount || 0,
            totalCount: job.returnvalue?.totalCount || 0,
            error: job.failedReason
        };
    }
    async cancelJob(jobId) {
        const job = await this.queue.getJob(jobId);
        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }
        await job.remove();
        logger_1.default.info(`Cancelled translation job ${jobId}`);
    }
    async addSegmentTranslationJob(projectId, fileId, segmentId, options) {
        const job = {
            id: segmentId,
            type: 'file',
            projectId,
            fileId,
            options,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await this.addJob(job);
        return job.id;
    }
    async addFileTranslationJob(projectId, fileId, options) {
        const job = {
            id: fileId,
            type: 'file',
            projectId,
            fileId,
            options,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await this.addJob(job);
        return job.id;
    }
    async addProjectTranslationJob(projectId, options) {
        const job = {
            id: projectId,
            type: 'project',
            projectId,
            options,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await this.addJob(job);
        return job.id;
    }
    async getFileStatus(fileId) {
        const fileJob = await this.queue.getJob(fileId);
        if (!fileJob) {
            throw new Error(`File job ${fileId} not found`);
        }
        return {
            status: fileJob.data.status,
            progress: fileJob.progress() || 0,
            completedCount: fileJob.returnvalue?.completedCount || 0,
            totalCount: fileJob.returnvalue?.totalCount || 0,
            error: fileJob.failedReason
        };
    }
    async processTranslationJob(job) {
        // Implementation of job processing
        throw new Error('Not implemented');
    }
}
exports.TranslationQueue = TranslationQueue;
