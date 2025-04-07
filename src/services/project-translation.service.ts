import { 
  TranslationOptions, 
  TranslationResult,
  TranslationStatus,
  ProjectTranslationResult
} from '../types/translation.types';
import { TranslationService } from './translation.service';
import { ProjectService } from './project.service';
import { IProject } from '../models/project.model';
import logger from '../utils/logger';

export class ProjectTranslationService {
  private translationService: TranslationService;
  private projectService: ProjectService;

  constructor(
    translationService: TranslationService,
    projectService: ProjectService
  ) {
    this.translationService = translationService;
    this.projectService = projectService;
  }

  async getProjectTranslationStatus(projectId: string): Promise<ProjectTranslationResult> {
    const project = await this.projectService.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const status = await this.translationService.getTranslationStatus(projectId);
    return {
      projectId,
      status: status.status as TranslationStatus,
      files: project.files.map(file => ({
        fileId: file.id,
        status: file.status as TranslationStatus,
        segments: [] // TODO: Implement segment mapping
      })),
      summary: {
        totalFiles: project.files.length,
        completedFiles: project.files.filter(f => f.status === TranslationStatus.COMPLETED).length,
        failedFiles: project.files.filter(f => f.status === TranslationStatus.FAILED).length,
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

  async cancelProjectTranslation(projectId: string): Promise<void> {
    const project = await this.projectService.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const status = await this.translationService.getTranslationStatus(projectId);
    await this.translationService.cancelTranslation(projectId);
    logger.info(`Cancelled project translation: ${projectId}`);
  }

  async addProjectTranslationJob(projectId: string, options: TranslationOptions, userId: string): Promise<string> {
    const project = await this.projectService.getProjectById(projectId, userId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const jobId = await this.translationService.translateProject(projectId, userId, options);
    logger.info(`Started project translation job: ${jobId}`);
    return jobId;
  }
} 