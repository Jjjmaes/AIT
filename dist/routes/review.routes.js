"use strict";
// src/routes/review.routes.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const segmentValidator = __importStar(require("../validators/segmentValidator"));
const validate_middleware_1 = require("../middleware/validate.middleware");
const review_controller_1 = require("../controllers/review.controller");
const logger_1 = __importDefault(require("../utils/logger"));
// 创建路由器实例
const router = (0, express_1.Router)();
// Placeholder functions for routes not yet implemented
const requestSegmentReview = async (req, res) => {
    res.json({ message: 'This functionality is still being developed' });
};
const completeSegmentReview = async (req, res) => {
    res.json({ message: 'This functionality is still being developed' });
};
const getSegmentReviewResult = async (req, res) => {
    res.json({ message: 'This functionality is still being developed' });
};
const finalizeSegmentReview = async (req, res) => {
    res.json({ message: 'This functionality is still being developed' });
};
const addSegmentIssue = async (req, res) => {
    res.json({ message: 'This functionality is still being developed' });
};
const resolveSegmentIssue = async (req, res) => {
    res.json({ message: 'This functionality is still being developed' });
};
const batchUpdateSegmentStatus = async (req, res) => {
    res.json({ message: 'This functionality is still being developed' });
};
const reviewTextDirectly = async (req, res) => {
    res.json({ message: 'This functionality is still being developed' });
};
const getSupportedReviewModels = async (req, res) => {
    res.json({ message: 'This functionality is still being developed' });
};
// 审校路由
// 段落审校相关路由
router.post('/segment', auth_middleware_1.authenticateJwt, requestSegmentReview);
router.post('/segment/complete', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(segmentValidator.validateCompleteSegmentReview), completeSegmentReview);
router.get('/segment/:segmentId', auth_middleware_1.authenticateJwt, getSegmentReviewResult);
router.post('/segment/:segmentId/finalize', auth_middleware_1.authenticateJwt, finalizeSegmentReview);
// 段落问题相关路由
router.post('/segment/issue', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(segmentValidator.validateAddSegmentIssue), addSegmentIssue);
router.put('/segment/issue/:issueId/resolve', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(segmentValidator.validateResolveSegmentIssue), resolveSegmentIssue);
// 批量更新段落状态
router.post('/segment/batch-status', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(segmentValidator.validateBatchUpdateSegmentStatus), batchUpdateSegmentStatus);
// 直接审校文本
router.post('/text', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(segmentValidator.validateDirectTextReview), reviewTextDirectly);
// 队列相关路由
router.post('/queue/segment', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(segmentValidator.validateReviewSegment), review_controller_1.queueSegmentReview);
router.post('/queue/text', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(segmentValidator.validateDirectTextReview), review_controller_1.queueTextReview);
router.post('/queue/batch', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(segmentValidator.validateBatchSegmentReview), review_controller_1.queueBatchSegmentReview);
router.post('/queue/file', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(segmentValidator.validateFileReview), review_controller_1.queueFileReview);
router.get('/queue/status/:taskId', auth_middleware_1.authenticateJwt, review_controller_1.getReviewTaskStatus);
router.delete('/queue/:taskId', auth_middleware_1.authenticateJwt, review_controller_1.cancelReviewTask);
// 获取支持的审校模型
router.get('/models', auth_middleware_1.authenticateJwt, getSupportedReviewModels);
// 记录路由注册
logger_1.default.info('Review routes registered');
// 导出路由器
exports.default = router;
