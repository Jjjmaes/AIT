// src/routes/review.routes.ts

import express from 'express';
import * as reviewController from '../controllers/review.controller';
import { authenticateJwt } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import * as segmentValidator from '../validators/segmentValidator';
import logger from '../utils/logger';

const router = express.Router();

// === Segment Review Routes ===

// Request a review for a single segment (queues it - processor currently ignores)
router.post('/segment/:segmentId/request', authenticateJwt, reviewController.requestSegmentReview);

// === Segment Issue Routes ===

// === Batch Segment Routes ===

// Fetch reviewable segments (kept, assumes service method exists/will exist)
router.get('/files/:fileId/segments', authenticateJwt, reviewController.getReviewableSegments);

// === File Review Routes ===

// === Direct Text Review ===
router.post('/text', authenticateJwt, reviewController.reviewTextDirectly);

// === Model Info ===
router.get('/models', authenticateJwt, reviewController.getSupportedReviewModels);

// === Queue Management Routes ===
router.post('/queue/segment', authenticateJwt, reviewController.queueSegmentReview);
router.post('/queue/text', authenticateJwt, reviewController.queueTextReview);
router.post('/queue/batch', authenticateJwt, reviewController.queueBatchSegmentReview);
router.post('/queue/file', authenticateJwt, reviewController.queueFileReview);
router.get('/queue/status/:taskId', authenticateJwt, reviewController.getReviewTaskStatus);
router.delete('/queue/:taskId', authenticateJwt, reviewController.cancelReviewTask);

// 记录路由注册
logger.info('Review routes updated to use namespace import for controller');

// 导出路由器
export default router; 