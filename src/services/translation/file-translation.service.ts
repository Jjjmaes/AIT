import { TranslationService } from './translation.service';
import { TranslationOptions } from '../../types/translation.types';
import { FileStatus } from '../../models/file.model';
import { TranslationStatus } from '../../types/translation.types';
import { TranslationTask } from '../../types/translation.types';
import { TranslationProgressUpdate } from '../../types/translation.types';
import { Types } from 'mongoose';
import logger from '../../utils/logger';

export class FileTranslationService {
  private translationService: TranslationService;
  private fileId: Types.ObjectId;
  private projectId: Types.ObjectId;
  private options: TranslationOptions;
  private tasks: TranslationTask[];
  private progress: TranslationProgressUpdate;
  private results: any[];

  constructor(
    translationService: TranslationService,
    fileId: Types.ObjectId,
    projectId: Types.ObjectId,
    options: TranslationOptions
  ) {
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
      status: TranslationStatus.PENDING,
      lastUpdated: new Date()
    };
  }

  async initialize(segments: string[]): Promise<void> {
    try {
      // 创建翻译任务
      this.tasks = segments.map((segment, index) => ({
        id: `${this.fileId.toString()}-${index}`,
        taskId: new Types.ObjectId().toString(),
        projectId: this.projectId,
        fileId: this.fileId,
        originalText: segment,
        status: TranslationStatus.PENDING,
        options: this.options,
        createdAt: new Date(),
        updatedAt: new Date(),
        progress: 0
      }));

      this.progress.totalSegments = segments.length;
      this.progress.lastUpdated = new Date();
    } catch (error) {
      logger.error('Failed to initialize file translation:', error);
      throw error;
    }
  }

  async translate(): Promise<void> {
    try {
      this.progress.status = TranslationStatus.PROCESSING;
      this.progress.lastUpdated = new Date();

      for (const task of this.tasks) {
        try {
          task.status = TranslationStatus.PROCESSING;
          task.startedAt = new Date();
          task.updatedAt = new Date();

          const result = await this.translationService.translateText(
            task.originalText || '',
            this.options
          );

          task.status = TranslationStatus.COMPLETED;
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
        } catch (error) {
          task.status = TranslationStatus.FAILED;
          task.error = error instanceof Error ? error.message : 'Unknown error';
          task.updatedAt = new Date();
          this.progress.failedSegments++;
          this.progress.processedSegments++;
          logger.error(`Failed to translate segment ${task.id}:`, error);
          throw error; // 抛出错误以触发测试失败
        }

        this.progress.progress = (this.progress.processedSegments / this.progress.totalSegments) * 100;
        this.progress.lastUpdated = new Date();
      }

      this.progress.status = this.progress.failedSegments === this.progress.totalSegments
        ? TranslationStatus.FAILED
        : TranslationStatus.COMPLETED;
      this.progress.lastUpdated = new Date();
    } catch (error) {
      this.progress.status = TranslationStatus.FAILED;
      this.progress.lastUpdated = new Date();
      logger.error('Failed to translate file:', error);
      throw error;
    }
  }

  async cancel(): Promise<void> {
    try {
      this.progress.status = TranslationStatus.CANCELLED;
      this.progress.lastUpdated = new Date();

      // 取消所有非完成状态的任务
      for (const task of this.tasks) {
        if (task.status !== TranslationStatus.COMPLETED) {
          task.status = TranslationStatus.CANCELLED;
          task.updatedAt = new Date();
        }
      }
    } catch (error) {
      logger.error('Failed to cancel file translation:', error);
      throw error;
    }
  }

  getTasks(): TranslationTask[] {
    return this.tasks;
  }

  getProgress(): TranslationProgressUpdate {
    return this.progress;
  }

  async getResult(): Promise<{ segments: any[] }> {
    return {
      segments: this.results
    };
  }
} 