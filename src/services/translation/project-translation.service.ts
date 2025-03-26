import { v4 as uuidv4 } from 'uuid';
import { FileTranslationService } from './file-translation.service';
import { TranslationService } from './translation.service';
import { ProjectTranslationTask, ProjectTranslationOptions, ProjectTranslationResult, TranslationStatus, TranslationTask } from '../../types/translation.types';
import logger from '../../utils/logger';
import { Types } from 'mongoose';
import { AIProvider } from '../../types/ai-service.types';

export class ProjectTranslationService {
  private tasks: Map<string, ProjectTranslationTask> = new Map();
  private fileTranslationService: FileTranslationService;
  private translationService: TranslationService;

  constructor(
    private readonly config: {
      maxConcurrentFiles?: number;
      retryCount?: number;
      retryDelay?: number;
      timeout?: number;
    } = {}
  ) {
    this.translationService = new TranslationService({
      provider: AIProvider.OPENAI,
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-3.5-turbo',
      maxTokens: 1000,
      temperature: 0.7
    });

    this.fileTranslationService = new FileTranslationService(
      this.translationService,
      new Types.ObjectId(),
      new Types.ObjectId(),
      {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        preserveFormatting: true
      }
    );
  }

  async initializeProject(
    name: string,
    description: string,
    files: { id: string; content: string[] }[],
    options: ProjectTranslationOptions
  ): Promise<string> {
    try {
      const projectId = uuidv4();
      const fileTasks = await Promise.all(
        files.map(async (file) => {
          const task: TranslationTask = {
            id: file.id,
            taskId: uuidv4(),
            status: TranslationStatus.PENDING,
            options,
            createdAt: new Date(),
            updatedAt: new Date(),
            progress: 0
          };
          await this.fileTranslationService.initialize(file.content);
          return task;
        })
      );

      const task: ProjectTranslationTask = {
        id: projectId,
        name,
        description,
        status: TranslationStatus.PENDING,
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
      logger.info(`Project translation task initialized: ${projectId}`);
      return projectId;
    } catch (error) {
      logger.error('Failed to initialize project translation:', error);
      throw error;
    }
  }

  async translateProject(projectId: string): Promise<void> {
    const task = this.tasks.get(projectId);
    if (!task) {
      throw new Error(`Project translation task not found: ${projectId}`);
    }

    try {
      task.status = TranslationStatus.PROCESSING;
      this.tasks.set(projectId, task);

      const maxConcurrentFiles = this.config.maxConcurrentFiles || 3;
      const fileBatches = this.chunkArray(task.files, maxConcurrentFiles);

      for (const batch of fileBatches) {
        await Promise.all(
          batch.map(async (file) => {
            try {
              await this.fileTranslationService.translate();
              file.status = TranslationStatus.COMPLETED;
              this.updateProjectProgress(projectId);
            } catch (error) {
              file.status = TranslationStatus.FAILED;
              logger.error(`Failed to translate file ${file.id}:`, error);
            }
          })
        );
      }

      const finalTask = this.tasks.get(projectId);
      if (finalTask) {
        finalTask.status = this.isProjectCompleted(finalTask)
          ? TranslationStatus.COMPLETED
          : TranslationStatus.FAILED;
        finalTask.completedAt = new Date();
        this.tasks.set(projectId, finalTask);
      }
    } catch (error) {
      task.status = TranslationStatus.FAILED;
      task.error = error instanceof Error ? error.message : 'Unknown error';
      this.tasks.set(projectId, task);
      logger.error('Project translation failed:', error);
      throw error;
    }
  }

  async cancelProject(projectId: string): Promise<void> {
    const task = this.tasks.get(projectId);
    if (!task) {
      throw new Error(`Project translation task not found: ${projectId}`);
    }

    try {
      await Promise.all(
        task.files.map(async (file) => {
          if (file.status === TranslationStatus.PROCESSING) {
            await this.fileTranslationService.cancel();
          }
        })
      );

      task.status = TranslationStatus.CANCELLED;
      task.completedAt = new Date();
      this.tasks.set(projectId, task);
      logger.info(`Project translation cancelled: ${projectId}`);
    } catch (error) {
      task.status = TranslationStatus.FAILED;
      task.error = error instanceof Error ? error.message : 'Unknown error';
      this.tasks.set(projectId, task);
      logger.error('Failed to cancel project translation:', error);
      throw error;
    }
  }

  async getProjectProgress(projectId: string): Promise<ProjectTranslationTask['progress']> {
    const task = this.tasks.get(projectId);
    if (!task) {
      throw new Error(`Project translation task not found: ${projectId}`);
    }

    return task.progress;
  }

  async getProjectResult(projectId: string): Promise<ProjectTranslationResult> {
    const task = this.tasks.get(projectId);
    if (!task) {
      throw new Error(`Project translation task not found: ${projectId}`);
    }

    const fileResults = await Promise.all(
      task.files.map(async (file) => {
        const result = await this.fileTranslationService.getResult();
        return {
          fileId: file.id,
          status: file.status,
          segments: result.segments
        };
      })
    );

    const summary = this.calculateProjectSummary(fileResults);

    return {
      projectId,
      status: task.status,
      files: fileResults,
      summary,
      error: task.error
    };
  }

  private updateProjectProgress(projectId: string): void {
    const task = this.tasks.get(projectId);
    if (!task) return;

    const progress = {
      totalFiles: task.progress.totalFiles,
      completedFiles: task.files.filter(f => f.status === TranslationStatus.COMPLETED).length,
      totalSegments: task.progress.totalSegments,
      completedSegments: 0,
      failedSegments: 0,
      percentage: 0
    };

    // Calculate completed and failed segments
    task.files.forEach(file => {
      if (file.status === TranslationStatus.COMPLETED) {
        progress.completedSegments += task.progress.totalSegments / task.progress.totalFiles;
      } else if (file.status === TranslationStatus.FAILED) {
        progress.failedSegments += task.progress.totalSegments / task.progress.totalFiles;
      }
    });

    progress.percentage = (progress.completedSegments / progress.totalSegments) * 100;

    task.progress = progress;
    task.updatedAt = new Date();
    this.tasks.set(projectId, task);
  }

  private isProjectCompleted(task: ProjectTranslationTask): boolean {
    return task.files.every(file => file.status === TranslationStatus.COMPLETED);
  }

  private calculateProjectSummary(files: ProjectTranslationResult['files']): ProjectTranslationResult['summary'] {
    const summary = {
      totalFiles: files.length,
      completedFiles: files.filter(f => f.status === TranslationStatus.COMPLETED).length,
      failedFiles: files.filter(f => f.status === TranslationStatus.FAILED).length,
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
        if (segment.status === TranslationStatus.COMPLETED) {
          summary.completedSegments++;
          summary.totalTokens += segment.metadata.tokens.input + segment.metadata.tokens.output;
          summary.totalCost += segment.metadata.cost || 0;
          summary.processingTime += segment.metadata.processingTime || 0;
        } else if (segment.status === TranslationStatus.FAILED) {
          summary.failedSegments++;
        }
      });
    });

    if (summary.completedSegments > 0) {
      summary.averageQuality = summary.completedSegments / summary.totalSegments;
    }

    return summary;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
} 