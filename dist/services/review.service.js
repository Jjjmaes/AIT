"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewService = exports.ReviewService = void 0;
const ai_review_service_1 = __importDefault(require("./ai-review.service"));
const segment_model_1 = require("../models/segment.model");
const file_model_1 = require("../models/file.model");
const project_model_1 = __importDefault(require("../models/project.model"));
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
const mongoose_1 = require("mongoose");
const ai_service_types_1 = require("../types/ai-service.types");
const errorHandler_1 = require("../utils/errorHandler");
const promptProcessor_1 = require("../utils/promptProcessor");
const config_1 = require("../config");
const translationMemory_service_1 = require("./translationMemory.service");
/**
 * 审校服务类
 */
class ReviewService /* implements IReviewService */ {
    constructor(aiRevService = ai_review_service_1.default) {
        this.serviceName = 'ReviewService';
        this.aiReviewService = aiRevService;
        this.translationMemoryService = new translationMemory_service_1.TranslationMemoryService();
    }
    /**
     * 开始AI审校
     */
    async startAIReview(segmentId, userId, requesterRoles = [], options) {
        // Define methodName for logging
        const methodName = 'startAIReview';
        (0, errorHandler_1.validateId)(segmentId, '段落');
        (0, errorHandler_1.validateId)(userId, '用户');
        let segment = null;
        let file = null;
        let project = null;
        let templateIdToUse = undefined;
        try {
            // 1. Fetch Segment & related data
            segment = await segment_model_1.Segment.findById(segmentId).exec();
            (0, errorHandler_1.validateEntityExists)(segment, '段落');
            // 2. Check status
            if (segment.status !== segment_model_1.SegmentStatus.TRANSLATED && segment.status !== segment_model_1.SegmentStatus.ERROR) {
                throw new errors_1.ValidationError(`段落状态不允许审校，当前状态: ${segment.status}`);
            }
            if (!segment.translation) {
                throw new errors_1.ValidationError('段落没有翻译内容，无法进行审校');
            }
            // 3. Get File & Project for context and permissions
            file = await file_model_1.File.findById(segment.fileId).exec();
            (0, errorHandler_1.validateEntityExists)(file, '关联文件');
            project = await project_model_1.default.findById(file.projectId).populate('reviewPromptTemplate').populate('defaultReviewPromptTemplate').exec();
            (0, errorHandler_1.validateEntityExists)(project, '关联项目');
            // 4. Check Permissions (Manager or assigned Reviewer?)
            (0, errorHandler_1.validateOwnership)(project.manager, userId, '开始AI审校', true, requesterRoles);
            // 5. Update segment status to REVIEWING
            segment.status = segment_model_1.SegmentStatus.REVIEWING;
            segment.reviewer = project.manager;
            segment.reviewCompletedAt = undefined;
            segment.reviewMetadata = undefined;
            segment.issues = [];
            await segment.save();
            // 6. Prepare Prompt Context & Build Prompt
            if (options?.promptTemplateId) {
                templateIdToUse = options.promptTemplateId;
            }
            else if (project.reviewPromptTemplate) {
                templateIdToUse = project.reviewPromptTemplate._id?.toString() ?? project.reviewPromptTemplate.toString();
            }
            else if (project.defaultReviewPromptTemplate) {
                templateIdToUse = project.defaultReviewPromptTemplate._id?.toString() ?? project.defaultReviewPromptTemplate.toString();
            }
            const promptContext = {
                promptTemplateId: templateIdToUse,
                sourceLanguage: file.metadata?.sourceLanguage ?? undefined,
                targetLanguage: file.metadata?.targetLanguage ?? undefined,
                domain: project.domain,
                industry: project.industry,
            };
            const reviewPromptData = await promptProcessor_1.promptProcessor.buildReviewPrompt(segment.sourceText, segment.translation, promptContext);
            // 7. Get AI Provider & Model
            const aiProvider = options?.aiProvider || ai_service_types_1.AIProvider.OPENAI;
            const model = options?.aiModel || config_1.config.openai.defaultModel || 'gpt-4-turbo'; // Use config default
            // 8. Execute AI review using AIReviewService (NO direct client call)
            logger_1.default.info(`[${methodName}] Calling AIReviewService for segment ${segmentId}`);
            const reviewOptionsForAIService = {
                sourceLanguage: file.metadata?.sourceLanguage ?? 'en',
                targetLanguage: file.metadata?.targetLanguage ?? 'en',
                provider: aiProvider,
                model: model,
                apiKey: options?.apiKey || undefined,
                promptTemplateId: templateIdToUse,
                projectId: project._id.toString(),
                requestedScores: options?.requestedScores || undefined,
                checkIssueTypes: options?.checkIssueTypes || undefined,
                contextSegments: options?.contextSegments || undefined,
                customPrompt: options?.customPrompt || undefined,
                userId: userId,
                requesterRoles: requesterRoles
            };
            const aiReviewResult = await this.aiReviewService.reviewTranslation(segment.sourceText, segment.translation, reviewOptionsForAIService);
            logger_1.default.info(`[${methodName}] AIReviewService finished for segment ${segmentId}`);
            // 9. Process AI Issues (Map AIReviewIssue to IIssue)
            const userObjectIdForIssue = project.manager; // Reuse manager from permission check
            const newIssues = (aiReviewResult.issues || []).map((aiIssue) => ({
                type: aiIssue.type || segment_model_1.IssueType.OTHER,
                severity: aiIssue.severity || segment_model_1.IssueSeverity.MEDIUM,
                description: aiIssue.description || 'AI detected issue',
                position: aiIssue.position,
                suggestion: aiIssue.suggestion,
                status: segment_model_1.IssueStatus.OPEN,
                createdAt: new Date(),
                createdBy: userObjectIdForIssue
            }));
            // 10. Update Segment with Review Metadata and Issues (Store AI Scores too)
            segment.review = aiReviewResult.suggestedTranslation; // Store AI suggestion in 'review' field
            segment.issues = newIssues;
            // Store the AI scores received from the service
            segment.aiScores = aiReviewResult.scores || [];
            let reviewTemplateObjectId = undefined;
            if (templateIdToUse && mongoose_1.Types.ObjectId.isValid(templateIdToUse)) {
                reviewTemplateObjectId = new mongoose_1.Types.ObjectId(templateIdToUse);
            }
            segment.reviewMetadata = {
                aiModel: aiReviewResult.metadata?.model,
                promptTemplateId: reviewTemplateObjectId,
                tokenCount: (aiReviewResult.metadata?.tokens?.input ?? 0) + (aiReviewResult.metadata?.tokens?.output ?? 0),
                processingTime: aiReviewResult.metadata?.processingTime || 0,
                acceptedChanges: false,
                modificationDegree: aiReviewResult.metadata?.modificationDegree || 0,
            };
            segment.status = segment_model_1.SegmentStatus.REVIEW_PENDING;
            segment.error = undefined;
            segment.markModified('issues');
            segment.markModified('reviewMetadata');
            segment.markModified('aiScores'); // Mark new field as modified
            await segment.save();
            logger_1.default.info(`AI Review results processed and saved for segment ${segmentId}`);
            // 11. Return updated segment
            return segment;
        }
        catch (error) {
            if (segment && segment.status === segment_model_1.SegmentStatus.REVIEWING && !(error instanceof errors_1.ForbiddenError || error instanceof errors_1.ValidationError)) {
                try {
                    segment.status = segment_model_1.SegmentStatus.ERROR;
                    segment.error = `审校处理失败: ${error instanceof Error ? error.message : '未知错误'}`;
                    await segment.save();
                }
                catch (failSaveError) {
                    logger_1.default.error(`Failed to mark segment ${segmentId} as ERROR after review error:`, failSaveError);
                }
            }
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, 'AI审校');
        }
    }
    /**
     * 完成段落审校 (Reviewer submits their work)
     */
    async completeSegmentReview(segmentId, userId, reviewData) {
        const methodName = 'completeSegmentReview';
        (0, errorHandler_1.validateId)(segmentId, '段落');
        (0, errorHandler_1.validateId)(userId, '审校用户');
        if (!reviewData || !reviewData.finalTranslation) {
            throw new errors_1.ValidationError('缺少必要的审校数据: finalTranslation');
        }
        let segment = null;
        try {
            // 1. Fetch Segment
            segment = await segment_model_1.Segment.findById(segmentId).populate('issues').exec(); // Populate issues
            (0, errorHandler_1.validateEntityExists)(segment, '段落');
            // 2. Check Status
            if (segment.status !== segment_model_1.SegmentStatus.REVIEW_PENDING &&
                segment.status !== segment_model_1.SegmentStatus.ERROR &&
                segment.status !== segment_model_1.SegmentStatus.REVIEWING) {
                throw new errors_1.ValidationError(`段落状态 (${segment.status}) 不允许完成审校`);
            }
            // 3. Check Permissions (Manager or assigned Reviewer)
            const file = await file_model_1.File.findById(segment.fileId).exec();
            (0, errorHandler_1.validateEntityExists)(file, '关联文件');
            const project = await project_model_1.default.findById(file.projectId).exec();
            (0, errorHandler_1.validateEntityExists)(project, '关联项目');
            const userObjectId = new mongoose_1.Types.ObjectId(userId); // Check against the requesting user
            // Use correct manager field
            const isManager = project.manager?.equals(userObjectId);
            const isAssignedReviewer = segment.reviewer?.equals(userObjectId);
            if (!isManager && !isAssignedReviewer) {
                throw new errors_1.ForbiddenError(`用户 (${userId}) 不是该段落的指定审校员，也非项目经理，无权完成审校`);
            }
            // 4. Process Issue Resolutions
            if (reviewData.issuesResolution && segment.issues) {
                for (const res of reviewData.issuesResolution) {
                    // Explicitly check if res.resolution is defined
                    if (!res.resolution) {
                        logger_1.default.warn(`Missing resolution details for issue index ${res.issueIndex}, segment ${segmentId}`);
                        continue; // Skip this iteration if resolution details are missing
                    }
                    if (res.issueIndex >= 0 && res.issueIndex < segment.issues.length) {
                        const issue = segment.issues[res.issueIndex];
                        if (issue && (issue.status === segment_model_1.IssueStatus.OPEN || issue.status === segment_model_1.IssueStatus.IN_PROGRESS)) {
                            issue.resolution = res.resolution; // Safe to assign
                            issue.resolvedAt = new Date();
                            issue.resolvedBy = userObjectId;
                            // Safe to access res.resolution.action now
                            switch (res.resolution.action) {
                                case 'accept':
                                    issue.status = segment_model_1.IssueStatus.RESOLVED;
                                    break;
                                case 'modify':
                                    issue.status = segment_model_1.IssueStatus.RESOLVED;
                                    break;
                                case 'reject':
                                    issue.status = segment_model_1.IssueStatus.REJECTED;
                                    break;
                                default:
                                    issue.status = segment_model_1.IssueStatus.RESOLVED;
                                    logger_1.default.warn(`Unknown resolution action '${res.resolution.action}' for issue ${res.issueIndex}, segment ${segmentId}. Marking as resolved.`);
                                    break;
                            }
                        }
                        else {
                            logger_1.default.warn(`Issue index ${res.issueIndex} invalid or issue already resolved/closed for segment ${segmentId}`);
                        }
                    }
                    else {
                        logger_1.default.warn(`Invalid issue index ${res.issueIndex} provided for segment ${segmentId}`);
                    }
                }
                segment.markModified('issues');
            }
            else if (reviewData.acceptAllSuggestions && segment.issues) {
                segment.issues.forEach(issue => {
                    if (issue.status === segment_model_1.IssueStatus.OPEN) {
                        issue.status = segment_model_1.IssueStatus.RESOLVED;
                        issue.resolution = { action: 'accept', comment: 'Accepted AI suggestion' };
                        issue.resolvedAt = new Date();
                        issue.resolvedBy = userObjectId;
                    }
                });
                segment.markModified('issues');
            }
            // 5. Update Segment Data
            segment.finalText = reviewData.finalTranslation;
            segment.status = segment_model_1.SegmentStatus.REVIEW_COMPLETED;
            segment.reviewCompletedAt = new Date();
            segment.error = undefined;
            // Update reviewMetadata using existing data + new info
            const originalTranslation = segment.translation || '';
            const modificationDegree = this.calculateModificationDegree(originalTranslation, segment.finalText);
            segment.reviewMetadata = {
                ...(segment.reviewMetadata || {}), // Keep existing AI info if available
                acceptedChanges: reviewData.acceptAllSuggestions ?? false, // Reflect user action
                modificationDegree: modificationDegree, // Recalculate based on final text
                // Add reviewer ID? reviewCompletedAt is already set
            };
            segment.markModified('reviewMetadata');
            // Remove reviewHistory references as it's not in the model
            // Remove reviewResult references
            // 6. Save Segment
            await segment.save();
            logger_1.default.info(`Segment ${segmentId} review completed by user ${userId}`);
            // TODO: Optionally trigger file progress update check here
            // projectService.updateFileProgress(file._id.toString(), userId);
            // 7. Return Updated Segment
            return segment;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '完成段落审校');
        }
    }
    /**
     * 获取段落审校结果 (Simplified - returns segment data)
     */
    async getSegmentReviewResult(segmentId, userId) {
        const methodName = 'getSegmentReviewResult';
        (0, errorHandler_1.validateId)(segmentId, '段落');
        (0, errorHandler_1.validateId)(userId, '用户');
        try {
            // 1. Fetch Segment, populate reviewer
            const segment = await segment_model_1.Segment.findById(segmentId)
                .populate('reviewer', 'id fullName email') // Populate reviewer details
                .populate('issues') // Populate issues
                .exec();
            (0, errorHandler_1.validateEntityExists)(segment, '段落');
            // 2. Get File & Project for permissions
            const file = await file_model_1.File.findById(segment.fileId).exec();
            (0, errorHandler_1.validateEntityExists)(file, '关联文件');
            const project = await project_model_1.default.findById(file.projectId).exec();
            (0, errorHandler_1.validateEntityExists)(project, '关联项目');
            // 3. Check Permissions (Manager or assigned Reviewer)
            const userObjectId = project.manager;
            // Use correct manager field
            const isManager = project.manager?.equals(userObjectId);
            const isReviewer = project.reviewers?.some((r) => r.equals(userObjectId));
            const isAssignedReviewer = segment.reviewer?._id?.equals(userObjectId);
            // Allow manager, project reviewer, or the specific segment reviewer to view
            if (!isManager && !isReviewer && !isAssignedReviewer) {
                throw new errors_1.ForbiddenError(`用户 (${userId}) 无权查看段落 (${segmentId}) 的审校结果`);
            }
            // 4. Return the full segment data
            // The segment now contains reviewMetadata, issues, finalText etc.
            return segment;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '获取段落审校结果');
        }
    }
    /**
     * 获取段落上下文 (No changes needed here)
     */
    async getContextSegments(segment, file) {
        try {
            const currentIndex = segment.index; // Assuming segments have an index
            const contextSize = 2; // Get 2 segments before and 2 after
            const [prevSegments, nextSegments] = await Promise.all([
                segment_model_1.Segment.find({ fileId: file._id, index: { $lt: currentIndex } })
                    .sort({ index: -1 })
                    .limit(contextSize)
                    .exec(),
                segment_model_1.Segment.find({ fileId: file._id, index: { $gt: currentIndex } })
                    .sort({ index: 1 })
                    .limit(contextSize)
                    .exec()
            ]);
            // Combine and format
            const context = [...prevSegments.reverse(), ...nextSegments];
            return context
                .filter(seg => seg.sourceText && (seg.translation || seg.status === segment_model_1.SegmentStatus.TRANSLATED))
                .map(seg => ({
                sourceText: seg.sourceText,
                translation: seg.translation,
                position: seg.index < currentIndex ? 'before' : 'after'
            }));
        }
        catch (error) {
            logger_1.default.error('获取上下文段落失败', { segmentId: segment._id, fileId: file._id, error });
            return [];
        }
    }
    /**
     * 添加段落审校问题
     */
    async addSegmentIssue(segmentId, userId, issueData) {
        const methodName = 'addSegmentIssue';
        (0, errorHandler_1.validateId)(segmentId, '段落');
        (0, errorHandler_1.validateId)(userId, '用户');
        // Validate required fields from IIssue
        if (!issueData || !issueData.type || !issueData.description || !issueData.severity || !issueData.status) {
            throw new errors_1.ValidationError('问题数据不完整 (缺少类型, 描述, 严重性或状态)');
        }
        try {
            // 1. Find segment
            const segment = await segment_model_1.Segment.findById(segmentId).exec();
            (0, errorHandler_1.validateEntityExists)(segment, '段落');
            // 2. Check status (allow adding issues during review phases or even completed)
            if (![segment_model_1.SegmentStatus.REVIEWING, segment_model_1.SegmentStatus.TRANSLATED, segment_model_1.SegmentStatus.ERROR, segment_model_1.SegmentStatus.REVIEW_PENDING, segment_model_1.SegmentStatus.REVIEW_COMPLETED, segment_model_1.SegmentStatus.CONFIRMED].includes(segment.status)) {
                throw new errors_1.ValidationError(`段落状态 (${segment.status}) 不允许添加问题`);
            }
            // 3. Get project and check permissions (Manager or Reviewer)
            const file = await file_model_1.File.findById(segment.fileId);
            (0, errorHandler_1.validateEntityExists)(file, '关联文件');
            const projectForPermission = await project_model_1.default.findById(file.projectId).exec();
            (0, errorHandler_1.validateEntityExists)(projectForPermission, '关联项目');
            const requesterRoles = projectForPermission.reviewers?.map(id => id.toString());
            // Use correct manager field
            const userObjectId = new mongoose_1.Types.ObjectId(userId); // The user adding the issue
            (0, errorHandler_1.validateOwnership)(projectForPermission.manager, userId, '添加问题', true, requesterRoles);
            // 4. Create the new issue object, ensuring defaults/required fields
            const newIssue = {
                ...issueData, // Spread provided data
                status: issueData.status || segment_model_1.IssueStatus.OPEN, // Ensure status
                createdAt: issueData.createdAt || new Date(), // Ensure createdAt
                createdBy: issueData.createdBy || userObjectId, // Ensure createdBy
                // _id will be generated by Mongoose for the subdocument
            };
            // 5. Add the issue to the segment's issues array
            segment.issues = segment.issues || [];
            segment.issues.push(newIssue);
            segment.markModified('issues'); // Mark array modified
            // 6. Save the updated segment
            await segment.save();
            // 7. Return the added issue object (last element)
            logger_1.default.info(`Issue added to segment ${segmentId} by user ${userId}`);
            return segment.issues[segment.issues.length - 1];
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '添加段落问题');
        }
    }
    /**
     * 解决段落审校问题 (No changes needed here as it was updated recently)
     */
    async resolveSegmentIssue(segmentId, issueIndex, userId, resolution) {
        // ... recent implementation looks okay ...
        const methodName = 'resolveSegmentIssue';
        (0, errorHandler_1.validateId)(segmentId, '段落');
        (0, errorHandler_1.validateId)(userId, '用户');
        if (issueIndex === undefined || issueIndex < 0) {
            throw new errors_1.ValidationError('无效的问题索引');
        }
        if (!resolution || !resolution.action) {
            throw new errors_1.ValidationError('缺少问题解决方案或操作');
        }
        let segment = null;
        try {
            segment = await segment_model_1.Segment.findById(segmentId).exec();
            (0, errorHandler_1.validateEntityExists)(segment, '段落');
            if (segment.status !== segment_model_1.SegmentStatus.REVIEW_PENDING &&
                segment.status !== segment_model_1.SegmentStatus.ERROR &&
                segment.status !== segment_model_1.SegmentStatus.REVIEWING) {
                throw new errors_1.ValidationError(`无法在当前状态 (${segment.status}) 下解决问题`);
            }
            const file = await file_model_1.File.findById(segment.fileId).exec();
            (0, errorHandler_1.validateEntityExists)(file, '关联文件');
            const project = await project_model_1.default.findById(file.projectId).exec();
            (0, errorHandler_1.validateEntityExists)(project, '关联项目');
            const userObjectId = new mongoose_1.Types.ObjectId(userId); // User resolving the issue
            const isManager = project.manager?.equals(userObjectId);
            const isAssignedReviewer = segment.reviewer?.equals(userObjectId);
            if (!isManager && !isAssignedReviewer) {
                throw new errors_1.ForbiddenError(`用户 (${userId}) 不是该段落的审校员或项目经理，无权解决问题`);
            }
            if (!segment.issues || issueIndex >= segment.issues.length) {
                throw new errors_1.NotFoundError(`索引 ${issueIndex} 处的问题不存在`);
            }
            const issue = segment.issues[issueIndex];
            if (issue.status !== segment_model_1.IssueStatus.OPEN && issue.status === segment_model_1.IssueStatus.IN_PROGRESS) {
                logger_1.default.warn(`Issue at index ${issueIndex} for segment ${segmentId} is not open or in progress (status: ${issue.status}). Skipping resolution.`);
                return segment;
            }
            issue.resolution = resolution;
            issue.resolvedAt = new Date();
            issue.resolvedBy = userObjectId;
            switch (resolution.action) {
                case 'accept':
                case 'modify':
                    issue.status = segment_model_1.IssueStatus.RESOLVED;
                    break;
                case 'reject':
                    issue.status = segment_model_1.IssueStatus.REJECTED;
                    break;
                default:
                    issue.status = segment_model_1.IssueStatus.RESOLVED;
                    break;
            }
            segment.markModified('issues');
            await segment.save();
            logger_1.default.info(`Issue ${issueIndex} for segment ${segmentId} resolved by user ${userId} with action: ${resolution.action}`);
            return segment;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}, issue ${issueIndex}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '解决审校问题');
        }
    }
    /**
     * 确认段落审校结果 (Manager finalizes) (No changes needed here as it was updated recently)
     */
    async finalizeSegmentReview(segmentId, userId) {
        // ... recent implementation looks okay ...
        const methodName = 'finalizeSegmentReview';
        (0, errorHandler_1.validateId)(segmentId, '段落');
        (0, errorHandler_1.validateId)(userId, '用户');
        let segment = null;
        try {
            segment = await segment_model_1.Segment.findById(segmentId).populate('issues').exec();
            (0, errorHandler_1.validateEntityExists)(segment, '段落');
            if (segment.status !== segment_model_1.SegmentStatus.REVIEW_COMPLETED) {
                throw new errors_1.ValidationError(`无法确认状态为 (${segment.status}) 的段落审校`);
            }
            const file = await file_model_1.File.findById(segment.fileId).exec();
            (0, errorHandler_1.validateEntityExists)(file, '关联文件');
            const project = await project_model_1.default.findById(file.projectId).exec();
            (0, errorHandler_1.validateEntityExists)(project, '关联项目');
            const userObjectId = new mongoose_1.Types.ObjectId(userId); // User finalizing
            if (!project.manager || !project.manager.equals(userObjectId)) {
                throw new errors_1.ForbiddenError(`用户 (${userId}) 不是项目经理，无权确认审校`);
            }
            const unresolvedIssues = segment.issues?.filter(issue => issue.status === segment_model_1.IssueStatus.OPEN || issue.status === segment_model_1.IssueStatus.IN_PROGRESS);
            if (unresolvedIssues && unresolvedIssues.length > 0) {
                logger_1.default.warn(`Finalizing segment ${segmentId} with ${unresolvedIssues.length} unresolved issues.`);
            }
            // Calculate and set the final quality score
            segment.qualityScore = this._calculateQualityScore(segment);
            segment.status = segment_model_1.SegmentStatus.CONFIRMED;
            segment.error = undefined;
            segment.markModified('qualityScore'); // Mark new field as modified
            await segment.save();
            logger_1.default.info(`Segment ${segmentId} review finalized by manager ${userId} with quality score ${segment.qualityScore}`);
            // Use file._id.toString() for the check
            this.checkFileCompletionStatus(file._id.toString()).catch(err => {
                logger_1.default.error(`Failed to check/update file completion status after finalizing segment ${segmentId}:`, err);
            });
            return segment;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '确认段落审校');
        }
    }
    /**
     * 检查文件完成状态并更新 (No changes needed here as it was updated recently)
     */
    async checkFileCompletionStatus(fileId) {
        // ... recent implementation looks okay ...
        try {
            const file = await file_model_1.File.findById(fileId);
            if (!file)
                return;
            const totalSegments = await segment_model_1.Segment.countDocuments({ fileId: file._id });
            const completedSegments = await segment_model_1.Segment.countDocuments({
                fileId: file._id,
                status: segment_model_1.SegmentStatus.CONFIRMED
            });
            if (totalSegments > 0 && completedSegments === totalSegments) {
                if (file.status !== file_model_1.FileStatus.COMPLETED) {
                    file.status = file_model_1.FileStatus.COMPLETED;
                    file.processingCompletedAt = new Date();
                    await file.save();
                    logger_1.default.info(`File ${fileId} marked as COMPLETED as all segments are finalized.`);
                }
            }
            else {
                if (file.status === file_model_1.FileStatus.COMPLETED) {
                    const reviewCompletedCount = await segment_model_1.Segment.countDocuments({ fileId: file._id, status: segment_model_1.SegmentStatus.REVIEW_COMPLETED });
                    const reviewPendingCount = await segment_model_1.Segment.countDocuments({ fileId: file._id, status: segment_model_1.SegmentStatus.REVIEW_PENDING });
                    const reviewingCount = await segment_model_1.Segment.countDocuments({ fileId: file._id, status: segment_model_1.SegmentStatus.REVIEWING });
                    const translatedCount = await segment_model_1.Segment.countDocuments({ fileId: file._id, status: segment_model_1.SegmentStatus.TRANSLATED });
                    let newStatus = file_model_1.FileStatus.PENDING;
                    if (reviewCompletedCount > 0 || reviewPendingCount > 0 || reviewingCount > 0) {
                        newStatus = file_model_1.FileStatus.REVIEWING;
                    }
                    else if (translatedCount > 0) {
                        newStatus = file_model_1.FileStatus.TRANSLATED;
                    }
                    file.status = newStatus;
                    await file.save();
                    logger_1.default.warn(`File ${fileId} status reverted from COMPLETED to ${newStatus} as not all segments are finalized.`);
                }
            }
        }
        catch (error) {
            logger_1.default.error(`Error checking file completion status for ${fileId}:`, error);
        }
    }
    // ===== Helper/Utility Methods =====
    /** Calculate a final quality score based on resolved issues */
    _calculateQualityScore(segment) {
        let score = 100;
        const maxScore = 100;
        const minScore = 0;
        if (!segment.issues || segment.issues.length === 0) {
            return maxScore; // No issues, perfect score
        }
        for (const issue of segment.issues) {
            let deduction = 0;
            // Only apply deductions for issues that were actually addressed or finalized
            if (issue.status === segment_model_1.IssueStatus.RESOLVED || issue.status === segment_model_1.IssueStatus.REJECTED) {
                const severity = issue.severity || segment_model_1.IssueSeverity.MEDIUM; // Default severity if missing
                const action = issue.resolution?.action;
                if (issue.status === segment_model_1.IssueStatus.RESOLVED) {
                    // Smaller deductions for resolved issues
                    switch (severity) {
                        case segment_model_1.IssueSeverity.LOW:
                            deduction = 1;
                            break;
                        case segment_model_1.IssueSeverity.MEDIUM:
                            deduction = 3;
                            break;
                        case segment_model_1.IssueSeverity.HIGH:
                            deduction = 5;
                            break;
                        case segment_model_1.IssueSeverity.CRITICAL:
                            deduction = 10;
                            break;
                    }
                    // Optional: slightly higher deduction if resolved by modification vs acceptance?
                    // if (action === 'modify') deduction *= 1.2;
                }
                else { // IssueStatus.REJECTED
                    // Larger deductions for rejected issues
                    switch (severity) {
                        case segment_model_1.IssueSeverity.LOW:
                            deduction = 2;
                            break;
                        case segment_model_1.IssueSeverity.MEDIUM:
                            deduction = 5;
                            break;
                        case segment_model_1.IssueSeverity.HIGH:
                            deduction = 10;
                            break;
                        case segment_model_1.IssueSeverity.CRITICAL:
                            deduction = 20;
                            break;
                    }
                }
            }
            else if (issue.status === segment_model_1.IssueStatus.OPEN || issue.status === segment_model_1.IssueStatus.IN_PROGRESS) {
                // Penalty for issues left open/in progress at finalization (treat as rejected?)
                const severity = issue.severity || segment_model_1.IssueSeverity.MEDIUM;
                switch (severity) {
                    case segment_model_1.IssueSeverity.LOW:
                        deduction = 2;
                        break;
                    case segment_model_1.IssueSeverity.MEDIUM:
                        deduction = 5;
                        break;
                    case segment_model_1.IssueSeverity.HIGH:
                        deduction = 10;
                        break;
                    case segment_model_1.IssueSeverity.CRITICAL:
                        deduction = 20;
                        break;
                }
                logger_1.default.warn(`Applying penalty for unresolved issue (status: ${issue.status}) during quality score calculation for segment ${segment._id}`);
            }
            score -= deduction;
        }
        return Math.max(minScore, Math.min(maxScore, Math.round(score))); // Clamp between 0-100 and round
    }
    /** Recalculate modification degree between two strings (simple implementation) */
    calculateModificationDegree(original, modified) {
        if (!original || !modified)
            return 0;
        if (original === modified)
            return 0;
        // Simple Levenshtein distance based calculation
        // For more accuracy, consider a library like 'fast-levenshtein'
        const distance = this.levenshteinDistance(original, modified);
        const maxLength = Math.max(original.length, modified.length);
        if (maxLength === 0)
            return 0;
        return Math.min(1, distance / maxLength); // Cap at 1
    }
    // Basic Levenshtein distance implementation
    levenshteinDistance(a, b) {
        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
        for (let i = 0; i <= a.length; i += 1)
            matrix[0][i] = i;
        for (let j = 0; j <= b.length; j += 1)
            matrix[j][0] = j;
        for (let j = 1; j <= b.length; j += 1) {
            for (let i = 1; i <= a.length; i += 1) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(matrix[j][i - 1] + 1, // deletion
                matrix[j - 1][i] + 1, // insertion
                matrix[j - 1][i - 1] + indicator);
            }
        }
        return matrix[b.length][a.length];
    }
    // ===== Project Reviewer Management =====
    async getProjectReviewers(projectId) {
        const project = await project_model_1.default.findById(projectId);
        if (!project) {
            throw new errors_1.NotFoundError('Project not found');
        }
        return project.reviewers || [];
    }
    async addReviewer(projectId, reviewerId) {
        const project = await project_model_1.default.findById(projectId);
        if (!project) {
            throw new errors_1.NotFoundError('Project not found');
        }
        if (!project.reviewers) {
            project.reviewers = [];
        }
        if (project.reviewers.some((r) => r.equals(reviewerId))) {
            throw new errors_1.ConflictError('Reviewer already assigned to project');
        }
        project.reviewers.push(reviewerId);
        await project.save();
        logger_1.default.info(`Reviewer ${reviewerId} added to project ${projectId}`);
    }
    async removeReviewer(projectId, reviewerId) {
        const project = await project_model_1.default.findById(projectId);
        if (!project) {
            throw new errors_1.NotFoundError('Project not found');
        }
        if (!project.reviewers) {
            throw new errors_1.NotFoundError('No reviewers assigned to project');
        }
        const initialLength = project.reviewers.length;
        project.reviewers = project.reviewers.filter((r) => !r.equals(reviewerId));
        if (project.reviewers.length === initialLength) {
            throw new errors_1.NotFoundError('Reviewer not found in project');
        }
        await project.save();
        logger_1.default.info(`Reviewer ${reviewerId} removed from project ${projectId}`);
    }
    /**
     * Batch resolve open issues across all segments in a file based on criteria.
     * Primarily intended for Project Managers.
     */
    async batchResolveIssues(fileId, criteria, resolution, // The resolution action to apply
    userId) {
        const methodName = 'batchResolveIssues';
        (0, errorHandler_1.validateId)(fileId, '文件');
        (0, errorHandler_1.validateId)(userId, '用户');
        if (!resolution || !resolution.action) {
            throw new errors_1.ValidationError('缺少问题解决方案或操作');
        }
        if (!criteria || (!criteria.type?.length && !criteria.severity?.length)) {
            throw new errors_1.ValidationError('至少需要提供一个筛选条件 (类型或严重性)');
        }
        const userObjectId = new mongoose_1.Types.ObjectId(userId);
        let modifiedSegmentsCount = 0;
        let resolvedIssuesCount = 0;
        try {
            // 1. Fetch File and Project
            const file = await file_model_1.File.findById(fileId).exec();
            (0, errorHandler_1.validateEntityExists)(file, '文件');
            const project = await project_model_1.default.findById(file.projectId).exec();
            (0, errorHandler_1.validateEntityExists)(project, '关联项目');
            // 2. Check Permissions (Only Project Manager for now)
            if (!project.manager || !project.manager.equals(userObjectId)) {
                throw new errors_1.ForbiddenError(`用户 (${userId}) 不是项目经理，无权执行批量解决操作`);
            }
            // 3. Build Query for Segments and Issues
            const segmentQuery = {
                fileId: file._id,
                status: { $in: [
                        segment_model_1.SegmentStatus.REVIEWING,
                        segment_model_1.SegmentStatus.ERROR // Allow resolving issues even if review failed
                    ] },
                'issues.status': segment_model_1.IssueStatus.OPEN // Target only open issues within segments
            };
            // Add criteria to the query using $elemMatch on the issues array
            const issueMatchCriteria = { status: segment_model_1.IssueStatus.OPEN };
            if (criteria.type?.length) {
                issueMatchCriteria.type = { $in: criteria.type };
            }
            if (criteria.severity?.length) {
                issueMatchCriteria.severity = { $in: criteria.severity };
            }
            segmentQuery.issues = { $elemMatch: issueMatchCriteria };
            // Implementation using bulkWrite
            const updateOperations = [];
            const resolvedStatus = (resolution.action === 'reject') ? segment_model_1.IssueStatus.REJECTED : segment_model_1.IssueStatus.RESOLVED;
            // Build array filter explicitly
            const arrayFilterCriteria = { 'issue.status': segment_model_1.IssueStatus.OPEN };
            if (criteria.type?.length) {
                arrayFilterCriteria['issue.type'] = { $in: criteria.type };
            }
            if (criteria.severity?.length) {
                arrayFilterCriteria['issue.severity'] = { $in: criteria.severity };
            }
            // Use updateMany with arrayFilters to target specific issues
            updateOperations.push({
                updateMany: {
                    filter: segmentQuery, // Find segments with matching issues
                    update: {
                        $set: {
                            'issues.$[issue].status': resolvedStatus,
                            'issues.$[issue].resolution': resolution,
                            'issues.$[issue].resolvedAt': new Date(),
                            'issues.$[issue].resolvedBy': userObjectId,
                        }
                    },
                    arrayFilters: [arrayFilterCriteria] // Use the explicitly built filter
                }
            });
            if (updateOperations.length > 0) {
                logger_1.default.info(`[${methodName}] Preparing to execute bulkWrite for file ${fileId} with criteria: ${JSON.stringify(criteria)}`);
                const bulkResult = await segment_model_1.Segment.bulkWrite(updateOperations, { ordered: false }); // ordered: false for performance
                logger_1.default.info(`[${methodName}] bulkWrite result:`, bulkResult);
                modifiedSegmentsCount = bulkResult.modifiedCount ?? 0;
                // Note: bulkWrite doesn't easily return the count of *array elements* modified.
                // Reporting modified segment count instead.
                resolvedIssuesCount = modifiedSegmentsCount; // Simplistic estimate, represents modified segments
                logger_1.default.info(`[${methodName}] ${modifiedSegmentsCount} segments were modified containing matching issues.`);
            }
            else {
                logger_1.default.info(`[${methodName}] No update operations generated. This should not normally happen if criteria are valid.`);
            }
            // Placeholder: Find segments matching the criteria (inefficient for update)
            // const segmentsToUpdate = await Segment.find(segmentQuery).exec();
            // logger.info(`[${methodName}] Found ${segmentsToUpdate.length} segments with matching open issues.`);
            // Actual update logic using bulkWrite needed here
            // Return the number of modified segments and the estimated number of resolved issues
            return { modifiedSegments: modifiedSegmentsCount, resolvedIssues: resolvedIssuesCount };
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for file ${fileId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '批量解决问题');
        }
    }
    /**
     * Mark a whole file as finalized after review.
     * This might involve checking if all segments are confirmed.
     */
    async finalizeFileReview(fileId, userId) {
        const methodName = 'finalizeFileReview';
        (0, errorHandler_1.validateId)(fileId, '文件');
        (0, errorHandler_1.validateId)(userId, '用户');
        try {
            // 1. Fetch File and Project
            const file = await file_model_1.File.findById(fileId).exec();
            (0, errorHandler_1.validateEntityExists)(file, '文件');
            const project = await project_model_1.default.findById(file.projectId).exec();
            (0, errorHandler_1.validateEntityExists)(project, '关联项目');
            // 2. Check Permissions (Manager?)
            const userObjectId = new mongoose_1.Types.ObjectId(userId); // User finalizing
            if (!project.manager || !project.manager.equals(userObjectId)) {
                throw new errors_1.ForbiddenError(`用户 (${userId}) 不是项目经理，无权最终确认文件审校`);
            }
            // 3. Check File Status (Must be REVIEWING or similar?)
            if (file.status !== file_model_1.FileStatus.REVIEWING && file.status !== file_model_1.FileStatus.TRANSLATED) {
                // Allow finalizing from TRANSLATED if no explicit review phase is used?
                // Or should we enforce REVIEWING status?
                logger_1.default.warn(`[${methodName}] Finalizing file ${fileId} which is in status ${file.status}. Consider enforcing REVIEWING status.`);
                // Optional: Throw error if status is not REVIEWING
                // throw new ValidationError(`文件状态 (${file.status}) 不允许最终确认`);
            }
            // 4. Check if all segments are CONFIRMED (using existing helper)
            await this.checkFileCompletionStatus(fileId);
            // Re-fetch file to get potentially updated status
            const updatedFile = await file_model_1.File.findById(fileId).exec();
            (0, errorHandler_1.validateEntityExists)(updatedFile, '更新后的文件');
            if (updatedFile.status !== file_model_1.FileStatus.COMPLETED) {
                const incompleteCount = await segment_model_1.Segment.countDocuments({ fileId: file._id, status: { $ne: segment_model_1.SegmentStatus.CONFIRMED } });
                logger_1.default.warn(`[${methodName}] Attempted to finalize file ${fileId}, but ${incompleteCount} segments are not confirmed. File status remains ${updatedFile.status}.`);
                // Decide: Throw an error or just return the current file state?
                // Throwing error might be clearer feedback.
                throw new errors_1.ValidationError(`无法最终确认文件，仍有 ${incompleteCount} 个段落未确认`);
            }
            // 5. Log and Return
            logger_1.default.info(`[${methodName}] File ${fileId} review finalized by manager ${userId}. Status set to ${updatedFile.status}.`);
            return updatedFile;
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName} for file ${fileId}:`, error);
            throw (0, errorHandler_1.handleServiceError)(error, this.serviceName, methodName, '最终确认文件审校');
        }
    }
}
exports.ReviewService = ReviewService;
// 创建并导出默认实例
exports.reviewService = new ReviewService();
