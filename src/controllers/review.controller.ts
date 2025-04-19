import { Request, Response, NextFunction } from 'express';
import { SegmentStatus } from '../models/segment.model';
import { ReviewService } from '../services/review.service';
import { AIReviewService } from '../services/ai-review.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { UnauthorizedError, NotFoundError, AppError } from '../utils/errors';
import { QueueTaskType } from '../services/translation/queue/queue-task.interface';
import { TranslationQueueService } from '../services/translation/queue/translation-queue.service';
import { AIProvider } from '../types/ai-service.types';
import logger from '../utils/logger';
import { IIssue, IssueSeverity, IssueStatus } from '../models/segment.model';
import { Types } from 'mongoose';
import { Container } from 'typedi';

// 自定义错误类
class BadRequestError extends AppError {
  constructor(message: string = '请求参数错误') {
    super(message, 400);
  }
}

// Define a custom interface for review options
interface ReviewTaskOptions {
  sourceLanguage: string;
  targetLanguage: string;
  model?: string;
  aiProvider?: string;
  provider?: string; // For backward compatibility
  customPrompt?: string;
  contextSegments?: Array<{
    original: string;
    translation: string;
  }>;
  priority?: number | string;
  preserveFormatting?: boolean;
  useTerminology?: boolean;
}

/**
 * 请求段落审校
 * POST /api/review/segment
 */
async function requestSegmentReview(req: Request, res: Response): Promise<void> {
  const reviewService = Container.get(ReviewService);
  try {
    const { segmentId } = req.params;
    // Use req.body for options if present, otherwise default to empty object
    const options = req.body || {}; 

    if (!segmentId) {
      res.status(400).json({ error: '缺少段落ID' });
      return;
    }

    const userId = (req as AuthRequest).user?.id;
    // Removed userRoles extraction as it wasn't used in the queue path
    // const userRoles = (req as AuthRequest).user?.role ? [(req as AuthRequest).user!.role] : [];
    if (!userId) {
      throw new UnauthorizedError('未授权的访问');
    }

    // Always queue the task (processor currently marks 'segmentReview' as unsupported)
    // Ensure queue service setup is correct if this path is intended to be functional later
    const queueService = new TranslationQueueService({
      processInterval: 1000,
      maxConcurrent: 5,
      maxRetries: 3,
      retryDelay: 5000,
      timeout: 60000,
      priorityLevels: 5
    });

    const taskId = await queueService.addTask({
      type: QueueTaskType.REVIEW,
      priority: options?.priority || 1,
      data: {
        taskType: 'segmentReview', // This type is currently unsupported by the processor
        segmentId,
        userId,
        options: {
          sourceLanguage: options?.sourceLanguage,
          targetLanguage: options?.targetLanguage,
          model: options?.model || 'gpt-3.5-turbo',
          aiProvider: options?.provider || options?.aiProvider || 'openai',
          customPrompt: options?.customPrompt,
          contextSegments: options?.contextSegments
        } as any
      }
    });

    res.status(202).json({
      success: true,
      message: '段落审校任务已提交到队列 (当前处理器不支持)',
      taskId
    });

  } catch (error: any) {
    logger.error('请求段落审校失败', { error });

    if (error.name === 'NotFoundError') {
      res.status(404).json({ error: error.message });
    } else if (error.name === 'UnauthorizedError') {
      res.status(401).json({ error: error.message });
    } else if (error.name === 'BadRequestError') {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message || '请求段落审校失败' });
    }
  }
}

/**
 * 完成段落审校
 * POST /api/review/segment/complete
 */
/*
async function completeSegmentReview(req: Request, res: Response): Promise<void> {
  const reviewService = Container.get(ReviewService);
  try {
    const { segmentId, finalTranslation, acceptedChanges, modificationDegree } = req.body;

    if (!segmentId || !finalTranslation) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }

    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new UnauthorizedError('未授权的访问');
    }

    const reviewData = {
      finalTranslation,
      acceptedChanges,
      modificationDegree
    };

    logger.info(`Completing segment review for segment ${segmentId}`);
    const segment = await reviewService.completeSegmentReview(segmentId, userId, reviewData);

    res.status(200).json({
      success: true,
      message: '段落审校已完成',
      data: segment
    });
  } catch (error: any) {
    logger.error('完成段落审校失败', { error });

    if (error.name === 'NotFoundError') {
      res.status(404).json({ error: error.message });
    } else if (error.name === 'UnauthorizedError') {
      res.status(401).json({ error: error.message });
    } else if (error.name === 'BadRequestError') {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message || '完成段落审校失败' });
    }
  }
}
*/

/**
 * 获取段落审校结果
 * GET /api/review/segment/:segmentId
 */
/*
async function getSegmentReviewResult(req: Request, res: Response): Promise<void> {
  const reviewService = Container.get(ReviewService);
  try {
    const { segmentId } = req.params;

    if (!segmentId) {
      res.status(400).json({ error: '缺少段落ID' });
      return;
    }

    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new UnauthorizedError('未授权的访问');
    }

    logger.info(`Getting segment review result for segment ${segmentId}`);
    const result = await reviewService.getSegmentReviewResult(segmentId, userId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('获取段落审校结果失败', { error });

    if (error.name === 'NotFoundError') {
      res.status(404).json({ error: error.message });
    } else if (error.name === 'UnauthorizedError') {
      res.status(401).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message || '获取段落审校结果失败' });
    }
  }
}
*/

/**
 * 确认段落审校
 * POST /api/review/segment/:segmentId/finalize
 */
/*
async function finalizeSegmentReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  const reviewService = Container.get(ReviewService);
  try {
    const { segmentId } = req.params;

    if (!segmentId) {
      // Use next for consistency if preferred
      res.status(400).json({ error: '缺少段落ID' });
      return;
    }

    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new UnauthorizedError('未授权的访问');
    }

    logger.info(`Finalizing segment review for segment ${segmentId}`);
    const segment = await reviewService.finalizeSegmentReview(segmentId, userId);

    res.status(200).json({
      success: true,
      message: '段落审校已确认',
      data: segment
    });
  } catch (error: any) {
    logger.error('确认段落审校失败', { error });
    next(error); // Pass to error handler
  }
}
*/

/**
 * 添加段落问题
 * POST /api/review/segment/issue
 */
/*
async function addSegmentIssue(req: Request, res: Response): Promise<void> {
  const reviewService = Container.get(ReviewService);
  try {
    const { segmentId, type, description, position, suggestion, severity } = req.body;

    if (!segmentId || !type || !description || !severity) {
      res.status(400).json({ error: '缺少必要参数 (segmentId, type, description, severity)' });
      return;
    }

    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new UnauthorizedError('未授权的访问');
    }

    const issueData: IIssue = {
      type,
      description,
      position,
      suggestion,
      severity: severity as IssueSeverity,
      status: IssueStatus.OPEN,
      createdBy: new Types.ObjectId(userId),
      createdAt: new Date()
    };

    logger.info(`Adding issue to segment ${segmentId}`);
    const issue = await reviewService.addSegmentIssue(segmentId, userId, issueData);

    res.status(200).json({
      success: true,
      message: '问题已添加',
      data: issue
    });
  } catch (error: any) {
    logger.error('添加段落问题失败', { error });

    if (error.name === 'NotFoundError') {
      res.status(404).json({ error: error.message });
    } else if (error.name === 'UnauthorizedError') {
      res.status(401).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message || '添加段落问题失败' });
    }
  }
}
*/

/**
 * 解决段落问题
 * PUT /api/review/segment/issue/:issueId/resolve
 */
/*
async function resolveSegmentIssue(req: Request, res: Response): Promise<void> {
  const reviewService = Container.get(ReviewService);
  try {
    const { segmentId, issueId } = req.params;
    const { resolution } = req.body;

    if (!segmentId || !issueId || !resolution) {
      res.status(400).json({ error: '缺少必要参数 (segmentId, issueId, resolution)' });
      return;
    }

    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new UnauthorizedError('未授权的访问');
    }

    const issueIndex = parseInt(issueId, 10);
    if (isNaN(issueIndex)) {
        res.status(400).json({ error: '无效的 Issue ID (应为数字索引)' });
        return;
    }

    logger.info(`Resolving issue index ${issueIndex} for segment ${segmentId}`);
    const segment = await reviewService.resolveSegmentIssue(segmentId, issueIndex, userId, resolution);

    res.status(200).json({
      success: true,
      message: '问题已解决',
      data: segment
    });
  } catch (error: any) {
    logger.error('解决段落问题失败', { error });

    if (error.name === 'NotFoundError') {
      res.status(404).json({ error: error.message });
    } else if (error.name === 'UnauthorizedError') {
      res.status(401).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message || '解决段落问题失败' });
    }
  }
}
*/

/**
 * 直接审校文本
 * POST /api/review/text
 */
async function reviewTextDirectly(req: Request, res: Response): Promise<void> {
  const reviewService = Container.get(ReviewService);
  const aiReviewService = Container.get(AIReviewService);
  try {
    const { original, translation, sourceLanguage, targetLanguage, model, customPrompt } = req.body;

    if (!original || !translation) {
      res.status(400).json({ error: '缺少原文或译文' });
      return;
    }

    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new UnauthorizedError('未授权的访问');
    }

    // 获取API密钥（在实际应用中应该有更安全的方式获取）
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('未配置API密钥');
    }

    // 使用AI审校服务直接审校文本
    logger.info('Starting direct text review');
    const reviewOptions = {
      sourceLanguage: sourceLanguage || 'en',
      targetLanguage: targetLanguage || 'zh-CN',
      model: model || 'gpt-3.5-turbo',
      provider: AIProvider.OPENAI,
      apiKey,
      customPrompt: customPrompt
    };

    const result = await aiReviewService.reviewText(original, translation, reviewOptions);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('直接审校文本失败', { error });
    res.status(500).json({ error: error.message || '直接审校文本失败' });
  }
}

/**
 * 获取支持的审校模型
 * GET /api/review/models
 */
async function getSupportedReviewModels(req: Request, res: Response): Promise<void> {
  try {
    // Get AIReviewService instance
    const aiReviewService = Container.get(AIReviewService);

    // 获取用户身份
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new UnauthorizedError('未授权的访问');
    }

    // 获取查询参数
    const provider = (req.query.provider as string) || 'openai';

    // 映射提供商字符串到枚举
    let aiProvider: AIProvider;
    switch (provider.toLowerCase()) {
      case 'openai':
        aiProvider = AIProvider.OPENAI;
        break;
      case 'baidu':
        aiProvider = AIProvider.BAIDU;
        break;
      case 'aliyun':
        aiProvider = AIProvider.ALIYUN;
        break;
      default:
        aiProvider = AIProvider.OPENAI;
    }

    // 使用AI审校服务获取支持的模型
    logger.info(`Getting supported models for provider: ${provider}`);
    const models = await aiReviewService.getSupportedModels(aiProvider);

    res.status(200).json({
      success: true,
      data: models
    });
  } catch (error: any) {
    logger.error('获取支持的审校模型失败', { error });
    res.status(500).json({ error: error.message || '获取支持的审校模型失败' });
  }
}

/**
 * 将段落提交到审校队列
 * POST /api/review/queue/segment
 */
async function queueSegmentReview(req: Request, res: Response): Promise<void> {
  try {
    const { segmentId, options } = req.body;

    if (!segmentId) {
      res.status(400).json({ error: '缺少段落ID' });
      return;
    }

    // Create an instance of the queue service for this request
    const queueService = new TranslationQueueService({
      processInterval: 1000,
      maxConcurrent: 5,
      maxRetries: 3,
      retryDelay: 5000,
      timeout: 60000,
      priorityLevels: 5
    });

    // 添加审校任务到队列
    const taskId = await queueService.addTask({
      type: QueueTaskType.REVIEW,
      priority: options?.priority || 1,
      data: {
        taskType: 'segmentReview',
        segmentId,
        options: {
          sourceLanguage: options?.sourceLanguage,
          targetLanguage: options?.targetLanguage,
          model: options?.model || 'gpt-3.5-turbo',
          aiProvider: options?.provider || options?.aiProvider || 'openai',
          customPrompt: options?.customPrompt,
          contextSegments: options?.contextSegments
        } as any
      }
    });

    res.status(202).json({
      message: '审校任务已提交到队列',
      taskId
    });
  } catch (error: any) {
    console.error('提交审校任务失败:', error);
    res.status(500).json({ error: error.message || '提交审校任务失败' });
  }
}

/**
 * 提交文本审校任务到队列
 * POST /api/review/queue/text
 */
async function queueTextReview(req: Request, res: Response): Promise<void> {
  try {
    const { originalText, translatedText, options } = req.body;

    if (!originalText || !translatedText) {
      res.status(400).json({ error: '原文和译文不能为空' });
      return;
    }

    // Create an instance of the queue service for this request
    const queueService = new TranslationQueueService({
      processInterval: 1000,
      maxConcurrent: 5,
      maxRetries: 3,
      retryDelay: 5000,
      timeout: 60000,
      priorityLevels: 5
    });

    // 添加文本审校任务到队列
    const taskId = await queueService.addTask({
      type: QueueTaskType.REVIEW,
      priority: options?.priority || 1,
      data: {
        taskType: 'textReview',
        originalText,
        translatedText,
        options: {
          sourceLanguage: options?.sourceLanguage || 'auto',
          targetLanguage: options?.targetLanguage || 'auto',
          model: options?.model || 'gpt-3.5-turbo',
          aiProvider: options?.provider || options?.aiProvider || 'openai',
          customPrompt: options?.customPrompt
        } as any
      }
    });

    res.status(202).json({
      message: '文本审校任务已提交到队列',
      taskId
    });
  } catch (error: any) {
    console.error('提交文本审校任务失败:', error);
    res.status(500).json({ error: error.message || '提交文本审校任务失败' });
  }
}

/**
 * 提交批量段落审校任务到队列
 * POST /api/review/queue/batch
 */
async function queueBatchSegmentReview(req: Request, res: Response): Promise<void> {
  try {
    const { segmentIds, options } = req.body;

    if (!segmentIds || !Array.isArray(segmentIds) || segmentIds.length === 0) {
      res.status(400).json({ error: '缺少有效的段落ID列表' });
      return;
    }

    // Create an instance of the queue service for this request
    const queueService = new TranslationQueueService({
      processInterval: 1000,
      maxConcurrent: 5,
      maxRetries: 3,
      retryDelay: 5000,
      timeout: 60000,
      priorityLevels: 5
    });

    // 添加批量审校任务到队列
    const taskId = await queueService.addTask({
      type: QueueTaskType.REVIEW,
      priority: options?.priority || 1,
      data: {
        taskType: 'batchSegmentReview',
        segmentIds,
        options: {
          sourceLanguage: options?.sourceLanguage,
          targetLanguage: options?.targetLanguage,
          model: options?.model || 'gpt-3.5-turbo',
          aiProvider: options?.provider || options?.aiProvider || 'openai',
          customPrompt: options?.customPrompt,
          contextSegments: options?.contextSegments,
          batchSize: options?.batchSize || 10,
          concurrentLimit: options?.concurrentLimit || 5,
          stopOnError: options?.stopOnError || false,
          onlyNew: options?.onlyNew || false,
          includeStatuses: options?.includeStatuses,
          excludeStatuses: options?.excludeStatuses
        } as any
      }
    });

    res.status(202).json({
      message: `批量审校任务已提交到队列，共 ${segmentIds.length} 个段落`,
      taskId
    });
  } catch (error: any) {
    console.error('提交批量审校任务失败:', error);
    res.status(500).json({ error: error.message || '提交批量审校任务失败' });
  }
}

/**
 * 提交文件审校任务到队列
 * POST /api/review/queue/file
 */
async function queueFileReview(req: Request, res: Response): Promise<void> {
  try {
    const { fileId, options } = req.body;

    if (!fileId) {
      res.status(400).json({ error: '缺少文件ID' });
      return;
    }

    // Create an instance of the queue service for this request
    const queueService = new TranslationQueueService({
      processInterval: 1000,
      maxConcurrent: 5,
      maxRetries: 3,
      retryDelay: 5000,
      timeout: 60000,
      priorityLevels: 5
    });

    // 添加文件审校任务到队列
    const taskId = await queueService.addTask({
      type: QueueTaskType.REVIEW,
      priority: options?.priority || 1,
      data: {
        taskType: 'fileReview',
        fileId,
        options: {
          sourceLanguage: options?.sourceLanguage,
          targetLanguage: options?.targetLanguage,
          model: options?.model || 'gpt-3.5-turbo',
          aiProvider: options?.provider || options?.aiProvider || 'openai',
          customPrompt: options?.customPrompt,
          onlyNew: options?.onlyNew || true,
          includeStatuses: options?.includeStatuses,
          excludeStatuses: options?.excludeStatuses,
          batchSize: options?.batchSize || 10,
          concurrentLimit: options?.concurrentLimit || 5,
          stopOnError: options?.stopOnError || false
        } as any
      }
    });

    res.status(202).json({
      message: '文件审校任务已提交到队列',
      taskId,
      fileId
    });
  } catch (error: any) {
    console.error('提交文件审校任务失败:', error);
    res.status(500).json({ error: error.message || '提交文件审校任务失败' });
  }
}

/**
 * 获取队列任务状态
 * GET /api/review/queue/status/:taskId
 */
async function getReviewTaskStatus(req: Request, res: Response): Promise<void> {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      res.status(400).json({ error: '缺少任务ID' });
      return;
    }

    // Create an instance of the queue service for this request
    const queueService = new TranslationQueueService({
      processInterval: 1000,
      maxConcurrent: 5,
      maxRetries: 3,
      retryDelay: 5000,
      timeout: 60000,
      priorityLevels: 5
    });

    const task = await queueService.getTask(taskId);

    if (!task) {
      res.status(404).json({ error: '任务不存在' });
      return;
    }

    res.status(200).json({
      taskId: task.id,
      status: task.status,
      type: task.type,
      dataType: task.data.taskType,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      error: task.error,
      result: task.result
    });
  } catch (error: any) {
    console.error('获取任务状态失败:', error);
    res.status(500).json({ error: error.message || '获取任务状态失败' });
  }
}

/**
 * 取消队列任务
 * DELETE /api/review/queue/:taskId
 */
async function cancelReviewTask(req: Request, res: Response): Promise<void> {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      res.status(400).json({ error: '缺少任务ID' });
      return;
    }

    // Create an instance of the queue service for this request
    const queueService = new TranslationQueueService({
      processInterval: 1000,
      maxConcurrent: 5,
      maxRetries: 3,
      retryDelay: 5000,
      timeout: 60000,
      priorityLevels: 5
    });

    await queueService.cancelTask(taskId);

    res.status(200).json({
      message: '任务已取消',
      taskId
    });
  } catch (error: any) {
    console.error('取消任务失败:', error);
    res.status(500).json({ error: error.message || '取消任务失败' });
  }
}

/**
 * 获取文件下待审校的段落列表 (支持分页)
 * GET /api/review/files/:fileId/segments
 */
async function getReviewableSegments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const methodName = 'getReviewableSegments';
  const reviewService = Container.get(ReviewService);
  try {
    const { fileId } = req.params;
    const userId = req.user?.id;

    if (!fileId) {
      return next(new BadRequestError('File ID is required in the URL path.'));
    }
    if (!userId) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // Extract and validate pagination parameters from query string
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    if (isNaN(page) || page < 1) {
        return next(new BadRequestError('Invalid page number provided.'));
    }
    if (isNaN(limit) || limit < 1 || limit > 100) { // Add max limit
        return next(new BadRequestError('Invalid limit provided (must be between 1 and 100).'));
    }

    const paginationOptions = { page, limit };

    logger.info(`[${methodName}] Fetching reviewable segments for file ${fileId}, page ${page}, limit ${limit} by user ${userId}`);
    // Restore @ts-expect-error
    // @ts-expect-error // Linter fails to detect existing service method
    const result_segments = await reviewService.getSegmentsForReview(fileId, userId, paginationOptions);

    res.status(200).json({
      success: true,
      message: 'Successfully retrieved reviewable segments',
      data: result_segments.segments,
      pagination: {
        total: result_segments.total,
        page: result_segments.page,
        limit: result_segments.limit,
        totalPages: Math.ceil(result_segments.total / result_segments.limit)
      }
    });
  } catch (error: any) {
    logger.error(`Error in ${methodName} for file ${req.params.fileId}:`, error);
    next(error); // Pass error to the central handler
  }
}

/**
 * 最终确认整个文件的审校 (Manager only)
 * POST /api/review/files/:fileId/finalize
 */
/*
async function finalizeFileReview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const methodName = 'finalizeFileReview';
  const reviewService = Container.get(ReviewService);
  try {
    const { fileId } = req.params;
    const userId = req.user?.id;

    if (!fileId) {
      return next(new BadRequestError('File ID is required in the URL path.'));
    }
    if (!userId) {
      return next(new UnauthorizedError('Authentication required'));
    }

    logger.info(`[${methodName}] User ${userId} attempting to finalize review for file ${fileId}`);
    // Assuming reviewService.finalizeFileReview exists and handles logic/errors
    const updatedFile = await reviewService.finalizeFileReview(fileId, userId);

    res.status(200).json({
      success: true,
      message: 'File review finalized successfully.',
      data: updatedFile // Return the updated file details
    });

  } catch (error: any) {
    logger.error(`Error in ${methodName} for file ${req.params.fileId}:`, error);
    next(error); // Pass error to the central handler
  }
}
*/

// Export remaining functions
export {
    requestSegmentReview,
    // completeSegmentReview, // Commented out
    // getSegmentReviewResult, // Commented out
    // finalizeSegmentReview, // Commented out
    // addSegmentIssue, // Commented out
    // resolveSegmentIssue, // Commented out
    // batchUpdateSegmentStatus, // Commented out
    reviewTextDirectly,
    getSupportedReviewModels,
    queueSegmentReview,
    queueTextReview,
    queueBatchSegmentReview,
    queueFileReview,
    getReviewTaskStatus,
    cancelReviewTask,
    getReviewableSegments, // Kept (assumes service method exists/will exist)
    // finalizeFileReview // Commented out
};