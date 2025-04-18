"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectTranslationService = void 0;
const translation_types_1 = require("../types/translation.types");
const logger_1 = __importDefault(require("../utils/logger"));
class ProjectTranslationService {
    constructor(translationService, projectService) {
        this.translationService = translationService;
        this.projectService = projectService;
    }
    async getProjectTranslationStatus(projectId) {
        const project = await this.projectService.getProject(projectId);
        if (!project) {
            throw new Error(`Project ${projectId} not found`);
        }
        const status = await this.translationService.getTranslationStatus(projectId);
        return {
            projectId,
            status: status.status,
            files: project.files.map(file => ({
                fileId: file.id,
                status: file.status,
                segments: [] // TODO: Implement segment mapping
            })),
            summary: {
                totalFiles: project.files.length,
                completedFiles: project.files.filter(f => f.status === translation_types_1.TranslationStatus.COMPLETED).length,
                failedFiles: project.files.filter(f => f.status === translation_types_1.TranslationStatus.FAILED).length,
                totalSegments: 0, // TODO: Implement segment counting
                completedSegments: 0, // TODO: Implement segment counting
                failedSegments: 0, // TODO: Implement segment counting
                totalTokens: 0, // TODO: Implement token counting
                totalCost: 0, // TODO: Implement cost calculation
                averageQuality: 0, // TODO: Implement quality calculation
                processingTime: 0 // TODO: Implement processing time calculation
            }
        };
    }
    async cancelProjectTranslation(projectId) {
        const project = await this.projectService.getProject(projectId);
        if (!project) {
            throw new Error(`Project ${projectId} not found`);
        }
        const status = await this.translationService.getTranslationStatus(projectId);
        await this.translationService.cancelTranslation(projectId);
        logger_1.default.info(`Cancelled project translation: ${projectId}`);
    }
    async addProjectTranslationJob(projectId, options, userId) {
        // TODO: Pass actual user roles instead of a placeholder
        const project = await this.projectService.getProjectById(projectId, userId, ['admin']); // Added placeholder roles
        if (!project) {
            throw new Error(`Project ${projectId} not found`);
        }
        const jobId = await this.translationService.translateProject(projectId, userId, ['admin'], options);
        logger_1.default.info(`Started project translation job: ${jobId}`);
        return jobId;
    }
}
exports.ProjectTranslationService = ProjectTranslationService;
