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
const reviewController = __importStar(require("../controllers/review.controller"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const segmentValidator = __importStar(require("../validators/segmentValidator"));
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// 请求段落AI审校
router.post('/segments/:segmentId/review', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(segmentValidator.validateReviewSegment), reviewController.requestSegmentReview);
// 完成段落审校
router.put('/segments/:segmentId/review', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(segmentValidator.validateCompleteSegmentReview), reviewController.completeSegmentReview);
// 获取段落审校结果
router.get('/segments/:segmentId/review', auth_middleware_1.authenticateJwt, reviewController.getSegmentReviewResult);
// 确认段落审校
router.post('/segments/:segmentId/approve', auth_middleware_1.authenticateJwt, reviewController.finalizeSegmentReview);
// 添加段落问题
router.post('/segments/:segmentId/issues', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(segmentValidator.validateAddSegmentIssue), reviewController.addSegmentIssue);
// 解决段落问题
router.put('/segments/:segmentId/issues/:issueId/resolve', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(segmentValidator.validateResolveSegmentIssue), reviewController.resolveSegmentIssue);
// 批量更新段落状态
router.put('/segments/batch/status', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)(segmentValidator.validateBatchUpdateSegmentStatus), reviewController.batchUpdateSegmentStatus);
logger_1.default.info('Review routes registered');
exports.default = router;
