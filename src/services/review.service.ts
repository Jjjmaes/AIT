import { aiServiceFactory } from '../services/translation/aiServiceFactory';
import { AIReviewService } from './ai-review.service';
import { Segment, SegmentStatus, IssueType, ReviewScoreType, ISegment, IIssue, IssueSeverity, IssueStatus, IReviewScore } from '../models/segment.model';
import { File, FileStatus, IFile } from '../models/file.model';
import Project, { IProject } from '../models/project.model';
import { AppError, NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../utils/errors';
import logger from '../utils/logger';
import mongoose, { Types } from 'mongoose';
import { AIProvider } from '../types/ai-service.types';
import { ReviewAdapter, AIReviewResponse, AIReviewIssue } from './translation/ai-adapters/review.adapter';
import { handleServiceError, validateId, validateEntityExists, validateOwnership } from '../utils/errorHandler';
import User, { IUser } from '../models/user.model';
import { promptProcessor } from '../utils/promptProcessor';
import { config } from '../config';
import OpenAI from 'openai';

// Define structure for review submission data
interface CompleteReviewData {
  finalTranslation: string; // The confirmed final translation
  issuesResolution?: Array<{ // Optional: Instructions on how issues were handled
      issueIndex: number; // Index in the segment.issues array
      resolution: IIssue['resolution']; // How the issue was resolved
  }>;
  comment?: string; // Optional review comment
  acceptAllSuggestions?: boolean; // Flag if reviewer accepted all AI suggestions (simplifies issue handling)
}

/**
 * 审校服务类
 */
export class ReviewService /* implements IReviewService */ {
  private serviceName = 'ReviewService';
  private aiServiceFactory: typeof aiServiceFactory;
  private openaiClient: OpenAI;

  constructor() {
    this.aiServiceFactory = aiServiceFactory;
    this.openaiClient = new OpenAI({
      apiKey: config.openai.apiKey,
      timeout: config.openai.timeout || 60000,
    });
  }

  /**
   * 开始AI审校
   */
  async startAIReview(segmentId: string, userId: string, options?: any): Promise<ISegment> {
    const methodName = 'startAIReview';
    validateId(segmentId, '段落');
    validateId(userId, '用户');
    let segment: ISegment | null = null;

    try {
      // 1. Fetch Segment & related data
      segment = await Segment.findById(segmentId).exec();
      validateEntityExists(segment, '段落');

      // 2. Check status
      if (segment.status !== SegmentStatus.TRANSLATED && segment.status !== SegmentStatus.REVIEW_FAILED) {
        throw new ValidationError(`段落状态不允许审校，当前状态: ${segment.status}`);
      }
      if (!segment.translation) {
        throw new ValidationError('段落没有翻译内容，无法进行审校');
      }

      // 3. Get File & Project for context and permissions
      const file = await File.findById(segment.fileId).exec();
      validateEntityExists(file, '关联文件');
      const project = await Project.findById(file.projectId).populate('reviewPromptTemplate').populate('defaultReviewPromptTemplate').exec();
      validateEntityExists(project, '关联项目');

      // 4. Check Permissions (Manager or assigned Reviewer?)
      const userObjectId = new Types.ObjectId(userId);
      // Use correct manager field
      const isManager = project.manager?.equals(userObjectId);
      const isReviewer = project.reviewers?.some((r: Types.ObjectId) => r.equals(userObjectId));
      // Removed check for non-existent segment.translator
      if (!isManager && !isReviewer) {
        // Adjusted error message as translator role isn't checked here
        throw new ForbiddenError(`用户 (${userId}) 不是项目经理或审校员，无权审校项目 (${project._id}) 中的段落`);
      }

      // 5. Update segment status to REVIEWING
      segment.status = SegmentStatus.REVIEWING;
      segment.reviewer = userObjectId;
      segment.reviewCompletedAt = undefined;
      segment.reviewMetadata = undefined;
      segment.issues = [];
      await segment.save();

      // 6. Prepare Prompt Context & Build Prompt
      const reviewTemplate = options?.promptTemplateId || project.reviewPromptTemplate || project.defaultReviewPromptTemplate;
      let reviewTemplateId: string | Types.ObjectId | undefined;
      let reviewTemplateObjectId: Types.ObjectId | undefined = undefined;
      if (reviewTemplate) {
          if (typeof reviewTemplate === 'string' && Types.ObjectId.isValid(reviewTemplate)) {
              reviewTemplateId = reviewTemplate;
              reviewTemplateObjectId = new Types.ObjectId(reviewTemplate);
          }
          else if (reviewTemplate instanceof Types.ObjectId) {
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
      const reviewPromptData = await promptProcessor.buildReviewPrompt(
          segment.sourceText,
          segment.translation!,
          promptContext
      );

      // 7. Get AI Provider & Model
      const aiProvider = options?.aiProvider || AIProvider.OPENAI;
      const model = options?.aiModel || config.openai.defaultModel || 'gpt-4-turbo'; // Use config default

      // 8. Execute AI review directly using OpenAI client
      const startTime = Date.now();
      let aiReviewResult: AIReviewResponse;
      let processingTime: number = 0;

      try {
        logger.info(`Calling OpenAI ${model} for review...`);
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
            throw new AppError('OpenAI did not return content for review.', 500);
        }

        let parsedResponse: Partial<AIReviewResponse> = {};
        try {
            parsedResponse = JSON.parse(responseContent);
        } catch (parseError) {
            logger.error('Failed to parse OpenAI JSON response for review:', { responseContent, parseError });
            parsedResponse.suggestedTranslation = responseContent.trim();
            // Create AIReviewIssue without status
            parsedResponse.issues = [{
                type: IssueType.OTHER,
                severity: IssueSeverity.HIGH,
                description: 'AI response format error, could not parse JSON.'
            } as AIReviewIssue];
            parsedResponse.scores = [];
        }

        // Construct the full AIReviewResponse
        aiReviewResult = {
            suggestedTranslation: parsedResponse.suggestedTranslation || segment.translation!,
            issues: parsedResponse.issues || [],
            scores: parsedResponse.scores || [],
            metadata: {
                provider: AIProvider.OPENAI,
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

      } catch (aiError: any) {
         logger.error('OpenAI审校调用失败', { segmentId, model, error: aiError?.message || aiError });
         segment.status = SegmentStatus.REVIEW_FAILED;
         segment.error = `AI审校失败: ${aiError?.message || 'Unknown OpenAI error'}`;
         await segment.save();
         throw new AppError(`AI审校调用失败: ${aiError?.message || 'Unknown OpenAI error'}`, 500);
      }

      // 9. Process AI Issues (Map AIReviewIssue to IIssue)
      const userObjectIdForIssue = new Types.ObjectId(userId); // Reuse userObjectId from permission check
      const newIssues: IIssue[] = (aiReviewResult.issues || []).map((aiIssue: AIReviewIssue): IIssue => ({
          type: aiIssue.type || IssueType.OTHER,
          severity: aiIssue.severity || IssueSeverity.MEDIUM,
          description: aiIssue.description || 'AI detected issue',
          position: aiIssue.position,
          suggestion: aiIssue.suggestion,
          status: IssueStatus.OPEN,
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
      segment.status = SegmentStatus.REVIEW_PENDING;
      segment.error = undefined;
      segment.markModified('issues');
      segment.markModified('reviewMetadata');

      await segment.save();
      logger.info(`AI Review completed for segment ${segmentId}`);

      // 11. Return updated segment
      return segment;

    } catch (error) {
      if (segment && segment.status === SegmentStatus.REVIEWING && !(error instanceof ForbiddenError || error instanceof ValidationError)) {
          try {
             segment.status = SegmentStatus.REVIEW_FAILED;
             segment.error = `审校处理失败: ${error instanceof Error ? error.message : '未知错误'}`;
             await segment.save();
          } catch (failSaveError) {
              logger.error(`Failed to mark segment ${segmentId} as REVIEW_FAILED after error:`, failSaveError);
          }
      }
      logger.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, 'AI审校');
    }
  }
  
  /**
   * 完成段落审校 (Reviewer submits their work)
   */
  async completeSegmentReview(segmentId: string, userId: string, reviewData: CompleteReviewData): Promise<ISegment> {
    const methodName = 'completeSegmentReview';
    validateId(segmentId, '段落');
    validateId(userId, '审校用户');
    if (!reviewData || !reviewData.finalTranslation) {
        throw new ValidationError('缺少必要的审校数据: finalTranslation');
    }

    let segment: ISegment | null = null;
    try {
      // 1. Fetch Segment
      segment = await Segment.findById(segmentId).populate('issues').exec(); // Populate issues
      validateEntityExists(segment, '段落');

      // 2. Check Status
      if (segment.status !== SegmentStatus.REVIEW_PENDING &&
          segment.status !== SegmentStatus.REVIEW_FAILED &&
          segment.status !== SegmentStatus.REVIEWING) {
          throw new ValidationError(`段落状态 (${segment.status}) 不允许完成审校`);
      }

      // 3. Check Permissions (Manager or assigned Reviewer)
      const file = await File.findById(segment.fileId).exec();
      validateEntityExists(file, '关联文件');
      const project = await Project.findById(file.projectId).exec();
      validateEntityExists(project, '关联项目');
      const userObjectId = new Types.ObjectId(userId);
      // Use correct manager field
      const isManager = project.manager?.equals(userObjectId);
      const isAssignedReviewer = segment.reviewer?.equals(userObjectId);

      if (!isManager && !isAssignedReviewer) {
          throw new ForbiddenError(`用户 (${userId}) 不是该段落的指定审校员，也非项目经理，无权完成审校`);
      }

      // 4. Process Issue Resolutions
      if (reviewData.issuesResolution && segment.issues) {
          for (const res of reviewData.issuesResolution) {
              // Explicitly check if res.resolution is defined
              if (!res.resolution) {
                  logger.warn(`Missing resolution details for issue index ${res.issueIndex}, segment ${segmentId}`);
                  continue; // Skip this iteration if resolution details are missing
              }
              
              if (res.issueIndex >= 0 && res.issueIndex < segment.issues.length) {
                  const issue = segment.issues[res.issueIndex];
                  if (issue && (issue.status === IssueStatus.OPEN || issue.status === IssueStatus.IN_PROGRESS)) {
                      issue.resolution = res.resolution; // Safe to assign
                      issue.resolvedAt = new Date();
                      issue.resolvedBy = userObjectId;
                      // Safe to access res.resolution.action now
                      switch (res.resolution.action) { 
                          case 'accept': issue.status = IssueStatus.RESOLVED; break;
                          case 'modify': issue.status = IssueStatus.RESOLVED; break;
                          case 'reject': issue.status = IssueStatus.REJECTED; break;
                          default: 
                              issue.status = IssueStatus.RESOLVED; 
                              logger.warn(`Unknown resolution action '${res.resolution.action}' for issue ${res.issueIndex}, segment ${segmentId}. Marking as resolved.`);
                              break;
                      }
      } else {
                      logger.warn(`Issue index ${res.issueIndex} invalid or issue already resolved/closed for segment ${segmentId}`);
                  }
              } else {
                  logger.warn(`Invalid issue index ${res.issueIndex} provided for segment ${segmentId}`);
              }
          }
          segment.markModified('issues');
      } else if (reviewData.acceptAllSuggestions && segment.issues) {
           segment.issues.forEach(issue => {
               if (issue.status === IssueStatus.OPEN) {
                   issue.status = IssueStatus.RESOLVED;
                   issue.resolution = { action: 'accept', comment: 'Accepted AI suggestion' };
                   issue.resolvedAt = new Date();
                   issue.resolvedBy = userObjectId;
               }
           });
           segment.markModified('issues');
      }

      // 5. Update Segment Data
      segment.finalText = reviewData.finalTranslation;
      segment.status = SegmentStatus.REVIEW_COMPLETED;
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
      logger.info(`Segment ${segmentId} review completed by user ${userId}`);

      // TODO: Optionally trigger file progress update check here
      // projectService.updateFileProgress(file._id.toString(), userId);

      // 7. Return Updated Segment
      return segment;

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '完成段落审校');
    }
  }
  
  /**
   * 获取段落审校结果 (Simplified - returns segment data)
   */
  async getSegmentReviewResult(segmentId: string, userId: string): Promise<ISegment> {
    const methodName = 'getSegmentReviewResult';
    validateId(segmentId, '段落');
    validateId(userId, '用户');

    try {
      // 1. Fetch Segment, populate reviewer
      const segment = await Segment.findById(segmentId)
        .populate('reviewer', 'id fullName email') // Populate reviewer details
        .populate('issues') // Populate issues
        .exec();
      validateEntityExists(segment, '段落');

      // 2. Get File & Project for permissions
      const file = await File.findById(segment.fileId).exec();
      validateEntityExists(file, '关联文件');
      const project = await Project.findById(file.projectId).exec();
      validateEntityExists(project, '关联项目');

      // 3. Check Permissions (Manager or assigned Reviewer)
      const userObjectId = new Types.ObjectId(userId);
      // Use correct manager field
      const isManager = project.manager?.equals(userObjectId);
      const isReviewer = project.reviewers?.some((r: Types.ObjectId) => r.equals(userObjectId));
      const isAssignedReviewer = segment.reviewer?._id?.equals(userObjectId);

      // Allow manager, project reviewer, or the specific segment reviewer to view
      if (!isManager && !isReviewer && !isAssignedReviewer) {
        throw new ForbiddenError(`用户 (${userId}) 无权查看段落 (${segmentId}) 的审校结果`);
      }

      // 4. Return the full segment data
      // The segment now contains reviewMetadata, issues, finalText etc.
      return segment;

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '获取段落审校结果');
    }
  }


  /**
   * 获取段落上下文 (No changes needed here)
   */
  private async getContextSegments(segment: ISegment, file: IFile): Promise<any[]> {
    try {
      const currentIndex = segment.index; // Assuming segments have an index
      const contextSize = 2; // Get 2 segments before and 2 after

      const [prevSegments, nextSegments] = await Promise.all([
          Segment.find({ fileId: file._id, index: { $lt: currentIndex } })
                 .sort({ index: -1 })
                 .limit(contextSize)
                 .exec(),
          Segment.find({ fileId: file._id, index: { $gt: currentIndex } })
                 .sort({ index: 1 })
                 .limit(contextSize)
                 .exec()
      ]);

      // Combine and format
      const context = [...prevSegments.reverse(), ...nextSegments];

      return context
        .filter(seg => seg.sourceText && (seg.translation || seg.status === SegmentStatus.TRANSLATED))
        .map(seg => ({
          sourceText: seg.sourceText,
          translation: seg.translation,
          position: seg.index < currentIndex ? 'before' : 'after'
        }));
    } catch (error) {
      logger.error('获取上下文段落失败', { segmentId: segment._id, fileId: file._id, error });
      return [];
    }
  }

  /**
   * 添加段落审校问题
   */
  async addSegmentIssue(segmentId: string, userId: string, issueData: IIssue): Promise<IIssue> { // Accept IIssue structure directly
    const methodName = 'addSegmentIssue';
    validateId(segmentId, '段落');
    validateId(userId, '用户');
    // Validate required fields from IIssue
    if (!issueData || !issueData.type || !issueData.description || !issueData.severity || !issueData.status) {
      throw new ValidationError('问题数据不完整 (缺少类型, 描述, 严重性或状态)');
    }

    try {
      // 1. Find segment
      const segment = await Segment.findById(segmentId).exec();
      validateEntityExists(segment, '段落');

      // 2. Check status (allow adding issues during review phases or even completed)
       if (![SegmentStatus.REVIEW_IN_PROGRESS, SegmentStatus.TRANSLATED, SegmentStatus.REVIEW_FAILED, SegmentStatus.REVIEW_PENDING, SegmentStatus.REVIEW_COMPLETED, SegmentStatus.COMPLETED].includes(segment.status)) {
         throw new ValidationError(`段落状态 (${segment.status}) 不允许添加问题`);
       }

      // 3. Get project and check permissions (Manager or Reviewer)
      const file = await File.findById(segment.fileId);
      validateEntityExists(file, '关联文件');
      const projectForPermission = await Project.findById(file.projectId);
      validateEntityExists(projectForPermission, '关联项目');
      const reviewerIds = projectForPermission.reviewers?.map(id => id.toString());
      // Use correct manager field
      const managerIdStr = projectForPermission.manager?.toString();
      validateOwnership(managerIdStr, userId, '添加段落问题', true, reviewerIds);

      // 4. Create the new issue object, ensuring defaults/required fields
      const userObjectId = new Types.ObjectId(userId);
      const newIssue: IIssue = {
        ...issueData, // Spread provided data
        status: issueData.status || IssueStatus.OPEN, // Ensure status
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
      logger.info(`Issue added to segment ${segmentId} by user ${userId}`);
      return segment.issues[segment.issues.length - 1];

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '添加段落问题');
    }
  }

  /**
   * 解决段落审校问题 (No changes needed here as it was updated recently)
   */
  async resolveSegmentIssue(
    segmentId: string,
    issueIndex: number,
    userId: string,
    resolution: IIssue['resolution']
  ): Promise<ISegment> {
      // ... recent implementation looks okay ...
      const methodName = 'resolveSegmentIssue';
      validateId(segmentId, '段落');
      validateId(userId, '用户');
      if (issueIndex === undefined || issueIndex < 0) {
          throw new ValidationError('无效的问题索引');
      }
      if (!resolution || !resolution.action) {
           throw new ValidationError('缺少问题解决方案或操作');
      }

      let segment: ISegment | null = null;
      try {
        segment = await Segment.findById(segmentId).exec();
        validateEntityExists(segment, '段落');

        if (segment.status !== SegmentStatus.REVIEW_PENDING &&
            segment.status !== SegmentStatus.REVIEW_FAILED &&
            segment.status !== SegmentStatus.REVIEWING) {
            throw new ValidationError(`无法在当前状态 (${segment.status}) 下解决问题`);
        }

        const file = await File.findById(segment.fileId).exec();
        validateEntityExists(file, '关联文件');
      const project = await Project.findById(file.projectId).exec();
        validateEntityExists(project, '关联项目');
        const userObjectId = new Types.ObjectId(userId);
        const isManager = project.manager?.equals(userObjectId); // Use manager
        const isAssignedReviewer = segment.reviewer?.equals(userObjectId);

        if (!isManager && !isAssignedReviewer) {
            throw new ForbiddenError(`用户 (${userId}) 不是该段落的审校员或项目经理，无权解决问题`);
        }

        if (!segment.issues || issueIndex >= segment.issues.length) {
             throw new NotFoundError(`索引 ${issueIndex} 处的问题不存在`);
        }

        const issue = segment.issues[issueIndex];
        if (issue.status !== IssueStatus.OPEN && issue.status !== IssueStatus.IN_PROGRESS) {
            logger.warn(`Issue at index ${issueIndex} for segment ${segmentId} is not open or in progress (status: ${issue.status}). Skipping resolution.`);
            return segment;
        }

        issue.resolution = resolution;
      issue.resolvedAt = new Date();
        issue.resolvedBy = userObjectId;

        switch (resolution.action) {
            case 'accept': case 'modify': issue.status = IssueStatus.RESOLVED; break;
            case 'reject': issue.status = IssueStatus.REJECTED; break;
            default: issue.status = IssueStatus.RESOLVED; break;
        }

        segment.markModified('issues');
        await segment.save();
        logger.info(`Issue ${issueIndex} for segment ${segmentId} resolved by user ${userId} with action: ${resolution.action}`);

        return segment;

    } catch (error) {
         logger.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}, issue ${issueIndex}:`, error);
        throw handleServiceError(error, this.serviceName, methodName, '解决审校问题');
    }
  }

  /**
   * 确认段落审校结果 (Manager finalizes) (No changes needed here as it was updated recently)
   */
  async finalizeSegmentReview(segmentId: string, userId: string): Promise<ISegment> {
      // ... recent implementation looks okay ...
      const methodName = 'finalizeSegmentReview';
      validateId(segmentId, '段落');
      validateId(userId, '用户');

      let segment: ISegment | null = null;
      try {
        segment = await Segment.findById(segmentId).populate('issues').exec();
        validateEntityExists(segment, '段落');

      if (segment.status !== SegmentStatus.REVIEW_COMPLETED) {
            throw new ValidationError(`无法确认状态为 (${segment.status}) 的段落审校`);
      }

      const file = await File.findById(segment.fileId).exec();
        validateEntityExists(file, '关联文件');
      const project = await Project.findById(file.projectId).exec();
        validateEntityExists(project, '关联项目');
        const userObjectId = new Types.ObjectId(userId);

        if (!project.manager || !project.manager.equals(userObjectId)) {
            throw new ForbiddenError(`用户 (${userId}) 不是项目经理，无权确认审校`);
        }

        const unresolvedIssues = segment.issues?.filter(issue =>
            issue.status === IssueStatus.OPEN || issue.status === IssueStatus.IN_PROGRESS
        );
        if (unresolvedIssues && unresolvedIssues.length > 0) {
            logger.warn(`Finalizing segment ${segmentId} with ${unresolvedIssues.length} unresolved issues.`);
        }

      segment.status = SegmentStatus.COMPLETED;
        segment.error = undefined;

      await segment.save();
        logger.info(`Segment ${segmentId} review finalized by manager ${userId}`);

        // Use file._id.toString() for the check
        this.checkFileCompletionStatus(file._id.toString()).catch(err => {
           logger.error(`Failed to check/update file completion status after finalizing segment ${segmentId}:`, err);
        });

      return segment;

    } catch (error) {
        logger.error(`Error in ${this.serviceName}.${methodName} for segment ${segmentId}:`, error);
        throw handleServiceError(error, this.serviceName, methodName, '确认段落审校');
    }
  }

  /**
   * 检查文件完成状态并更新 (No changes needed here as it was updated recently)
   */
  private async checkFileCompletionStatus(fileId: string): Promise<void> {
       // ... recent implementation looks okay ...
       try {
        const file = await File.findById(fileId);
        if (!file) return;

        const totalSegments = await Segment.countDocuments({ fileId: file._id });
        const completedSegments = await Segment.countDocuments({
            fileId: file._id,
            status: SegmentStatus.COMPLETED
        });

        if (totalSegments > 0 && completedSegments === totalSegments) {
             if (file.status !== FileStatus.COMPLETED) {
                 file.status = FileStatus.COMPLETED;
                 file.processingCompletedAt = new Date();
                 await file.save();
                 logger.info(`File ${fileId} marked as COMPLETED as all segments are finalized.`);
             }
        } else {
             if (file.status === FileStatus.COMPLETED) {
                 const reviewCompletedCount = await Segment.countDocuments({ fileId: file._id, status: SegmentStatus.REVIEW_COMPLETED });
                 const reviewPendingCount = await Segment.countDocuments({ fileId: file._id, status: SegmentStatus.REVIEW_PENDING });
                 const reviewingCount = await Segment.countDocuments({ fileId: file._id, status: SegmentStatus.REVIEWING });
                 const translatedCount = await Segment.countDocuments({ fileId: file._id, status: SegmentStatus.TRANSLATED });

                 let newStatus = FileStatus.PENDING;
                 if (reviewCompletedCount > 0 || reviewPendingCount > 0 || reviewingCount > 0) {
                     newStatus = FileStatus.REVIEWING;
                 } else if (translatedCount > 0) {
                    newStatus = FileStatus.TRANSLATED;
                 }

                 file.status = newStatus;
                 await file.save();
                 logger.warn(`File ${fileId} status reverted from COMPLETED to ${newStatus} as not all segments are finalized.`);
             }
        }
    } catch (error) {
        logger.error(`Error checking file completion status for ${fileId}:`, error);
    }
  }


  // ===== Helper/Utility Methods =====

  /** Recalculate modification degree between two strings (simple implementation) */
  private calculateModificationDegree(original: string, modified: string): number {
    if (!original || !modified) return 0;
    if (original === modified) return 0;

    // Simple Levenshtein distance based calculation
    // For more accuracy, consider a library like 'fast-levenshtein'
    const distance = this.levenshteinDistance(original, modified);
    const maxLength = Math.max(original.length, modified.length);
    if (maxLength === 0) return 0;
    return Math.min(1, distance / maxLength); // Cap at 1
  }

  // Basic Levenshtein distance implementation
  private levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i += 1) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j += 1) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j += 1) {
      for (let i = 1; i <= a.length; i += 1) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator, // substitution
        );
      }
    }
    return matrix[b.length][a.length];
  }


  // ===== Project Reviewer Management =====

  async getProjectReviewers(projectId: string): Promise<Types.ObjectId[]> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    return project.reviewers || [];
  }

  async addReviewer(projectId: string, reviewerId: Types.ObjectId): Promise<void> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (!project.reviewers) {
      project.reviewers = [];
    }

    if (project.reviewers.some((r: Types.ObjectId) => r.equals(reviewerId))) {
      throw new ConflictError('Reviewer already assigned to project');
    }

    project.reviewers.push(reviewerId);
    await project.save();
    logger.info(`Reviewer ${reviewerId} added to project ${projectId}`);
  }

  async removeReviewer(projectId: string, reviewerId: Types.ObjectId): Promise<void> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (!project.reviewers) {
      throw new NotFoundError('No reviewers assigned to project');
    }

    const initialLength = project.reviewers.length;
    project.reviewers = project.reviewers.filter((r: Types.ObjectId) => !r.equals(reviewerId));

    if (project.reviewers.length === initialLength) {
      throw new NotFoundError('Reviewer not found in project');
    }

    await project.save();
     logger.info(`Reviewer ${reviewerId} removed from project ${projectId}`);
  }
}

// 创建并导出默认实例
export const reviewService = new ReviewService(); 