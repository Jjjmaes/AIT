// src/routes/review.routes.ts

import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import * as segmentValidator from '../validators/segmentValidator';
import { validateRequest } from '../middleware/validate.middleware';
import { 
  queueSegmentReview, 
  queueTextReview, 
  getReviewTaskStatus,
  queueBatchSegmentReview,
  queueFileReview,
  cancelReviewTask
} from '../controllers/review.controller';
import logger from '../utils/logger';

// 创建路由器实例
const router = Router();

// Placeholder functions for routes not yet implemented
const requestSegmentReview = async (req: Request, res: Response) => {
  res.json({ message: 'This functionality is still being developed' });
};

const completeSegmentReview = async (req: Request, res: Response) => {
  res.json({ message: 'This functionality is still being developed' });
};

const getSegmentReviewResult = async (req: Request, res: Response) => {
  res.json({ message: 'This functionality is still being developed' });
};

const finalizeSegmentReview = async (req: Request, res: Response) => {
  res.json({ message: 'This functionality is still being developed' });
};

const addSegmentIssue = async (req: Request, res: Response) => {
  res.json({ message: 'This functionality is still being developed' });
};

const resolveSegmentIssue = async (req: Request, res: Response) => {
  res.json({ message: 'This functionality is still being developed' });
};

const batchUpdateSegmentStatus = async (req: Request, res: Response) => {
  res.json({ message: 'This functionality is still being developed' });
};

const reviewTextDirectly = async (req: Request, res: Response) => {
  res.json({ message: 'This functionality is still being developed' });
};

const getSupportedReviewModels = async (req: Request, res: Response) => {
  res.json({ message: 'This functionality is still being developed' });
};

// 审校路由
// 段落审校相关路由
router.post('/segment', authenticateJwt, requestSegmentReview);
router.post('/segment/complete', authenticateJwt, validateRequest(segmentValidator.validateCompleteSegmentReview), completeSegmentReview);
router.get('/segment/:segmentId', authenticateJwt, getSegmentReviewResult);
router.post('/segment/:segmentId/finalize', authenticateJwt, finalizeSegmentReview);

// 段落问题相关路由
router.post('/segment/issue', authenticateJwt, validateRequest(segmentValidator.validateAddSegmentIssue), addSegmentIssue);
router.put('/segment/issue/:issueId/resolve', authenticateJwt, validateRequest(segmentValidator.validateResolveSegmentIssue), resolveSegmentIssue);

// 批量更新段落状态
router.post('/segment/batch-status', authenticateJwt, validateRequest(segmentValidator.validateBatchUpdateSegmentStatus), batchUpdateSegmentStatus);

// 直接审校文本
router.post('/text', authenticateJwt, validateRequest(segmentValidator.validateDirectTextReview), reviewTextDirectly);

// 队列相关路由
router.post('/queue/segment', authenticateJwt, validateRequest(segmentValidator.validateReviewSegment), queueSegmentReview);
router.post('/queue/text', authenticateJwt, validateRequest(segmentValidator.validateDirectTextReview), queueTextReview);
router.post('/queue/batch', authenticateJwt, validateRequest(segmentValidator.validateBatchSegmentReview), queueBatchSegmentReview);
router.post('/queue/file', authenticateJwt, validateRequest(segmentValidator.validateFileReview), queueFileReview);
router.get('/queue/status/:taskId', authenticateJwt, getReviewTaskStatus);
router.delete('/queue/:taskId', authenticateJwt, cancelReviewTask);

// 获取支持的审校模型
router.get('/models', authenticateJwt, getSupportedReviewModels);

// 记录路由注册
logger.info('Review routes registered');

// 导出路由器
export default router; 