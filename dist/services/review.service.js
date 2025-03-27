"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const segment_model_1 = require("../models/segment.model");
const errors_1 = require("../utils/errors");
const file_model_1 = require("../models/file.model");
const project_model_1 = __importDefault(require("../models/project.model"));
const logger_1 = __importDefault(require("../utils/logger"));
// 自定义错误类
class BadRequestError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BadRequestError';
    }
}
/**
 * 审校服务类
 */
class ReviewService {
    constructor(aiAdapter) {
        // 后续会实现具体的AI适配器
        this.aiAdapter = aiAdapter;
    }
    /**
     * 启动段落的AI审校
     * @param segmentId 段落ID
     * @param userId 用户ID
     * @param options 选项
     */
    async startAIReview(segmentId, userId, options = {}) {
        const segment = await segment_model_1.Segment.findById(segmentId);
        if (!segment) {
            throw new errors_1.NotFoundError('段落不存在');
        }
        // 检查段落状态
        if (segment.status !== segment_model_1.SegmentStatus.TRANSLATED) {
            throw new BadRequestError('只有已翻译的段落才能进行审校');
        }
        // 检查用户权限 (项目管理员或审校人员)
        const file = await file_model_1.File.findById(segment.fileId);
        if (!file) {
            throw new errors_1.NotFoundError('关联文件不存在');
        }
        const project = await project_model_1.default.findById(file.projectId);
        if (!project) {
            throw new errors_1.NotFoundError('关联项目不存在');
        }
        const isManager = project.managerId.toString() === userId;
        // 类型安全的检查reviewer数组
        const isReviewer = Array.isArray(project.reviewers) && project.reviewers.some((reviewer) => reviewer && reviewer.toString() === userId);
        if (!isManager && !isReviewer) {
            throw new errors_1.ForbiddenError('无权审校此段落');
        }
        // 更新段落状态为审校中
        segment.status = segment_model_1.SegmentStatus.REVIEW_IN_PROGRESS;
        segment.reviewer = new mongoose_1.default.Types.ObjectId(userId);
        // 保存原始翻译
        if (!segment.reviewResult) {
            segment.reviewResult = {
                originalTranslation: segment.translation || '',
                reviewDate: new Date(),
                issues: [],
                scores: []
            };
        }
        await segment.save();
        logger_1.default.info(`Segment ${segment._id} review started by user ${userId}`);
        // 返回更新后的段落
        return segment;
    }
    /**
     * 添加段落问题
     * @param segmentId 段落ID
     * @param userId 用户ID
     * @param issueData 问题数据
     */
    async addSegmentIssue(segmentId, userId, issueData) {
        const segment = await segment_model_1.Segment.findById(segmentId);
        if (!segment) {
            throw new errors_1.NotFoundError('段落不存在');
        }
        // 检查用户权限
        const file = await file_model_1.File.findById(segment.fileId);
        if (!file) {
            throw new errors_1.NotFoundError('关联文件不存在');
        }
        const project = await project_model_1.default.findById(file.projectId);
        if (!project) {
            throw new errors_1.NotFoundError('关联项目不存在');
        }
        const isManager = project.managerId.toString() === userId;
        // 类型安全的检查reviewer数组
        const isReviewer = Array.isArray(project.reviewers) && project.reviewers.some((reviewer) => reviewer && reviewer.toString() === userId);
        if (!isManager && !isReviewer) {
            throw new errors_1.ForbiddenError('无权为此段落添加问题');
        }
        // 创建问题
        const issue = new segment_model_1.Issue({
            ...issueData,
            resolved: false,
            createdBy: new mongoose_1.default.Types.ObjectId(userId),
            createdAt: new Date()
        });
        await issue.save();
        // 将问题添加到段落的审校结果中
        if (!segment.issues) {
            segment.issues = [];
        }
        segment.issues.push(issue);
        if (segment.reviewResult && segment.reviewResult.issues) {
            segment.reviewResult.issues.push(issue._id);
        }
        await segment.save();
        logger_1.default.info(`Issue added to segment ${segment._id} by user ${userId}: ${issue._id}`);
        return issue;
    }
    /**
     * 解决段落问题
     * @param segmentId 段落ID
     * @param issueId 问题ID
     * @param userId 用户ID
     */
    async resolveSegmentIssue(segmentId, issueId, userId) {
        const segment = await segment_model_1.Segment.findById(segmentId);
        if (!segment) {
            throw new errors_1.NotFoundError('段落不存在');
        }
        const issue = await segment_model_1.Issue.findById(issueId);
        if (!issue) {
            throw new errors_1.NotFoundError('问题不存在');
        }
        // 检查问题是否属于该段落
        const isIssueOfSegment = segment.issues?.some(segmentIssue => segmentIssue._id.toString() === issueId);
        if (!isIssueOfSegment) {
            throw new BadRequestError('该问题不属于此段落');
        }
        // 检查用户权限
        const file = await file_model_1.File.findById(segment.fileId);
        if (!file) {
            throw new errors_1.NotFoundError('关联文件不存在');
        }
        const project = await project_model_1.default.findById(file.projectId);
        if (!project) {
            throw new errors_1.NotFoundError('关联项目不存在');
        }
        const isManager = project.managerId.toString() === userId;
        // 类型安全的检查reviewer数组
        const isReviewer = Array.isArray(project.reviewers) && project.reviewers.some((reviewer) => reviewer && reviewer.toString() === userId);
        if (!isManager && !isReviewer) {
            throw new errors_1.ForbiddenError('无权解决此问题');
        }
        // 更新问题状态
        issue.resolved = true;
        issue.resolvedAt = new Date();
        issue.resolvedBy = new mongoose_1.default.Types.ObjectId(userId);
        await issue.save();
        logger_1.default.info(`Issue ${issue._id} resolved by user ${userId} for segment ${segment._id}`);
        return issue;
    }
    /**
     * 完成段落审校
     * @param segmentId 段落ID
     * @param userId 用户ID
     * @param reviewData 审校数据
     */
    async completeSegmentReview(segmentId, userId, reviewData) {
        const segment = await segment_model_1.Segment.findById(segmentId);
        if (!segment) {
            throw new errors_1.NotFoundError('段落不存在');
        }
        // 检查段落状态
        if (segment.status !== segment_model_1.SegmentStatus.REVIEW_IN_PROGRESS &&
            segment.status !== segment_model_1.SegmentStatus.REVIEWING &&
            segment.status !== segment_model_1.SegmentStatus.REVIEW_PENDING) {
            throw new BadRequestError('段落不处于审校状态');
        }
        // 检查用户权限
        const file = await file_model_1.File.findById(segment.fileId);
        if (!file) {
            throw new errors_1.NotFoundError('关联文件不存在');
        }
        const project = await project_model_1.default.findById(file.projectId);
        if (!project) {
            throw new errors_1.NotFoundError('关联项目不存在');
        }
        const isManager = project.managerId.toString() === userId;
        // 类型安全的检查reviewer数组
        const isReviewer = Array.isArray(project.reviewers) && project.reviewers.some((reviewer) => reviewer && reviewer.toString() === userId);
        if (!isManager && !isReviewer) {
            throw new errors_1.ForbiddenError('无权完成此段落的审校');
        }
        // 更新审校结果
        if (!segment.reviewResult) {
            segment.reviewResult = {
                originalTranslation: segment.translation || '',
                reviewDate: new Date(),
                issues: [],
                scores: []
            };
        }
        segment.reviewResult.finalTranslation = reviewData.finalTranslation;
        segment.reviewResult.acceptedChanges = reviewData.acceptedChanges;
        segment.reviewResult.modificationDegree = reviewData.modificationDegree;
        segment.reviewResult.reviewerId = new mongoose_1.default.Types.ObjectId(userId);
        // 添加到审校历史
        if (!segment.reviewHistory) {
            segment.reviewHistory = [];
        }
        const version = segment.reviewHistory.length + 1;
        segment.reviewHistory.push({
            version,
            content: reviewData.finalTranslation,
            timestamp: new Date(),
            modifiedBy: new mongoose_1.default.Types.ObjectId(userId),
            aiGenerated: false,
            acceptedByHuman: true
        });
        // 更新段落状态和翻译
        segment.status = segment_model_1.SegmentStatus.REVIEW_COMPLETED;
        segment.translation = reviewData.finalTranslation;
        segment.translatedLength = reviewData.finalTranslation.length;
        await segment.save();
        logger_1.default.info(`Segment ${segment._id} review completed by user ${userId}`);
        return segment;
    }
    /**
     * 确认段落审校，最终完成
     * @param segmentId 段落ID
     * @param userId 用户ID
     */
    async finalizeSegmentReview(segmentId, userId) {
        const segment = await segment_model_1.Segment.findById(segmentId);
        if (!segment) {
            throw new errors_1.NotFoundError('段落不存在');
        }
        // 检查段落状态
        if (segment.status !== segment_model_1.SegmentStatus.REVIEW_COMPLETED) {
            throw new BadRequestError('段落审校尚未完成，无法确认');
        }
        // 检查用户权限 (项目管理员)
        const file = await file_model_1.File.findById(segment.fileId);
        if (!file) {
            throw new errors_1.NotFoundError('关联文件不存在');
        }
        const project = await project_model_1.default.findById(file.projectId);
        if (!project) {
            throw new errors_1.NotFoundError('关联项目不存在');
        }
        const isManager = project.managerId.toString() === userId;
        if (!isManager) {
            throw new errors_1.ForbiddenError('只有项目管理员才能最终确认审校结果');
        }
        // 更新段落状态
        segment.status = segment_model_1.SegmentStatus.COMPLETED;
        await segment.save();
        logger_1.default.info(`Segment ${segment._id} review finalized by user ${userId}`);
        // 检查文件中的所有段落是否都已完成
        const totalSegments = await segment_model_1.Segment.countDocuments({ fileId: segment.fileId });
        const completedSegments = await segment_model_1.Segment.countDocuments({
            fileId: segment.fileId,
            status: segment_model_1.SegmentStatus.COMPLETED
        });
        // 如果所有段落都已完成，更新文件状态
        if (totalSegments === completedSegments) {
            // 使用类型安全的方式更新文件状态
            file.status = 'completed';
            await file.save();
            logger_1.default.info(`File ${file._id} marked as completed after segment ${segment._id} finalization`);
            // 检查项目中的所有文件是否都已完成
            const totalFiles = await file_model_1.File.countDocuments({ projectId: file.projectId });
            const completedFiles = await file_model_1.File.countDocuments({
                projectId: file.projectId,
                status: 'completed'
            });
            // 如果所有文件都已完成，更新项目状态
            if (totalFiles === completedFiles) {
                // 使用类型安全的状态赋值
                project.status = 'completed';
                await project.save();
                logger_1.default.info(`Project ${project._id} marked as completed after file ${file._id} completion`);
            }
        }
        return segment;
    }
    /**
     * 批量更新段落审校状态
     * @param segmentIds 段落ID数组
     * @param userId 用户ID
     * @param status 状态
     */
    async batchUpdateSegmentStatus(segmentIds, userId, status) {
        // 检查用户权限
        const segment = await segment_model_1.Segment.findById(segmentIds[0]);
        if (!segment) {
            throw new errors_1.NotFoundError('段落不存在');
        }
        const file = await file_model_1.File.findById(segment.fileId);
        if (!file) {
            throw new errors_1.NotFoundError('关联文件不存在');
        }
        const project = await project_model_1.default.findById(file.projectId);
        if (!project) {
            throw new errors_1.NotFoundError('关联项目不存在');
        }
        const isManager = project.managerId.toString() === userId;
        // 类型安全的检查reviewer数组
        const isReviewer = Array.isArray(project.reviewers) && project.reviewers.some((reviewer) => reviewer && reviewer.toString() === userId);
        if (!isManager && !isReviewer) {
            throw new errors_1.ForbiddenError('无权批量更新段落状态');
        }
        // 更新段落状态
        const result = await segment_model_1.Segment.updateMany({ _id: { $in: segmentIds } }, { $set: { status } });
        logger_1.default.info(`Batch updated ${result.modifiedCount} segments to status ${status} by user ${userId}`);
        return result;
    }
    /**
     * 获取段落的审校结果
     * @param segmentId 段落ID
     * @param userId 用户ID
     */
    async getSegmentReviewResult(segmentId, userId) {
        const segment = await segment_model_1.Segment.findById(segmentId)
            .populate('issues')
            .populate('reviewer', 'name email');
        if (!segment) {
            throw new errors_1.NotFoundError('段落不存在');
        }
        // 检查用户权限
        const file = await file_model_1.File.findById(segment.fileId);
        if (!file) {
            throw new errors_1.NotFoundError('关联文件不存在');
        }
        const project = await project_model_1.default.findById(file.projectId);
        if (!project) {
            throw new errors_1.NotFoundError('关联项目不存在');
        }
        const isManager = project.managerId.toString() === userId;
        // 类型安全的检查reviewer数组
        const isReviewer = Array.isArray(project.reviewers) && project.reviewers.some((reviewer) => reviewer && reviewer.toString() === userId);
        const isTranslator = segment.translator?.toString() === userId;
        if (!isManager && !isReviewer && !isTranslator) {
            throw new errors_1.ForbiddenError('无权查看此段落的审校结果');
        }
        logger_1.default.info(`Segment ${segment._id} review result accessed by user ${userId}`);
        return {
            segment,
            reviewResult: segment.reviewResult,
            issues: segment.issues,
            reviewHistory: segment.reviewHistory
        };
    }
}
exports.ReviewService = ReviewService;
exports.default = new ReviewService();
