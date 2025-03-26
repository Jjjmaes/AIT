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
        projectId: this.projectId,
        fileId: this.fileId,
        segmentId: new Types.ObjectId(),
        status: TranslationStatus.PENDING,
        options: this.options,
        createdAt: new Date(),
        updatedAt: new Date(),
        progress: 0
      }));

      // 更新进度信息
      this.progress.totalSegments = segments.length;
      this.progress.status = TranslationStatus.PENDING;
      this.progress.lastUpdated = new Date();

      logger.info('File translation initialized', {
        fileId: this.fileId.toString(),
        projectId: this.projectId.toString(),
        totalSegments: segments.length
      });
    } catch (error) {
      logger.error('Failed to initialize file translation', {
        fileId: this.fileId.toString(),
        projectId: this.projectId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async translate(): Promise<void> {
    try {
      this.progress.status = TranslationStatus.PROCESSING;
      this.progress.lastUpdated = new Date();

      // 并行处理翻译任务
      const batchSize = 5; // 每批处理的任务数
      for (let i = 0; i < this.tasks.length; i += batchSize) {
        const batch = this.tasks.slice(i, i + batchSize);
        await Promise.all(
          batch.map(task => this.processTask(task))
        );

        // 更新进度
        this.updateProgress();
      }

      this.progress.status = TranslationStatus.COMPLETED;
      this.progress.lastUpdated = new Date();

      logger.info('File translation completed', {
        fileId: this.fileId.toString(),
        projectId: this.projectId.toString(),
        totalSegments: this.progress.totalSegments,
        completedSegments: this.progress.completedSegments,
        failedSegments: this.progress.failedSegments
      });
    } catch (error) {
      this.progress.status = TranslationStatus.FAILED;
      this.progress.lastUpdated = new Date();

      logger.error('File translation failed', {
        fileId: this.fileId.toString(),
        projectId: this.projectId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async processTask(task: TranslationTask): Promise<void> {
    try {
      task.status = TranslationStatus.PROCESSING;
      task.startedAt = new Date();
      task.updatedAt = new Date();

      // 执行翻译
      const result = await this.translationService.translateText(
        task.segmentId.toString(),
        task.options
      );

      // 更新任务状态
      task.status = TranslationStatus.COMPLETED;
      task.completedAt = new Date();
      task.updatedAt = new Date();
      task.progress = 100;

      // 更新进度
      this.progress.processedSegments++;
      this.progress.completedSegments++;
      this.updateProgress();

      logger.info('Translation task completed', {
        taskId: task.id,
        fileId: this.fileId.toString(),
        projectId: this.projectId.toString(),
        processingTime: result.metadata.processingTime
      });
    } catch (error) {
      task.status = TranslationStatus.FAILED;
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.updatedAt = new Date();
      task.progress = 0;

      // 更新进度
      this.progress.processedSegments++;
      this.progress.failedSegments++;
      this.updateProgress();

      logger.error('Translation task failed', {
        taskId: task.id,
        fileId: this.fileId.toString(),
        projectId: this.projectId.toString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private updateProgress(): void {
    this.progress.progress = Math.round(
      (this.progress.processedSegments / this.progress.totalSegments) * 100
    );
    this.progress.lastUpdated = new Date();
  }

  getProgress(): TranslationProgressUpdate {
    return { ...this.progress };
  }

  getTasks(): TranslationTask[] {
    return [...this.tasks];
  }

  cancel(): void {
    this.progress.status = TranslationStatus.CANCELLED;
    this.progress.lastUpdated = new Date();

    // 取消所有未完成的任务
    this.tasks.forEach(task => {
      if (task.status === TranslationStatus.PENDING || task.status === TranslationStatus.PROCESSING) {
        task.status = TranslationStatus.CANCELLED;
        task.updatedAt = new Date();
      }
    });

    logger.info('File translation cancelled', {
      fileId: this.fileId.toString(),
      projectId: this.projectId.toString()
    });
  }
} 