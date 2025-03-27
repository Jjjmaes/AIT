import mongoose from 'mongoose';
import { 
  Segment, 
  SegmentStatus, 
  IssueType,
  ReviewScoreType, 
  Issue 
} from '../models/segment.model';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { IUser } from '../models/user.model';
import { File } from '../models/file.model';
import Project, { IProject } from '../models/project.model';
import logger from '../utils/logger';
import { AIProvider, AIServiceConfig } from '../types/ai-service.types';
import { AIServiceFactory } from '../services/translation/ai-adapters';
import { ReviewAdapter, ReviewOptions, AIReviewResponse } from '../services/translation/ai-adapters/review.adapter';

// 自定义错误类
class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

/**
 * 审校服务类
 */
export class ReviewService {
  private aiServiceFactory: AIServiceFactory;

  constructor() {
    this.aiServiceFactory = AIServiceFactory.getInstance();
  }

  /**
   * 获取AI审校适配器
   */
  private getAIReviewAdapter(model: string, apiKey: string): ReviewAdapter {
    // 目前只支持OpenAI，后续可以扩展其他提供商
    const config: AIServiceConfig = {
      provider: AIProvider.OPENAI,
      apiKey,
      model,
      temperature: 0.3,
      maxTokens: 4000
    };

    return this.aiServiceFactory.createReviewAdapter(config);
  }

  /**
   * 启动段落的AI审校
   * @param segmentId 段落ID
   * @param userId 用户ID
   * @param options 选项
   */
  async startAIReview(
    segmentId: string,
    userId: string,
    options: {
      promptTemplateId?: string;
      aiModel?: string;
    } = {}
  ) {
    const segment = await Segment.findById(segmentId);
    if (!segment) {
      throw new NotFoundError('段落不存在');
    }

    // 检查段落状态
    if (segment.status !== SegmentStatus.TRANSLATED) {
      throw new BadRequestError('只有已翻译的段落才能进行审校');
    }

    // 检查用户权限 (项目管理员或审校人员)
    const file = await File.findById(segment.fileId);
    if (!file) {
      throw new NotFoundError('关联文件不存在');
    }

    const project = await Project.findById(file.projectId);
    if (!project) {
      throw new NotFoundError('关联项目不存在');
    }

    const isManager = project.managerId.toString() === userId;
    // 类型安全的检查reviewer数组
    const isReviewer = Array.isArray(project.reviewers) && project.reviewers.some(
      (reviewer: any) => reviewer && reviewer.toString() === userId
    );

    if (!isManager && !isReviewer) {
      throw new ForbiddenError('无权审校此段落');
    }

    // 更新段落状态为审校中
    segment.status = SegmentStatus.REVIEW_IN_PROGRESS;
    segment.reviewer = new mongoose.Types.ObjectId(userId);

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
    logger.info(`Segment ${segment._id} review started by user ${userId}`);

    // 如果指定了AI模型，则执行AI审校
    if (options.aiModel) {
      try {
        // 获取项目API密钥
        const apiKey = process.env.OPENAI_API_KEY; // 在实际应用中，应该从配置或数据库获取
        if (!apiKey) {
          throw new Error('未配置API密钥');
        }

        // 获取AI审校适配器
        const reviewAdapter = this.getAIReviewAdapter(options.aiModel, apiKey);

        // 构建审校选项
        const reviewOptions: ReviewOptions = {
          sourceLanguage: project.sourceLanguage,
          targetLanguage: project.targetLanguage,
          originalContent: segment.content,
          translatedContent: segment.translation || '',
          projectId: project._id.toString(),
          customPrompt: project.reviewPromptTemplate
        };

        // 执行AI审校
        logger.info(`Starting AI review for segment ${segment._id} using model ${options.aiModel}`);
        const reviewResult = await reviewAdapter.reviewText(reviewOptions);

        // 保存审校结果
        this.saveAIReviewResult(segment, reviewResult);
        
        // 更新段落状态
        segment.status = SegmentStatus.REVIEW_COMPLETED;
        await segment.save();
        
        logger.info(`AI review completed for segment ${segment._id}`);
      } catch (error: any) {
        logger.error(`AI review failed for segment ${segment._id}`, { error });
        
        // 更新段落状态为审校失败
        segment.status = SegmentStatus.REVIEW_FAILED;
        segment.error = error.message;
        await segment.save();
      }
    }

    // 返回更新后的段落
    return segment;
  }

  /**
   * 保存AI审校结果
   */
  private async saveAIReviewResult(segment: any, reviewResult: AIReviewResponse) {
    // 保存建议的翻译
    if (segment.reviewResult) {
      segment.reviewResult.suggestedTranslation = reviewResult.suggestedTranslation;
      segment.reviewResult.aiReviewer = reviewResult.metadata.model;
      segment.reviewResult.modificationDegree = reviewResult.metadata.modificationDegree;
    }

    // 保存评分
    const scores = reviewResult.scores.map(score => ({
      type: score.type,
      score: score.score,
      details: score.details
    }));

    if (segment.reviewResult) {
      segment.reviewResult.scores = scores;
    }

    // 保存问题
    for (const issueData of reviewResult.issues) {
      // 创建问题
      const issue = new Issue({
        type: issueData.type,
        description: issueData.description,
        position: issueData.position,
        suggestion: issueData.suggestion,
        resolved: false,
        createdAt: new Date(),
        aiGenerated: true
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
    }
  }

  /**
   * 添加段落问题
   * @param segmentId 段落ID
   * @param userId 用户ID
   * @param issueData 问题数据
   */
  async addSegmentIssue(
    segmentId: string,
    userId: string,
    issueData: {
      type: IssueType;
      description: string;
      position?: {
        start: number;
        end: number;
      };
      suggestion?: string;
    }
  ) {
    const segment = await Segment.findById(segmentId);
    if (!segment) {
      throw new NotFoundError('段落不存在');
    }

    // 检查用户权限
    const file = await File.findById(segment.fileId);
    if (!file) {
      throw new NotFoundError('关联文件不存在');
    }

    const project = await Project.findById(file.projectId);
    if (!project) {
      throw new NotFoundError('关联项目不存在');
    }

    const isManager = project.managerId.toString() === userId;
    // 类型安全的检查reviewer数组
    const isReviewer = Array.isArray(project.reviewers) && project.reviewers.some(
      (reviewer: any) => reviewer && reviewer.toString() === userId
    );

    if (!isManager && !isReviewer) {
      throw new ForbiddenError('无权为此段落添加问题');
    }

    // 创建问题
    const issue = new Issue({
      ...issueData,
      resolved: false,
      createdBy: new mongoose.Types.ObjectId(userId),
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
    logger.info(`Issue added to segment ${segment._id} by user ${userId}: ${issue._id}`);

    return issue;
  }

  /**
   * 解决段落问题
   * @param segmentId 段落ID
   * @param issueId 问题ID
   * @param userId 用户ID
   */
  async resolveSegmentIssue(
    segmentId: string,
    issueId: string,
    userId: string
  ) {
    const segment = await Segment.findById(segmentId);
    if (!segment) {
      throw new NotFoundError('段落不存在');
    }

    const issue = await Issue.findById(issueId);
    if (!issue) {
      throw new NotFoundError('问题不存在');
    }

    // 检查问题是否属于该段落
    const isIssueOfSegment = segment.issues?.some(
      segmentIssue => (segmentIssue as any)._id.toString() === issueId
    );

    if (!isIssueOfSegment) {
      throw new BadRequestError('该问题不属于此段落');
    }

    // 检查用户权限
    const file = await File.findById(segment.fileId);
    if (!file) {
      throw new NotFoundError('关联文件不存在');
    }

    const project = await Project.findById(file.projectId);
    if (!project) {
      throw new NotFoundError('关联项目不存在');
    }

    const isManager = project.managerId.toString() === userId;
    // 类型安全的检查reviewer数组
    const isReviewer = Array.isArray(project.reviewers) && project.reviewers.some(
      (reviewer: any) => reviewer && reviewer.toString() === userId
    );

    if (!isManager && !isReviewer) {
      throw new ForbiddenError('无权解决此问题');
    }

    // 更新问题状态
    issue.resolved = true;
    issue.resolvedAt = new Date();
    issue.resolvedBy = new mongoose.Types.ObjectId(userId);

    await issue.save();
    logger.info(`Issue ${issue._id} resolved by user ${userId} for segment ${segment._id}`);

    return issue;
  }

  /**
   * 完成段落审校
   * @param segmentId 段落ID
   * @param userId 用户ID
   * @param reviewData 审校数据
   */
  async completeSegmentReview(
    segmentId: string,
    userId: string,
    reviewData: {
      finalTranslation: string;
      acceptedChanges?: boolean;
      modificationDegree?: number;
    }
  ) {
    const segment = await Segment.findById(segmentId);
    if (!segment) {
      throw new NotFoundError('段落不存在');
    }

    // 检查段落状态
    if (
      segment.status !== SegmentStatus.REVIEW_IN_PROGRESS && 
      segment.status !== SegmentStatus.REVIEWING &&
      segment.status !== SegmentStatus.REVIEW_PENDING
    ) {
      throw new BadRequestError('段落不处于审校状态');
    }

    // 检查用户权限
    const file = await File.findById(segment.fileId);
    if (!file) {
      throw new NotFoundError('关联文件不存在');
    }

    const project = await Project.findById(file.projectId);
    if (!project) {
      throw new NotFoundError('关联项目不存在');
    }

    const isManager = project.managerId.toString() === userId;
    // 类型安全的检查reviewer数组
    const isReviewer = Array.isArray(project.reviewers) && project.reviewers.some(
      (reviewer: any) => reviewer && reviewer.toString() === userId
    );

    if (!isManager && !isReviewer) {
      throw new ForbiddenError('无权完成此段落的审校');
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
    segment.reviewResult.reviewerId = new mongoose.Types.ObjectId(userId);

    // 添加到审校历史
    if (!segment.reviewHistory) {
      segment.reviewHistory = [];
    }

    const version = segment.reviewHistory.length + 1;
    segment.reviewHistory.push({
      version,
      content: reviewData.finalTranslation,
      timestamp: new Date(),
      modifiedBy: new mongoose.Types.ObjectId(userId),
      aiGenerated: false,
      acceptedByHuman: true
    });

    // 更新段落状态和翻译
    segment.status = SegmentStatus.REVIEW_COMPLETED;
    segment.translation = reviewData.finalTranslation;
    segment.translatedLength = reviewData.finalTranslation.length;

    await segment.save();
    logger.info(`Segment ${segment._id} review completed by user ${userId}`);

    return segment;
  }

  /**
   * 确认段落审校，最终完成
   * @param segmentId 段落ID
   * @param userId 用户ID
   */
  async finalizeSegmentReview(segmentId: string, userId: string) {
    const segment = await Segment.findById(segmentId);
    if (!segment) {
      throw new NotFoundError('段落不存在');
    }

    // 检查段落状态
    if (segment.status !== SegmentStatus.REVIEW_COMPLETED) {
      throw new BadRequestError('段落审校尚未完成，无法确认');
    }

    // 检查用户权限 (项目管理员)
    const file = await File.findById(segment.fileId);
    if (!file) {
      throw new NotFoundError('关联文件不存在');
    }

    const project = await Project.findById(file.projectId);
    if (!project) {
      throw new NotFoundError('关联项目不存在');
    }

    const isManager = project.managerId.toString() === userId;
    if (!isManager) {
      throw new ForbiddenError('只有项目管理员才能最终确认审校结果');
    }

    // 更新段落状态
    segment.status = SegmentStatus.COMPLETED;
    await segment.save();
    logger.info(`Segment ${segment._id} review finalized by user ${userId}`);

    // 检查文件中的所有段落是否都已完成
    const totalSegments = await Segment.countDocuments({ fileId: segment.fileId });
    const completedSegments = await Segment.countDocuments({
      fileId: segment.fileId,
      status: SegmentStatus.COMPLETED
    });

    // 如果所有段落都已完成，更新文件状态
    if (totalSegments === completedSegments) {
      // 使用类型安全的方式更新文件状态
      file.status = 'completed' as any;
      await file.save();
      logger.info(`File ${file._id} marked as completed after segment ${segment._id} finalization`);

      // 检查项目中的所有文件是否都已完成
      const totalFiles = await File.countDocuments({ projectId: file.projectId });
      const completedFiles = await File.countDocuments({
        projectId: file.projectId,
        status: 'completed'
      });

      // 如果所有文件都已完成，更新项目状态
      if (totalFiles === completedFiles) {
        // 使用类型安全的状态赋值
        (project as any).status = 'completed';
        await project.save();
        logger.info(`Project ${project._id} marked as completed after file ${file._id} completion`);
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
  async batchUpdateSegmentStatus(
    segmentIds: string[],
    userId: string,
    status: SegmentStatus
  ) {
    // 检查用户权限
    const segment = await Segment.findById(segmentIds[0]);
    if (!segment) {
      throw new NotFoundError('段落不存在');
    }

    const file = await File.findById(segment.fileId);
    if (!file) {
      throw new NotFoundError('关联文件不存在');
    }

    const project = await Project.findById(file.projectId);
    if (!project) {
      throw new NotFoundError('关联项目不存在');
    }

    const isManager = project.managerId.toString() === userId;
    // 类型安全的检查reviewer数组
    const isReviewer = Array.isArray(project.reviewers) && project.reviewers.some(
      (reviewer: any) => reviewer && reviewer.toString() === userId
    );

    if (!isManager && !isReviewer) {
      throw new ForbiddenError('无权批量更新段落状态');
    }

    // 更新段落状态
    const result = await Segment.updateMany(
      { _id: { $in: segmentIds } },
      { $set: { status } }
    );

    logger.info(`Batch updated ${result.modifiedCount} segments to status ${status} by user ${userId}`);
    return result;
  }

  /**
   * 获取段落的审校结果
   * @param segmentId 段落ID
   * @param userId 用户ID
   */
  async getSegmentReviewResult(segmentId: string, userId: string) {
    const segment = await Segment.findById(segmentId)
      .populate('issues')
      .populate('reviewer', 'name email');
      
    if (!segment) {
      throw new NotFoundError('段落不存在');
    }

    // 检查用户权限
    const file = await File.findById(segment.fileId);
    if (!file) {
      throw new NotFoundError('关联文件不存在');
    }

    const project = await Project.findById(file.projectId);
    if (!project) {
      throw new NotFoundError('关联项目不存在');
    }

    const isManager = project.managerId.toString() === userId;
    // 类型安全的检查reviewer数组
    const isReviewer = Array.isArray(project.reviewers) && project.reviewers.some(
      (reviewer: any) => reviewer && reviewer.toString() === userId
    );
    const isTranslator = segment.translator?.toString() === userId;

    if (!isManager && !isReviewer && !isTranslator) {
      throw new ForbiddenError('无权查看此段落的审校结果');
    }

    logger.info(`Segment ${segment._id} review result accessed by user ${userId}`);
    return {
      segment,
      reviewResult: segment.reviewResult,
      issues: segment.issues,
      reviewHistory: segment.reviewHistory
    };
  }
}

export default new ReviewService(); 