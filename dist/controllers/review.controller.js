"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSegmentReviewResult = exports.batchUpdateSegmentStatus = exports.finalizeSegmentReview = exports.completeSegmentReview = exports.resolveSegmentIssue = exports.addSegmentIssue = exports.requestSegmentReview = void 0;
const review_service_1 = __importDefault(require("../services/review.service"));
const errors_1 = require("../utils/errors");
/**
 * 请求段落AI审校
 */
const requestSegmentReview = async (req, res, next) => {
    try {
        const { segmentId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.UnauthorizedError('未授权的访问');
        }
        const { promptTemplateId, aiModel } = req.body;
        const segment = await review_service_1.default.startAIReview(segmentId, userId, { promptTemplateId, aiModel });
        res.status(200).json({
            success: true,
            data: segment
        });
    }
    catch (error) {
        next(error);
    }
};
exports.requestSegmentReview = requestSegmentReview;
/**
 * 添加段落问题
 */
const addSegmentIssue = async (req, res, next) => {
    try {
        const { segmentId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.UnauthorizedError('未授权的访问');
        }
        const issueData = req.body;
        const issue = await review_service_1.default.addSegmentIssue(segmentId, userId, issueData);
        res.status(201).json({
            success: true,
            data: issue
        });
    }
    catch (error) {
        next(error);
    }
};
exports.addSegmentIssue = addSegmentIssue;
/**
 * 解决段落问题
 */
const resolveSegmentIssue = async (req, res, next) => {
    try {
        const { segmentId, issueId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.UnauthorizedError('未授权的访问');
        }
        const issue = await review_service_1.default.resolveSegmentIssue(segmentId, issueId, userId);
        res.status(200).json({
            success: true,
            data: issue
        });
    }
    catch (error) {
        next(error);
    }
};
exports.resolveSegmentIssue = resolveSegmentIssue;
/**
 * 完成段落审校
 */
const completeSegmentReview = async (req, res, next) => {
    try {
        const { segmentId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.UnauthorizedError('未授权的访问');
        }
        const reviewData = req.body;
        const segment = await review_service_1.default.completeSegmentReview(segmentId, userId, reviewData);
        res.status(200).json({
            success: true,
            data: segment
        });
    }
    catch (error) {
        next(error);
    }
};
exports.completeSegmentReview = completeSegmentReview;
/**
 * 确认段落审校
 */
const finalizeSegmentReview = async (req, res, next) => {
    try {
        const { segmentId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.UnauthorizedError('未授权的访问');
        }
        const segment = await review_service_1.default.finalizeSegmentReview(segmentId, userId);
        res.status(200).json({
            success: true,
            data: segment
        });
    }
    catch (error) {
        next(error);
    }
};
exports.finalizeSegmentReview = finalizeSegmentReview;
/**
 * 批量更新段落状态
 */
const batchUpdateSegmentStatus = async (req, res, next) => {
    try {
        const { segmentIds, status } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.UnauthorizedError('未授权的访问');
        }
        const result = await review_service_1.default.batchUpdateSegmentStatus(segmentIds, userId, status);
        res.status(200).json({
            success: true,
            data: result
        });
    }
    catch (error) {
        next(error);
    }
};
exports.batchUpdateSegmentStatus = batchUpdateSegmentStatus;
/**
 * 获取段落审校结果
 */
const getSegmentReviewResult = async (req, res, next) => {
    try {
        const { segmentId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errors_1.UnauthorizedError('未授权的访问');
        }
        const reviewResult = await review_service_1.default.getSegmentReviewResult(segmentId, userId);
        res.status(200).json({
            success: true,
            data: reviewResult
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getSegmentReviewResult = getSegmentReviewResult;
