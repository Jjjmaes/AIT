import { QueueTask, QueueTaskStatus, QueueTaskType } from '../queue-task.interface';
import logger from '../../../../utils/logger';
import aiReviewService from '../../../../services/ai-review.service';
import { ISegment, Segment, SegmentStatus, IIssue } from '../../../../models/segment.model';
import { AIProvider } from '../../../../types/ai-service.types';
import { ReviewOptions } from '../../../../services/translation/ai-adapters/review.adapter';
import mongoose from 'mongoose';
import { File, FileStatus, IFile } from '../../../../models/file.model';

/**
 * 队列任务处理器接口
 */
export interface TaskProcessor {
  /**
   * 处理任务
   * @param task 要处理的任务
   */
  process(task: QueueTask): Promise<any>;
}

// 定义审校任务选项接口
interface ReviewTaskOptions {
  sourceLanguage: string;
  targetLanguage: string;
  model?: string;
  provider?: AIProvider;
  aiProvider?: string; // 提供兼容性
  customPrompt?: string;
  contextSegments?: Array<{
    original: string;
    translation: string;
  }>;
  priority?: string | number;
  preserveFormatting?: boolean;
  useTerminology?: boolean;
  // 批量处理选项
  batchSize?: number;
  concurrentLimit?: number;
  stopOnError?: boolean;
  // 过滤选项
  onlyNew?: boolean;
  includeStatuses?: SegmentStatus[];
  excludeStatuses?: SegmentStatus[];
}

/**
 * 审校任务处理器
 * 负责处理队列中的审校任务
 */
export class ReviewTaskProcessor implements TaskProcessor {
  // 处理任务时的默认批量大小
  private readonly DEFAULT_BATCH_SIZE = 10;
  // 默认并发数
  private readonly DEFAULT_CONCURRENT_LIMIT = 5;
  // 最大重试次数
  private readonly MAX_RETRIES = 3;
  
  /**
   * 处理队列中的审校任务
   */
  async process(task: QueueTask): Promise<any> {
    logger.info(`Processing review task: ${task.id}`, {
      taskId: task.id,
      taskType: task.type,
      dataType: task.data.taskType
    });
    
    const startTime = Date.now();

    try {
      let result;
      
      switch (task.data.taskType) {
        case 'segmentReview':
          result = await this.processSegmentReview(task);
          break;
        case 'batchSegmentReview':
          result = await this.processBatchSegmentReview(task);
          break;
        case 'fileReview':
          result = await this.processFileReview(task);
          break;
        case 'textReview':
          result = await this.processTextReview(task);
          break;
        default:
          throw new Error(`Unsupported review task type: ${task.data.taskType}`);
      }
      
      const duration = Date.now() - startTime;
      logger.info(`Review task ${task.id} processed successfully in ${duration}ms`, {
        taskId: task.id,
        duration,
        result: typeof result === 'object' ? '(object)' : result
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`Review task processing failed: ${task.id} after ${duration}ms`, {
        taskId: task.id, 
        error: error.message,
        stack: error.stack,
        duration
      });
      
      // 重新抛出错误，让队列系统处理重试逻辑
      throw error;
    } finally {
      logger.debug(`Review task ${task.id} processing completed in ${Date.now() - startTime}ms`);
    }
  }

  /**
   * 处理段落审校任务
   */
  private async processSegmentReview(task: QueueTask): Promise<any> {
    const { segmentId, options } = task.data;
    const reviewOptions: ReviewTaskOptions = options || {
      sourceLanguage: '',
      targetLanguage: ''
    };

    // 输入验证
    if (!segmentId || !mongoose.isValidObjectId(segmentId)) {
      throw new Error(`Invalid segment ID: ${segmentId}`);
    }

    logger.debug(`Starting review for segment: ${segmentId}`, { segmentId, options: reviewOptions });

    // 查找段落
    const segment = await Segment.findById(segmentId);
    if (!segment) {
      throw new Error(`Segment not found: ${segmentId}`);
    }

    // 确保段落状态正确
    if (this.isInvalidSegmentStatus(segment.status)) {
      throw new Error(`Invalid segment status for review: ${segment.status}`);
    }

    // 确保段落有内容和翻译
    if (!segment.content) {
      throw new Error(`Segment ${segmentId} has no content`);
    }
    
    if (!segment.translation) {
      throw new Error(`Segment ${segmentId} has no translation to review`);
    }

    // 更新段落状态为审校中
    const previousStatus = segment.status;
    segment.status = SegmentStatus.REVIEW_IN_PROGRESS;
    await segment.save();

    try {
      // 执行AI审校
      logger.info(`Starting AI review for segment ${segmentId} using model ${reviewOptions.model || 'default'}`);
      const reviewResult = await aiReviewService.reviewTranslation(
        segment.content,
        segment.translation || '',
        {
          sourceLanguage: reviewOptions.sourceLanguage || '',
          targetLanguage: reviewOptions.targetLanguage || '',
          model: reviewOptions.model,
          provider: (reviewOptions.provider || getProviderFromString(reviewOptions.aiProvider)) || AIProvider.OPENAI,
          customPrompt: reviewOptions.customPrompt,
          contextSegments: reviewOptions.contextSegments
        }
      );

      // 保存审校结果
      await this.saveReviewResult(segment, reviewResult);
      
      logger.info(`AI review completed for segment ${segmentId}`);
      
      return {
        segmentId: segment._id,
        status: segment.status,
        reviewResult: {
          scores: segment.reviewResult?.scores || [],
          suggestedTranslation: segment.reviewResult?.suggestedTranslation || '',
          issuesCount: segment.issues?.length || 0,
          modificationDegree: segment.reviewResult?.modificationDegree || 0
        }
      };
    } catch (error: any) {
      // 发生错误时更新段落状态
      segment.status = SegmentStatus.REVIEW_FAILED;
      segment.error = error.message;
      await segment.save();
      
      logger.error(`Error reviewing segment ${segmentId}: ${error.message}`, {
        segmentId,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }
  
  /**
   * 处理批量段落审校任务
   */
  private async processBatchSegmentReview(task: QueueTask): Promise<any> {
    const { segmentIds, options } = task.data;
    const reviewOptions: ReviewTaskOptions = options || {
      sourceLanguage: '',
      targetLanguage: ''
    };
    
    // 批量大小和并发限制
    const batchSize = reviewOptions.batchSize || this.DEFAULT_BATCH_SIZE;
    const concurrentLimit = reviewOptions.concurrentLimit || this.DEFAULT_CONCURRENT_LIMIT;
    const stopOnError = reviewOptions.stopOnError === true;
    
    if (!Array.isArray(segmentIds) || segmentIds.length === 0) {
      throw new Error('No segment IDs provided for batch review');
    }
    
    logger.info(`Starting batch review for ${segmentIds.length} segments`, {
      segmentCount: segmentIds.length,
      batchSize,
      concurrentLimit
    });
    
    // 结果和错误收集
    const results: any[] = [];
    const errors: any[] = [];
    
    // 分批处理
    for (let i = 0; i < segmentIds.length; i += batchSize) {
      const batch = segmentIds.slice(i, i + batchSize);
      logger.debug(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(segmentIds.length/batchSize)}`);
      
      try {
        // 创建批次内的并发任务
        const batchPromises = batch.map(segmentId => {
          return this.processSegmentReviewWithRetry({
            ...task,
            data: { 
              segmentId, 
              options: reviewOptions,
              taskType: 'segmentReview'
            } as any
          }).catch(error => {
            if (stopOnError) {
              throw error;
            }
            errors.push({ segmentId, error: error.message });
            return null;
          });
        });
        
        // 限制并发执行
        const batchResults = await this.executeConcurrently(batchPromises, concurrentLimit);
        results.push(...batchResults.filter(Boolean));
      } catch (error: any) {
        if (stopOnError) {
          logger.error(`Stopping batch processing due to error: ${error.message}`);
          throw error;
        }
      }
    }
    
    logger.info(`Batch review completed: ${results.length} succeeded, ${errors.length} failed`);
    
    return {
      totalSegments: segmentIds.length,
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    };
  }
  
  /**
   * 处理文件审校任务
   */
  private async processFileReview(task: QueueTask): Promise<any> {
    const { fileId, options } = task.data;
    const reviewOptions: ReviewTaskOptions = options || {
      sourceLanguage: '',
      targetLanguage: ''
    };
    
    if (!fileId || !mongoose.isValidObjectId(fileId)) {
      throw new Error(`Invalid file ID: ${fileId}`);
    }
    
    logger.info(`Starting review for file: ${fileId}`);
    
    // 获取文件信息
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error(`File not found: ${fileId}`);
    }
    
    // 更新文件状态
    const previousStatus = file.status;
    file.status = FileStatus.REVIEWING;
    await file.save();
    
    try {
      // 获取文件中的所有段落
      const query: any = { fileId };
      
      // 添加状态过滤
      if (reviewOptions.includeStatuses && reviewOptions.includeStatuses.length > 0) {
        query.status = { $in: reviewOptions.includeStatuses };
      } else if (reviewOptions.excludeStatuses && reviewOptions.excludeStatuses.length > 0) {
        query.status = { $nin: reviewOptions.excludeStatuses };
      } else if (reviewOptions.onlyNew) {
        // 如果只审校新的段落，排除已经审校过的段落
        query.status = { 
          $nin: [
            SegmentStatus.REVIEW_COMPLETED, 
            SegmentStatus.REVIEW_FAILED,
            SegmentStatus.COMPLETED
          ] 
        };
      }
      
      // 只审校有翻译的段落
      query.translation = { $exists: true, $ne: "" };
      
      const segments = await Segment.find(query).select('_id');
      
      if (segments.length === 0) {
        logger.warn(`No segments found to review in file: ${fileId}`);
        file.status = previousStatus;
        await file.save();
        return { message: 'No segments to review', fileId };
      }
      
      logger.info(`Found ${segments.length} segments to review in file: ${fileId}`);
      
      // 创建批量审校任务
      const batchTask: QueueTask = {
        ...task,
        data: {
          taskType: 'batchSegmentReview',
          segmentIds: segments.map(s => s._id.toString()),
          options: reviewOptions
        } as any
      };
      
      // 处理批量审校
      const result = await this.processBatchSegmentReview(batchTask);
      
      // 更新文件状态
      file.status = FileStatus.COMPLETED;
      await file.save();
      
      return {
        fileId,
        fileName: file.fileName,
        totalSegments: segments.length,
        reviewedSegments: result.successCount,
        failedSegments: result.errorCount,
        status: file.status
      };
    } catch (error: any) {
      // 更新文件状态为失败
      file.status = FileStatus.ERROR;
      await file.save();
      
      logger.error(`Error reviewing file ${fileId}: ${error.message}`, {
        fileId,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }

  /**
   * 处理直接文本审校任务
   */
  private async processTextReview(task: QueueTask): Promise<any> {
    const { 
      originalText, 
      translatedText, 
      options 
    } = task.data;
    
    const reviewOptions: ReviewTaskOptions = options || {
      sourceLanguage: 'auto',
      targetLanguage: 'auto'
    };
    
    // 输入验证
    if (!originalText || typeof originalText !== 'string') {
      throw new Error('Original text is required');
    }
    
    if (!translatedText || typeof translatedText !== 'string') {
      throw new Error('Translated text is required');
    }

    try {
      // 执行AI审校
      logger.info(`Starting direct text AI review using model ${reviewOptions.model || 'default'}`);
      const reviewResult = await aiReviewService.reviewTranslation(
        originalText,
        translatedText,
        {
          sourceLanguage: reviewOptions.sourceLanguage || 'auto',
          targetLanguage: reviewOptions.targetLanguage || 'auto',
          model: reviewOptions.model,
          provider: (reviewOptions.provider || getProviderFromString(reviewOptions.aiProvider)) || AIProvider.OPENAI,
          customPrompt: reviewOptions.customPrompt,
          contextSegments: reviewOptions.contextSegments
        }
      );
      
      // 统计和分析
      const issueCount = reviewResult.issues.length;
      const overallScore = this.getOverallScore(reviewResult.scores);
      const modificationDegree = reviewResult.metadata.modificationDegree;
      
      logger.info(`Direct text AI review completed successfully`, {
        issueCount,
        overallScore,
        modificationDegree
      });
      
      return {
        ...reviewResult,
        statistics: {
          originalLength: originalText.length,
          translatedLength: translatedText.length,
          suggestedLength: reviewResult.suggestedTranslation.length,
          issueCount,
          overallScore,
          modificationDegree
        }
      };
    } catch (error: any) {
      logger.error(`Direct text AI review failed: ${error.message}`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * 保存审校结果到段落
   */
  private async saveReviewResult(segment: ISegment, reviewResult: any): Promise<void> {
    // 保存建议的翻译
    if (!segment.reviewResult) {
      segment.reviewResult = {
        originalTranslation: segment.translation || '',
        reviewDate: new Date(),
        issues: [],
        scores: []
      };
    }

    segment.reviewResult.suggestedTranslation = reviewResult.suggestedTranslation;
    segment.reviewResult.aiReviewer = reviewResult.metadata.model;
    segment.reviewResult.modificationDegree = reviewResult.metadata.modificationDegree;

    // 保存评分
    const scores = reviewResult.scores.map((score: any) => ({
      type: score.type,
      score: score.score,
      details: score.details
    }));

    segment.reviewResult.scores = scores;

    // 保存问题
    if (!segment.issues) {
      segment.issues = [];
    }

    // 保存问题
    for (const issueData of reviewResult.issues) {
      segment.issues.push({
        type: issueData.type,
        description: issueData.description,
        position: issueData.position,
        suggestion: issueData.suggestion,
        resolved: false,
        createdAt: new Date()
      });
    }

    // 更新段落状态
    segment.status = SegmentStatus.REVIEW_COMPLETED;
    await segment.save();
  }
  
  /**
   * 判断段落状态是否不适合审校
   */
  private isInvalidSegmentStatus(status: SegmentStatus): boolean {
    const validStatuses = [
      SegmentStatus.TRANSLATED, 
      SegmentStatus.REVIEW_PENDING, 
      SegmentStatus.REVIEW_FAILED
    ];
    
    return !validStatuses.includes(status);
  }
  
  /**
   * 从评分中获取总体评分
   */
  private getOverallScore(scores: any[]): number {
    const overallScore = scores.find(s => s.type === 'overall');
    return overallScore ? overallScore.score : this.calculateAverageScore(scores);
  }
  
  /**
   * 计算平均评分
   */
  private calculateAverageScore(scores: any[]): number {
    if (!scores || scores.length === 0) return 0;
    
    const sum = scores.reduce((total, score) => total + score.score, 0);
    return Math.round(sum / scores.length);
  }
  
  /**
   * 带重试功能的段落审校处理
   */
  private async processSegmentReviewWithRetry(task: QueueTask, retries = 0): Promise<any> {
    try {
      return await this.processSegmentReview(task);
    } catch (error: any) {
      if (retries < this.MAX_RETRIES) {
        // 指数退避策略
        const delayMs = Math.pow(2, retries) * 1000;
        logger.warn(`Retrying segment review after ${delayMs}ms (attempt ${retries + 1}/${this.MAX_RETRIES})`, {
          segmentId: task.data.segmentId,
          error: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return this.processSegmentReviewWithRetry(task, retries + 1);
      }
      throw error;
    }
  }
  
  /**
   * 控制并发执行promises
   */
  private async executeConcurrently<T>(promises: Promise<T>[], limit: number): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];
    
    for (const promise of promises) {
      const p = Promise.resolve(promise).then(result => {
        results.push(result);
        executing.splice(executing.indexOf(p), 1);
      });
      
      executing.push(p);
      
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
    
    await Promise.all(executing);
    return results;
  }
}

/**
 * 将字符串转换为AIProvider枚举
 */
function getProviderFromString(provider?: string): AIProvider | undefined {
  if (!provider) return undefined;
  
  switch (provider.toLowerCase()) {
    case 'openai':
      return AIProvider.OPENAI;
    case 'grok':
      return AIProvider.GROK;
    case 'deepseek':
      return AIProvider.DEEPSEEK;
    default:
      return undefined;
  }
} 