"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTranslationService = void 0;
const translation_types_1 = require("../../types/translation.types");
const mongoose_1 = require("mongoose");
const logger_1 = __importDefault(require("../../utils/logger"));
class FileTranslationService {
    constructor(translationService, fileId, projectId, options) {
        this.translationService = translationService;
        this.fileId = fileId;
        this.projectId = projectId;
        this.options = options;
        this.tasks = [];
        this.results = [];
        this.progress = {
            projectId,
            fileId,
            totalSegments: 0,
            processedSegments: 0,
            completedSegments: 0,
            failedSegments: 0,
            progress: 0,
            status: translation_types_1.TranslationStatus.PENDING,
            lastUpdated: new Date()
        };
    }
    async initialize(segments) {
        try {
            // 创建翻译任务
            this.tasks = segments.map((segment, index) => ({
                id: `${this.fileId.toString()}-${index}`,
                taskId: new mongoose_1.Types.ObjectId().toString(),
                projectId: this.projectId,
                fileId: this.fileId,
                originalText: segment,
                status: translation_types_1.TranslationStatus.PENDING,
                options: this.options,
                createdAt: new Date(),
                updatedAt: new Date(),
                progress: 0
            }));
            this.progress.totalSegments = segments.length;
            this.progress.lastUpdated = new Date();
        }
        catch (error) {
            logger_1.default.error('Failed to initialize file translation:', error);
            throw error;
        }
    }
    async translate() {
        try {
            this.progress.status = translation_types_1.TranslationStatus.PROCESSING;
            this.progress.lastUpdated = new Date();
            for (const task of this.tasks) {
                try {
                    task.status = translation_types_1.TranslationStatus.PROCESSING;
                    task.startedAt = new Date();
                    task.updatedAt = new Date();
                    const result = await this.translationService.translateText(task.originalText || '', this.options);
                    task.status = translation_types_1.TranslationStatus.COMPLETED;
                    task.completedAt = new Date();
                    task.updatedAt = new Date();
                    task.progress = 100;
                    this.results.push({
                        ...result,
                        metadata: {
                            ...result.metadata,
                            tokens: {
                                input: result.metadata.wordCount * 1.3,
                                output: result.metadata.wordCount * 1.3
                            },
                            cost: result.metadata.wordCount * 0.0001
                        }
                    });
                    this.progress.completedSegments++;
                    this.progress.processedSegments++;
                }
                catch (error) {
                    task.status = translation_types_1.TranslationStatus.FAILED;
                    task.error = error instanceof Error ? error.message : 'Unknown error';
                    task.updatedAt = new Date();
                    this.progress.failedSegments++;
                    this.progress.processedSegments++;
                    logger_1.default.error(`Failed to translate segment ${task.id}:`, error);
                    throw error; // 抛出错误以触发测试失败
                }
                this.progress.progress = (this.progress.processedSegments / this.progress.totalSegments) * 100;
                this.progress.lastUpdated = new Date();
            }
            this.progress.status = this.progress.failedSegments === this.progress.totalSegments
                ? translation_types_1.TranslationStatus.FAILED
                : translation_types_1.TranslationStatus.COMPLETED;
            this.progress.lastUpdated = new Date();
        }
        catch (error) {
            this.progress.status = translation_types_1.TranslationStatus.FAILED;
            this.progress.lastUpdated = new Date();
            logger_1.default.error('Failed to translate file:', error);
            throw error;
        }
    }
    async cancel() {
        try {
            this.progress.status = translation_types_1.TranslationStatus.CANCELLED;
            this.progress.lastUpdated = new Date();
            // 取消所有非完成状态的任务
            for (const task of this.tasks) {
                if (task.status !== translation_types_1.TranslationStatus.COMPLETED) {
                    task.status = translation_types_1.TranslationStatus.CANCELLED;
                    task.updatedAt = new Date();
                }
            }
        }
        catch (error) {
            logger_1.default.error('Failed to cancel file translation:', error);
            throw error;
        }
    }
    getTasks() {
        return this.tasks;
    }
    getProgress() {
        return this.progress;
    }
    async getResult() {
        return {
            segments: this.results
        };
    }
}
exports.FileTranslationService = FileTranslationService;
