"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewService = exports.ReviewService = void 0;
const aiServiceFactory_1 = require("../services/translation/aiServiceFactory");
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
const openai_1 = __importDefault(require("openai"));
/**
 * 审校服务类
 */
class ReviewService /* implements IReviewService */ {
    constructor() {
        this.serviceName = 'ReviewService';
        this.aiServiceFactory = aiServiceFactory_1.aiServiceFactory;
        this.openaiClient = new openai_1.default({
            apiKey: config_1.config.openai.apiKey,
            timeout: config_1.config.openai.timeout || 60000,
        });
    }
    /**
     * 开始AI审校
     */
    async startAIReview(segmentId, userId, options) {
        const methodName = 'startAIReview';
        (0, errorHandler_1.validateId)(segmentId, '段落');
        (0, errorHandler_1.validateId)(userId, '用户');
        let segment = null;
        try {
            // 1. Fetch Segment & related data
            segment = await segment_model_1.Segment.findById(segmentId).exec();
            (0, errorHandler_1.validateEntityExists)(segment, '段落');
            // 2. Check status
            if (segment.status !== segment_model_1.SegmentStatus.TRANSLATED && segment.status !== segment_model_1.SegmentStatus.REVIEW_FAILED) {
                throw new errors_1.ValidationError(`段落状态不允许审校，当前状态: ${segment.status}`);
            }
            if (!segment.translation) {
                throw new errors_1.ValidationError('段落没有翻译内容，无法进行审校');
            }
            // 3. Get File & Project for context and permissions
            const file = await file_model_1.File.findById(segment.fileId).exec();
            (0, errorHandler_1.validateEntityExists)(file, '关联文件');
            const project = await project_model_1.default.findById(file.projectId).populate('reviewPromptTemplate').populate('defaultReviewPromptTemplate').exec();
            (0, errorHandler_1.validateEntityExists)(project, '关联项目');
            // 4. Check Permissions (Manager or assigned Reviewer?)
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
            // Use correct manager field
            const isManager = project.manager?.equals(userObjectId);
            const isReviewer = project.reviewers?.some((r) => r.equals(userObjectId));
            // Removed check for non-existent segment.translator
            if (!isManager && !isReviewer) {
                // Adjusted error message as translator role isn't checked here
                throw new errors_1.ForbiddenError(`用户 (${userId}) 不是项目经理或审校员，无权审校项目 (${project._id}) 中的段落`);
            }
            // 5. Update segment status to REVIEWING
            segment.status = segment_model_1.SegmentStatus.REVIEWING;
            segment.reviewer = userObjectId;
            segment.reviewCompletedAt = undefined;
            segment.reviewMetadata = undefined;
            segment.issues = [];
            await segment.save();
            // 6. Prepare Prompt Context & Build Prompt
            const reviewTemplate = options?.promptTemplateId || project.reviewPromptTemplate || project.defaultReviewPromptTemplate;
            let reviewTemplateId;
            let reviewTemplateObjectId = undefined;
            if (reviewTemplate) {
                if (typeof reviewTemplate === 'string' && mongoose_1.Types.ObjectId.isValid(reviewTemplate)) {
                    reviewTemplateId = reviewTemplate;
                    reviewTemplateObjectId = new mongoose_1.Types.ObjectId(reviewTemplate);
                }
                else if (reviewTemplate instanceof mongoose_1.Types.ObjectId) {
                    reviewTemplateId = reviewTemplate;
                    reviewTemplateObjectId = reviewTemplate;
                }
                else if (typeof reviewTemplate === 'object' && reviewTemplate._id) {
                    reviewTemplateId = reviewTemplate._id;
                    reviewTemplateObjectId = reviewTemplate._id;
                }
            }
            const promptContext = {
                promptTemplateId: reviewTemplateId,
                sourceLanguage: file.metadata.sourceLanguage,
                targetLanguage: file.metadata.targetLanguage,
                domain: project.domain,
                industry: project.industry,
            };
            const reviewPromptData = await promptProcessor_1.promptProcessor.buildReviewPrompt(segment.sourceText, segment.translation, promptContext);
            // 7. Get AI Provider & Model
            const aiProvider = options?.aiProvider || ai_service_types_1.AIProvider.OPENAI;
            const model = options?.aiModel || config_1.config.openai.defaultModel || 'gpt-4-turbo'; // Use config default
            // 8. Execute AI review directly using OpenAI client
            const startTime = Date.now();
            let aiReviewResult;
            let processingTime = 0;
            try {
                logger_1.default.info(`Calling OpenAI ${model} for review...`);
                const response = await this.openaiClient.chat.completions.create({
                    model: model,
                    messages: [
                        { role: 'system', content: reviewPromptData.systemInstruction },
                        { role: 'user', content: reviewPromptData.userPrompt }
                    ],
                    temperature: options?.temperature || 0.5,
                });
                processingTime = Date.now() - startTime;
                const responseContent = response.choices[0]?.message?.content;
                if (!responseContent) {
                    throw new errors_1.AppError('OpenAI did not return content for review.', 500);
                }
                let parsedResponse = {};
                try {
                    parsedResponse = JSON.parse(responseContent);
                }
                catch (parseError) {
                    logger_1.default.error('Failed to parse OpenAI JSON response for review:', { responseContent, parseError });
                    parsedResponse.suggestedTranslation = responseContent.trim();
                    // Create AIReviewIssue without status
                    parsedResponse.issues = [{
                            type: segment_model_1.IssueType.OTHER,
                            severity: segment_model_1.IssueSeverity.HIGH,
                            description: 'AI response format error, could not parse JSON.'
                        }];
                    parsedResponse.scores = [];
                }
                // Construct the full AIReviewResponse
                aiReviewResult = {
                    suggestedTranslation: parsedResponse.suggestedTranslation || segment.translation,
                    issues: parsedResponse.issues || [],
                    scores: parsedResponse.scores || [],
                    metadata: {
                        provider: ai_service_types_1.AIProvider.OPENAI,
                        model: response.model || model,
                        processingTime: processingTime,
                        confidence: parsedResponse.metadata?.confidence || 0,
                        wordCount: (parsedResponse.suggestedTranslation || '').split(/\s+/).length,
                        characterCount: (parsedResponse.suggestedTranslation || '').length,
                        tokens: {
                            input: response.usage?.prompt_tokens ?? 0,
                            output: response.usage?.completion_tokens ?? 0,
                        },
                        modificationDegree: parsedResponse.metadata?.modificationDegree || 0,
                    }
                };
            }
            catch (aiError) {
                logger_1.default.error('OpenAI审校调用失败', { segmentId, model, error: aiError?.message || aiError });
                segment.status = segment_model_1.SegmentStatus.REVIEW_FAILED;
                segment.error = `AI审校失败: ${aiError?.message || 'Unknown OpenAI error'}`;
                await segment.save();
                throw new errors_1.AppError(`AI审校调用失败: ${aiError?.message || 'Unknown OpenAI error'}`, 500);
            }
            // 9. Process AI Issues (Map AIReviewIssue to IIssue)
            const userObjectIdForIssue = new mongoose_1.Types.ObjectId(userId); // Reuse userObjectId from permission check
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
            // 10. Update Segment with Review Metadata and Issues
            segment.review = aiReviewResult.suggestedTranslation; // Store AI suggestion in 'review' field
            segment.issues = newIssues;
            segment.reviewMetadata = {
                aiModel: aiReviewResult.metadata?.model,
                promptTemplateId: reviewTemplateObjectId,
                tokenCount: (aiReviewResult.metadata?.tokens?.input ?? 0) + (aiReviewResult.metadata?.tokens?.output ?? 0),
                processingTime: processingTime,
                acceptedChanges: false,
                modificationDegree: aiReviewResult.metadata?.modificationDegree
            };
            segment.status = segment_model_1.SegmentStatus.REVIEW_PENDING;
            segment.error = undefined;
            segment.markModified('issues');
            segment.markModified('reviewMetadata');
            await segment.save();
            logger_1.default.info(`AI Review completed for segment ${segmentId}`);
            // 11. Return updated segment
            return segment;
        }
        catch (error) {
            if (segment && segment.status === segment_model_1.SegmentStatus.REVIEWING && !(error instanceof errors_1.ForbiddenError || error instanceof errors_1.ValidationError)) {
                try {
                    segment.status = segment_model_1.SegmentStatus.REVIEW_FAILED;
                    segment.error = `审校处理失败: ${error instanceof Error ? error.message : '未知错误'}`;
                    await segment.save();
                }
                catch (failSaveError) {
                    logger_1.default.error(`Failed to mark segment ${segmentId} as REVIEW_FAILED after error:`, failSaveError);
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
                segment.status !== segment_model_1.SegmentStatus.REVIEW_FAILED &&
                segment.status !== segment_model_1.SegmentStatus.REVIEWING) {
                throw new errors_1.ValidationError(`段落状态 (${segment.status}) 不允许完成审校`);
            }
            // 3. Check Permissions (Manager or assigned Reviewer)
            const file = await file_model_1.File.findById(segment.fileId).exec();
            (0, errorHandler_1.validateEntityExists)(file, '关联文件');
            const project = await project_model_1.default.findById(file.projectId).exec();
            (0, errorHandler_1.validateEntityExists)(project, '关联项目');
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
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
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
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
            if (![segment_model_1.SegmentStatus.REVIEW_IN_PROGRESS, segment_model_1.SegmentStatus.TRANSLATED, segment_model_1.SegmentStatus.REVIEW_FAILED, segment_model_1.SegmentStatus.REVIEW_PENDING, segment_model_1.SegmentStatus.REVIEW_COMPLETED, segment_model_1.SegmentStatus.COMPLETED].includes(segment.status)) {
                throw new errors_1.ValidationError(`段落状态 (${segment.status}) 不允许添加问题`);
            }
            // 3. Get project and check permissions (Manager or Reviewer)
            const file = await file_model_1.File.findById(segment.fileId);
            (0, errorHandler_1.validateEntityExists)(file, '关联文件');
            const projectForPermission = await project_model_1.default.findById(file.projectId);
            (0, errorHandler_1.validateEntityExists)(projectForPermission, '关联项目');
            const reviewerIds = projectForPermission.reviewers?.map(id => id.toString());
            // Use correct manager field
            const managerIdStr = projectForPermission.manager?.toString();
            (0, errorHandler_1.validateOwnership)(managerIdStr, userId, '添加段落问题', true, reviewerIds);
            // 4. Create the new issue object, ensuring defaults/required fields
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
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
                segment.status !== segment_model_1.SegmentStatus.REVIEW_FAILED &&
                segment.status !== segment_model_1.SegmentStatus.REVIEWING) {
                throw new errors_1.ValidationError(`无法在当前状态 (${segment.status}) 下解决问题`);
            }
            const file = await file_model_1.File.findById(segment.fileId).exec();
            (0, errorHandler_1.validateEntityExists)(file, '关联文件');
            const project = await project_model_1.default.findById(file.projectId).exec();
            (0, errorHandler_1.validateEntityExists)(project, '关联项目');
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
            const isManager = project.manager?.equals(userObjectId); // Use manager
            const isAssignedReviewer = segment.reviewer?.equals(userObjectId);
            if (!isManager && !isAssignedReviewer) {
                throw new errors_1.ForbiddenError(`用户 (${userId}) 不是该段落的审校员或项目经理，无权解决问题`);
            }
            if (!segment.issues || issueIndex >= segment.issues.length) {
                throw new errors_1.NotFoundError(`索引 ${issueIndex} 处的问题不存在`);
            }
            const issue = segment.issues[issueIndex];
            if (issue.status !== segment_model_1.IssueStatus.OPEN && issue.status !== segment_model_1.IssueStatus.IN_PROGRESS) {
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
            const userObjectId = new mongoose_1.Types.ObjectId(userId);
            if (!project.manager || !project.manager.equals(userObjectId)) {
                throw new errors_1.ForbiddenError(`用户 (${userId}) 不是项目经理，无权确认审校`);
            }
            const unresolvedIssues = segment.issues?.filter(issue => issue.status === segment_model_1.IssueStatus.OPEN || issue.status === segment_model_1.IssueStatus.IN_PROGRESS);
            if (unresolvedIssues && unresolvedIssues.length > 0) {
                logger_1.default.warn(`Finalizing segment ${segmentId} with ${unresolvedIssues.length} unresolved issues.`);
            }
            segment.status = segment_model_1.SegmentStatus.COMPLETED;
            segment.error = undefined;
            await segment.save();
            logger_1.default.info(`Segment ${segmentId} review finalized by manager ${userId}`);
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
                status: segment_model_1.SegmentStatus.COMPLETED
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
}
exports.ReviewService = ReviewService;
// 创建并导出默认实例
exports.reviewService = new ReviewService();
