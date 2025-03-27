"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectTranslationService = void 0;
const uuid_1 = require("uuid");
const file_translation_service_1 = require("./file-translation.service");
const translation_service_1 = require("./translation.service");
const translation_types_1 = require("../../types/translation.types");
const logger_1 = __importDefault(require("../../utils/logger"));
const mongoose_1 = require("mongoose");
const ai_service_types_1 = require("../../types/ai-service.types");
class ProjectTranslationService {
    constructor(config = {}) {
        this.config = config;
        this.tasks = new Map();
        this.translationService = new translation_service_1.TranslationService({
            provider: ai_service_types_1.AIProvider.OPENAI,
            apiKey: process.env.OPENAI_API_KEY || '',
            model: 'gpt-3.5-turbo',
            maxTokens: 1000,
            temperature: 0.7
        });
        this.fileTranslationService = new file_translation_service_1.FileTranslationService(this.translationService, new mongoose_1.Types.ObjectId(), new mongoose_1.Types.ObjectId(), {
            sourceLanguage: 'en',
            targetLanguage: 'es',
            preserveFormatting: true
        });
    }
    async initializeProject(name, description, files, options) {
        try {
            const projectId = (0, uuid_1.v4)();
            const fileTasks = await Promise.all(files.map(async (file) => {
                const task = {
                    id: file.id,
                    taskId: (0, uuid_1.v4)(),
                    status: translation_types_1.TranslationStatus.PENDING,
                    options,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    progress: 0
                };
                await this.fileTranslationService.initialize(file.content);
                return task;
            }));
            const task = {
                id: projectId,
                name,
                description,
                status: translation_types_1.TranslationStatus.PENDING,
                files: fileTasks,
                createdAt: new Date(),
                updatedAt: new Date(),
                progress: {
                    totalFiles: files.length,
                    completedFiles: 0,
                    totalSegments: files.reduce((sum, file) => sum + file.content.length, 0),
                    completedSegments: 0,
                    failedSegments: 0,
                    percentage: 0
                }
            };
            this.tasks.set(projectId, task);
            logger_1.default.info(`Project translation task initialized: ${projectId}`);
            return projectId;
        }
        catch (error) {
            logger_1.default.error('Failed to initialize project translation:', error);
            throw error;
        }
    }
    async translateProject(projectId) {
        const task = this.tasks.get(projectId);
        if (!task) {
            throw new Error(`Project translation task not found: ${projectId}`);
        }
        try {
            task.status = translation_types_1.TranslationStatus.PROCESSING;
            this.tasks.set(projectId, task);
            const maxConcurrentFiles = this.config.maxConcurrentFiles || 3;
            const fileBatches = this.chunkArray(task.files, maxConcurrentFiles);
            for (const batch of fileBatches) {
                await Promise.all(batch.map(async (file) => {
                    try {
                        await this.fileTranslationService.translate();
                        file.status = translation_types_1.TranslationStatus.COMPLETED;
                        this.updateProjectProgress(projectId);
                    }
                    catch (error) {
                        file.status = translation_types_1.TranslationStatus.FAILED;
                        logger_1.default.error(`Failed to translate file ${file.id}:`, error);
                    }
                }));
            }
            const finalTask = this.tasks.get(projectId);
            if (finalTask) {
                finalTask.status = this.isProjectCompleted(finalTask)
                    ? translation_types_1.TranslationStatus.COMPLETED
                    : translation_types_1.TranslationStatus.FAILED;
                finalTask.completedAt = new Date();
                this.tasks.set(projectId, finalTask);
            }
        }
        catch (error) {
            task.status = translation_types_1.TranslationStatus.FAILED;
            task.error = error instanceof Error ? error.message : 'Unknown error';
            this.tasks.set(projectId, task);
            logger_1.default.error('Project translation failed:', error);
            throw error;
        }
    }
    async cancelProject(projectId) {
        const task = this.tasks.get(projectId);
        if (!task) {
            throw new Error(`Project translation task not found: ${projectId}`);
        }
        try {
            await Promise.all(task.files.map(async (file) => {
                if (file.status === translation_types_1.TranslationStatus.PROCESSING) {
                    await this.fileTranslationService.cancel();
                }
            }));
            task.status = translation_types_1.TranslationStatus.CANCELLED;
            task.completedAt = new Date();
            this.tasks.set(projectId, task);
            logger_1.default.info(`Project translation cancelled: ${projectId}`);
        }
        catch (error) {
            task.status = translation_types_1.TranslationStatus.FAILED;
            task.error = error instanceof Error ? error.message : 'Unknown error';
            this.tasks.set(projectId, task);
            logger_1.default.error('Failed to cancel project translation:', error);
            throw error;
        }
    }
    async getProjectProgress(projectId) {
        const task = this.tasks.get(projectId);
        if (!task) {
            throw new Error(`Project translation task not found: ${projectId}`);
        }
        return task.progress;
    }
    async getProjectResult(projectId) {
        const task = this.tasks.get(projectId);
        if (!task) {
            throw new Error(`Project translation task not found: ${projectId}`);
        }
        const fileResults = await Promise.all(task.files.map(async (file) => {
            const result = await this.fileTranslationService.getResult();
            return {
                fileId: file.id,
                status: file.status,
                segments: result.segments
            };
        }));
        const summary = this.calculateProjectSummary(fileResults);
        return {
            projectId,
            status: task.status,
            files: fileResults,
            summary,
            error: task.error
        };
    }
    updateProjectProgress(projectId) {
        const task = this.tasks.get(projectId);
        if (!task)
            return;
        const progress = {
            totalFiles: task.progress.totalFiles,
            completedFiles: task.files.filter(f => f.status === translation_types_1.TranslationStatus.COMPLETED).length,
            totalSegments: task.progress.totalSegments,
            completedSegments: 0,
            failedSegments: 0,
            percentage: 0
        };
        // Calculate completed and failed segments
        task.files.forEach(file => {
            if (file.status === translation_types_1.TranslationStatus.COMPLETED) {
                progress.completedSegments += task.progress.totalSegments / task.progress.totalFiles;
            }
            else if (file.status === translation_types_1.TranslationStatus.FAILED) {
                progress.failedSegments += task.progress.totalSegments / task.progress.totalFiles;
            }
        });
        progress.percentage = (progress.completedSegments / progress.totalSegments) * 100;
        task.progress = progress;
        task.updatedAt = new Date();
        this.tasks.set(projectId, task);
    }
    isProjectCompleted(task) {
        return task.files.every(file => file.status === translation_types_1.TranslationStatus.COMPLETED);
    }
    calculateProjectSummary(files) {
        const summary = {
            totalFiles: files.length,
            completedFiles: files.filter(f => f.status === translation_types_1.TranslationStatus.COMPLETED).length,
            failedFiles: files.filter(f => f.status === translation_types_1.TranslationStatus.FAILED).length,
            totalSegments: 0,
            completedSegments: 0,
            failedSegments: 0,
            totalTokens: 0,
            totalCost: 0,
            averageQuality: 0,
            processingTime: 0
        };
        files.forEach(file => {
            file.segments.forEach(segment => {
                summary.totalSegments++;
                if (segment.status === translation_types_1.TranslationStatus.COMPLETED) {
                    summary.completedSegments++;
                    summary.totalTokens += segment.metadata.tokens.input + segment.metadata.tokens.output;
                    summary.totalCost += segment.metadata.cost || 0;
                    summary.processingTime += segment.metadata.processingTime || 0;
                }
                else if (segment.status === translation_types_1.TranslationStatus.FAILED) {
                    summary.failedSegments++;
                }
            });
        });
        if (summary.completedSegments > 0) {
            summary.averageQuality = summary.completedSegments / summary.totalSegments;
        }
        return summary;
    }
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}
exports.ProjectTranslationService = ProjectTranslationService;
