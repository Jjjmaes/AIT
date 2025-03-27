import { Request, Response, NextFunction } from 'express';
import { SegmentStatus } from '../models/segment.model';
import reviewService from '../services/review.service';
import aiReviewService from '../services/ai-review.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { UnauthorizedError, NotFoundError, AppError } from '../utils/errors';
import { QueueTaskType } from '../services/translation/queue/queue-task.interface';
import { TranslationQueueService } from '../services/translation/queue/translation-queue.service';
import { AIProvider } from '../types/ai-service.types';
import logger from '../utils/logger';

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
export async function requestSegmentReview(req: Request, res: Response): Promise<void> {
  try {
    const { segmentId, options } = req.body;
    
    if (!segmentId) {
      res.status(400).json({ error: '缺少段落ID' });
      return;
    }
    
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new UnauthorizedError('未授权的访问');
    }
    
    // 如果传递了直接审校的选项，则直接调用审校服务执行审校
    if (options?.immediate) {
      const reviewOptions = {
        promptTemplateId: options.promptTemplateId,
        aiModel: options.model || options.aiModel || 'gpt-3.5-turbo'
      };
      
      logger.info(`Starting immediate segment review for segment ${segmentId}`);
      const segment = await reviewService.startAIReview(segmentId, userId, reviewOptions);
      
      res.status(200).json({
        success: true,
        message: '段落审校已完成',
        data: segment
      });
    } else {
      // 否则加入到队列中
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
          taskType: 'segmentReview',
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
        message: '段落审校任务已提交到队列',
        taskId
      });
    }
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
export async function completeSegmentReview(req: Request, res: Response): Promise<void> {
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

/**
 * 获取段落审校结果
 * GET /api/review/segment/:segmentId
 */
export async function getSegmentReviewResult(req: Request, res: Response): Promise<void> {
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

/**
 * 确认段落审校
 * POST /api/review/segment/:segmentId/finalize
 */
export async function finalizeSegmentReview(req: Request, res: Response): Promise<void> {
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
    
    logger.info(`Finalizing segment review for segment ${segmentId}`);
    const segment = await reviewService.finalizeSegmentReview(segmentId, userId);
    
    res.status(200).json({
      success: true,
      message: '段落审校已确认',
      data: segment
    });
  } catch (error: any) {
    logger.error('确认段落审校失败', { error });
    
    if (error.name === 'NotFoundError') {
      res.status(404).json({ error: error.message });
    } else if (error.name === 'UnauthorizedError') {
      res.status(401).json({ error: error.message });
    } else if (error.name === 'BadRequestError') {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message || '确认段落审校失败' });
    }
  }
}

/**
 * 添加段落问题
 * POST /api/review/segment/issue
 */
export async function addSegmentIssue(req: Request, res: Response): Promise<void> {
  try {
    const { segmentId, type, description, position, suggestion } = req.body;
    
    if (!segmentId || !type || !description) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }
    
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new UnauthorizedError('未授权的访问');
    }
    
    const issueData = {
      type,
      description,
      position,
      suggestion
    };
    
    logger.info(`Adding issue to segment ${segmentId}`);
    const segment = await reviewService.addSegmentIssue(segmentId, userId, issueData);
    
    res.status(200).json({
      success: true,
      message: '问题已添加',
      data: segment
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

/**
 * 解决段落问题
 * PUT /api/review/segment/issue/:issueId/resolve
 */
export async function resolveSegmentIssue(req: Request, res: Response): Promise<void> {
  try {
    const { segmentId, issueId } = req.params;
    
    if (!segmentId || !issueId) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }
    
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new UnauthorizedError('未授权的访问');
    }
    
    logger.info(`Resolving issue ${issueId} for segment ${segmentId}`);
    const segment = await reviewService.resolveSegmentIssue(segmentId, issueId, userId);
    
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

/**
 * 批量更新段落状态
 * POST /api/review/segment/batch-status
 */
export async function batchUpdateSegmentStatus(req: Request, res: Response): Promise<void> {
  try {
    const { segmentIds, status } = req.body;
    
    if (!segmentIds || !Array.isArray(segmentIds) || segmentIds.length === 0 || !status) {
      res.status(400).json({ error: '缺少必要参数' });
      return;
    }
    
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      throw new UnauthorizedError('未授权的访问');
    }
    
    logger.info(`Batch updating status for ${segmentIds.length} segments to ${status}`);
    const result = await reviewService.batchUpdateSegmentStatus(segmentIds, userId, status);
    
    res.status(200).json({
      success: true,
      message: `已更新 ${result.modifiedCount} 个段落的状态`,
      data: {
        updatedCount: result.modifiedCount,
        skippedCount: segmentIds.length - result.modifiedCount
      }
    });
  } catch (error: any) {
    logger.error('批量更新段落状态失败', { error });
    
    if (error.name === 'UnauthorizedError') {
      res.status(401).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message || '批量更新段落状态失败' });
    }
  }
}

/**
 * 直接审校文本
 * POST /api/review/text
 */
export async function reviewTextDirectly(req: Request, res: Response): Promise<void> {
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
export async function getSupportedReviewModels(req: Request, res: Response): Promise<void> {
  try {
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
export async function queueSegmentReview(req: Request, res: Response): Promise<void> {
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
export async function queueTextReview(req: Request, res: Response): Promise<void> {
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
export async function queueBatchSegmentReview(req: Request, res: Response): Promise<void> {
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
export async function queueFileReview(req: Request, res: Response): Promise<void> {
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
export async function getReviewTaskStatus(req: Request, res: Response): Promise<void> {
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
export async function cancelReviewTask(req: Request, res: Response): Promise<void> {
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