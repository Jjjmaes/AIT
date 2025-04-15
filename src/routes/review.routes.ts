// src/routes/review.routes.ts

import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import * as segmentValidator from '../validators/segmentValidator';
import { validateRequest } from '../middleware/validate.middleware';
import * as reviewController from '../controllers/review.controller';
import logger from '../utils/logger';

// 创建路由器实例
const router = Router();

// 审校路由
// 段落审校相关路由
router.post('/segment', reviewController.requestSegmentReview);
router.post('/segment/complete', validateRequest(segmentValidator.validateCompleteSegmentReview), reviewController.completeSegmentReview);
router.get('/segment/:segmentId', reviewController.getSegmentReviewResult);
router.post('/segment/:segmentId/finalize', reviewController.finalizeSegmentReview);

// 段落问题相关路由
router.post('/segment/issue', validateRequest(segmentValidator.validateAddSegmentIssue), reviewController.addSegmentIssue);
router.put('/segment/issue/:issueId/resolve', validateRequest(segmentValidator.validateResolveSegmentIssue), reviewController.resolveSegmentIssue);

// 批量更新段落状态
router.post('/segment/batch-status', validateRequest(segmentValidator.validateBatchUpdateSegmentStatus), reviewController.batchUpdateSegmentStatus);

// 直接审校文本
router.post('/text', validateRequest(segmentValidator.validateDirectTextReview), reviewController.reviewTextDirectly);

// 队列相关路由
router.post('/queue/segment', authenticateJwt, validateRequest(segmentValidator.validateReviewSegment), reviewController.queueSegmentReview);
router.post('/queue/text', authenticateJwt, validateRequest(segmentValidator.validateDirectTextReview), reviewController.queueTextReview);
router.post('/queue/batch', authenticateJwt, validateRequest(segmentValidator.validateBatchSegmentReview), reviewController.queueBatchSegmentReview);
router.post('/queue/file', authenticateJwt, validateRequest(segmentValidator.validateFileReview), reviewController.queueFileReview);
router.get('/queue/status/:taskId', authenticateJwt, reviewController.getReviewTaskStatus);
router.delete('/queue/:taskId', authenticateJwt, reviewController.cancelReviewTask);

// 获取支持的审校模型
router.get('/models', reviewController.getSupportedReviewModels);

// 获取可审校段落
router.get(
    '/files/:fileId/segments',
    reviewController.getReviewableSegments
);

// 文件结束审校
router.post('/files/:fileId/finalize', authenticateJwt, reviewController.finalizeFileReview);

// 记录路由注册
logger.info('Review routes updated to use namespace import for controller');

// 导出路由器
export default router; 