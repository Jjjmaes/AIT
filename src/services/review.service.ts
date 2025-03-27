import { AIServiceFactory } from '../services/translation/ai-adapters';
import { AIReviewService } from './ai-review.service';
import { Segment, SegmentStatus, IssueType, ReviewScoreType, Issue, ISegment, IIssue } from '../models/segment.model';
import { File, FileStatus, IFile } from '../models/file.model';
import Project, { IProject } from '../models/project.model';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';
import mongoose from 'mongoose';
import { ProjectStatus } from '../types/project.types';
import { AIProvider } from '../types/ai-service.types';
import { ReviewAdapter, AIReviewResponse } from './translation/ai-adapters/review.adapter';

// 定义错误类
class NotFoundError extends AppError {
  constructor(message: string = '未找到资源') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

class BadRequestError extends AppError {
  constructor(message: string = '请求参数错误') {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

class ForbiddenError extends AppError {
  constructor(message: string = '禁止访问') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

// 定义问题数据接口
interface IssueData {
  type: IssueType;
  description: string;
  position?: {
    start: number;
    end: number;
  };
  suggestion?: string;
}

/**
 * 审校服务类
 */
export class ReviewService {
  private aiServiceFactory: AIServiceFactory;
  private aiReviewService: AIReviewService | null; // 添加AIReviewService依赖

  constructor(aiReviewService?: AIReviewService) {
    this.aiServiceFactory = AIServiceFactory.getInstance();
    this.aiReviewService = aiReviewService || null; // 存储传入的AIReviewService实例
  }

  /**
   * 开始AI审校
   * @param segmentId 段落ID
   * @param userId 用户ID
   * @param options 审校选项
   * @returns 审校结果
   */
  async startAIReview(segmentId: string, userId: string, options?: any): Promise<any> {
    try {
      if (!segmentId) {
        throw new BadRequestError('段落ID不能为空');
      }

      if (!userId) {
        throw new BadRequestError('用户ID不能为空');
      }
      
      // 1. 查找段落
      const segment = await Segment.findById(segmentId).exec();
      if (!segment) {
        throw new NotFoundError(`段落不存在: ${segmentId}`);
      }

      // 2. 检查段落状态
      if (segment.status !== SegmentStatus.TRANSLATED && segment.status !== SegmentStatus.REVIEW_FAILED) {
        throw new BadRequestError(`段落状态不允许审校，当前状态: ${segment.status}`);
      }

      // 3. 获取关联文件和项目
      const file = await File.findById(segment.fileId).exec();
      if (!file) {
        throw new NotFoundError(`关联文件不存在，段落ID: ${segmentId}, 文件ID: ${segment.fileId}`);
      }

      const project = await Project.findById(file.projectId).exec();
      if (!project) {
        throw new NotFoundError(`关联项目不存在，段落ID: ${segmentId}, 文件ID: ${segment.fileId}, 项目ID: ${file.projectId}`);
      }

      // 4. 检查用户权限
      const userIdStr = userId.toString();
      const projectReviewers = project.reviewers?.map(r => r.toString()) || [];
      const isManager = project.managerId.toString() === userIdStr;
      const isReviewer = projectReviewers.includes(userIdStr);
      const isTranslator = segment.translator && segment.translator.toString() === userIdStr;

      if (!isManager && !isReviewer && !isTranslator) {
        throw new ForbiddenError(`用户(${userId})无权审校段落(${segmentId})`);
      }

      // 5. 检查是否有翻译内容
      if (!segment.translation) {
        throw new BadRequestError('段落没有翻译内容，无法进行审校');
      }

      // 6. 更新段落状态为审校中
      segment.status = SegmentStatus.REVIEW_IN_PROGRESS;
      segment.reviewer = new mongoose.Types.ObjectId(userId);
      
      // 保存状态更新
      await segment.save();
      
      // 7. 获取上下文段落
      const contextSegments = await this.getContextSegments(segment, file);
      
      // 8. 调用AI审校服务
      // 如果没有注入自定义的AI审校服务，则使用默认的
      let aiReviewServiceToUse: any;
      if (this.aiReviewService) {
        aiReviewServiceToUse = this.aiReviewService;
      } else {
        // 使用默认的OpenAI审校适配器
        const reviewAdapter = this.aiServiceFactory.getReviewAdapter(AIProvider.OPENAI);
        if (!reviewAdapter) {
          throw new BadRequestError('无法创建AI审校服务');
        }
        aiReviewServiceToUse = reviewAdapter;
      }
      
      // 9. 准备AI审校所需数据
      const reviewPrompt = project.reviewPromptTemplate || '请审校以下翻译，指出错误并提供修改建议。';
      const reviewData = {
        segmentId: segment._id,
        content: segment.content,
        translation: segment.translation,
        sourceLanguage: file.metadata.sourceLanguage,
        targetLanguage: file.metadata.targetLanguage,
        contextSegments: contextSegments,
        prompt: reviewPrompt,
        options: options || {} // 可以传入额外的审校选项，如审校严格度等
      };
      
      // 10. 执行AI审校
      let aiReviewResult: AIReviewResponse;
      try {
        aiReviewResult = await aiReviewServiceToUse.reviewTranslation({
          originalContent: segment.content,
          translatedContent: segment.translation || '',
          sourceLanguage: file.metadata.sourceLanguage,
          targetLanguage: file.metadata.targetLanguage,
          contextSegments: contextSegments.map(ctx => ({
            original: ctx.content,
            translation: ctx.translation || ''
          })),
          customPrompt: reviewPrompt
        });
      } catch (error: any) {
        logger.error('AI审校失败', { 
          segmentId: segment._id, 
          error: error.message 
        });
        throw new BadRequestError(`AI审校失败: ${error.message}`);
      }
      
      // 11. 保存审校结果
      if (!segment.reviewResult) {
        segment.reviewResult = {
          originalTranslation: segment.translation || '',
          suggestedTranslation: aiReviewResult.suggestedTranslation || segment.translation || '',
          issues: [],
          scores: aiReviewResult.scores || [],
          reviewDate: new Date(),
          reviewerId: new mongoose.Types.ObjectId(userId),
          aiReviewer: aiReviewResult.metadata?.model || 'AI',
          modificationDegree: aiReviewResult.metadata?.modificationDegree || 0
        };
      } else {
        segment.reviewResult.suggestedTranslation = aiReviewResult.suggestedTranslation || segment.translation || '';
        segment.reviewResult.scores = aiReviewResult.scores || segment.reviewResult.scores || [];
        segment.reviewResult.reviewDate = new Date();
        segment.reviewResult.aiReviewer = aiReviewResult.metadata?.model || 'AI';
        segment.reviewResult.modificationDegree = aiReviewResult.metadata?.modificationDegree || 0;
      }
      
      // 12. 添加审校历史记录
      if (!segment.reviewHistory) {
        segment.reviewHistory = [];
      }
      
      segment.reviewHistory.push({
        version: segment.reviewHistory.length + 1,
        content: aiReviewResult.suggestedTranslation || segment.translation,
        timestamp: new Date(),
        modifiedBy: new mongoose.Types.ObjectId(userId),
        aiGenerated: true,
        acceptedByHuman: false
      });
      
      // 13. 如果有AI检测出的问题，添加到段落问题列表
      if (aiReviewResult.issues && aiReviewResult.issues.length > 0) {
        for (const issueData of aiReviewResult.issues) {
          const issue = new Issue({
            type: issueData.type || IssueType.OTHER,
            description: issueData.description,
            position: issueData.position,
            suggestion: issueData.suggestion,
            resolved: false,
            createdAt: new Date(),
            createdBy: new mongoose.Types.ObjectId(userId)
          });
          
          await issue.save();
          
          if (!segment.issues) {
            segment.issues = [];
          }
          // Type assertion to fix the incompatible types
          (segment.issues as unknown as mongoose.Types.ObjectId[]).push(issue._id);
          
          if (!segment.reviewResult) {
            segment.reviewResult = {
              originalTranslation: segment.translation || '',
              issues: [],
              scores: [],
              reviewDate: new Date()
            };
          }
          
          if (!segment.reviewResult.issues) {
            segment.reviewResult.issues = [];
          }
          
          segment.reviewResult.issues.push(issue._id);
        }
      }
      
      // 14. 保存更新的段落
      await segment.save();
      
      // 15. 返回AI审校结果
      return {
        segmentId: segment._id,
        originalTranslation: segment.translation,
        suggestedTranslation: aiReviewResult.suggestedTranslation,
        issues: aiReviewResult.issues,
        scores: aiReviewResult.scores,
        status: segment.status
      };
      
    } catch (error: any) {
      logger.error('开始AI审校失败', { 
        segmentId, 
        userId, 
        error: error.message,
        stack: error.stack 
      });
      
      // 如果是已知错误类型，直接抛出
      if (error instanceof AppError) {
        throw error;
      }
      
      // 未知错误统一抛出BadRequestError
      throw new BadRequestError(`开始AI审校失败: ${error.message}`);
    }
  }
  
  /**
   * 完成段落审校
   * @param segmentId 段落ID
   * @param userId 用户ID
   * @param reviewData 审校数据
   * @returns 更新后的段落
   */
  async completeSegmentReview(segmentId: string, userId: string, reviewData: {
    finalTranslation?: string;
    acceptedChanges?: boolean;
    status?: SegmentStatus;
    scores?: Array<{
      type: ReviewScoreType;
      score: number;
      details?: string;
    }>;
  }): Promise<any> {
    try {
      if (!segmentId) {
        throw new BadRequestError('段落ID不能为空');
      }

      if (!userId) {
        throw new BadRequestError('用户ID不能为空');
      }
      
      if (!reviewData) {
        throw new BadRequestError('审校数据不能为空');
      }
      
      // 1. 查找段落
      const segment = await Segment.findById(segmentId).exec();
      if (!segment) {
        throw new NotFoundError(`段落不存在: ${segmentId}`);
      }
      
      // 2. 检查段落状态
      if (segment.status !== SegmentStatus.REVIEW_IN_PROGRESS) {
        throw new BadRequestError(`段落状态不允许完成审校，当前状态: ${segment.status}`);
      }
      
      // 3. 获取关联文件和项目
      const file = await File.findById(segment.fileId).exec();
      if (!file) {
        throw new NotFoundError(`关联文件不存在，段落ID: ${segmentId}, 文件ID: ${segment.fileId}`);
      }
      
      const project = await Project.findById(file.projectId).exec();
      if (!project) {
        throw new NotFoundError(`关联项目不存在，段落ID: ${segmentId}, 文件ID: ${segment.fileId}, 项目ID: ${file.projectId}`);
      }
      
      // 4. 检查用户权限
      const userIdStr = userId.toString();
      const projectReviewers = project.reviewers?.map(r => r.toString()) || [];
      const isManager = project.managerId.toString() === userIdStr;
      const isReviewer = projectReviewers.includes(userIdStr);
      // 检查是否是当前段落的审校者
      const isCurrentReviewer = segment.reviewer && segment.reviewer.toString() === userIdStr;
      
      if (!isManager && !isReviewer && !isCurrentReviewer) {
        throw new ForbiddenError(`用户(${userId})无权完成段落(${segmentId})的审校`);
      }
      
      // 5. 处理审校数据
      let finalTranslation = '';
      if (reviewData.finalTranslation) {
        finalTranslation = reviewData.finalTranslation;
      } else if (segment.reviewResult?.suggestedTranslation) {
        finalTranslation = segment.reviewResult.suggestedTranslation;
      } else if (segment.translation) {
        finalTranslation = segment.translation;
      }
      
      const acceptedChanges = reviewData.acceptedChanges !== undefined ? reviewData.acceptedChanges : true;
      const reviewStatus = reviewData.status || SegmentStatus.REVIEW_COMPLETED;
      
      // 验证审校状态
      if (reviewStatus !== SegmentStatus.REVIEW_COMPLETED && reviewStatus !== SegmentStatus.REVIEW_FAILED) {
        throw new BadRequestError(`无效的审校状态: ${reviewStatus}`);
      }
      
      // 6. 更新段落审校结果
      if (!segment.reviewResult) {
        segment.reviewResult = {
          // @ts-ignore: 忽略string|undefined不能赋值给string的错误
          originalTranslation: segment.translation,
          finalTranslation: finalTranslation,
          issues: [],
          scores: reviewData.scores || [],
          reviewDate: new Date(),
          reviewerId: new mongoose.Types.ObjectId(userId),
          acceptedChanges: acceptedChanges
        };
      } else {
        segment.reviewResult.finalTranslation = finalTranslation;
        if (reviewData.scores) {
          segment.reviewResult.scores = reviewData.scores;
        }
        segment.reviewResult.reviewDate = new Date();
        segment.reviewResult.reviewerId = new mongoose.Types.ObjectId(userId);
        segment.reviewResult.acceptedChanges = acceptedChanges;
      }
      
      // 7. 添加人工审校历史记录
      if (!segment.reviewHistory) {
        segment.reviewHistory = [];
      }
      
      segment.reviewHistory.push({
        version: segment.reviewHistory.length + 1,
        // @ts-ignore: 忽略string|undefined不能赋值给string的错误
        content: finalTranslation,
        timestamp: new Date(),
        modifiedBy: new mongoose.Types.ObjectId(userId),
        aiGenerated: false,
        acceptedByHuman: true
      });
      
      // 8. 更新段落状态和翻译内容
      segment.status = reviewStatus;
      // @ts-ignore: 忽略string|undefined不能赋值给string的错误
      segment.translation = finalTranslation;
      segment.translatedLength = finalTranslation.length;
      
      // 9. 保存更新的段落
      await segment.save();
      
      // 10. 如果审校完成，检查文件完成状态
      if (reviewStatus === SegmentStatus.REVIEW_COMPLETED) {
        await this.checkFileCompletionStatus(file);
      }
      
      // 11. 返回完成的审校结果
      return {
        segmentId: segment._id,
        originalTranslation: segment.reviewResult?.originalTranslation || segment.translation,
        finalTranslation: segment.translation,
        issues: segment.issues,
        scores: segment.reviewResult?.scores || [],
        status: segment.status,
        acceptedChanges: segment.reviewResult?.acceptedChanges
      };
      
    } catch (error: any) {
      logger.error('完成段落审校失败', { 
        segmentId, 
        userId, 
        error: error.message,
        stack: error.stack 
      });
      
      // 如果是已知错误类型，直接抛出
      if (error instanceof AppError) {
        throw error;
      }
      
      // 未知错误统一抛出BadRequestError
      throw new BadRequestError(`完成段落审校失败: ${error.message}`);
    }
  }
  
  /**
   * 获取段落审校结果
   * @param segmentId 段落ID
   * @param userId 用户ID
   * @returns 段落审校结果
   */
  async getSegmentReviewResult(segmentId: string, userId: string): Promise<any> {
    try {
      if (!segmentId) {
        throw new BadRequestError('段落ID不能为空');
      }

      if (!userId) {
        throw new BadRequestError('用户ID不能为空');
      }
      
      // 1. 查找段落
      const segment = await Segment.findById(segmentId)
        .populate('issues')
        .populate('reviewer')
        .populate('translator')
        .exec();
        
      if (!segment) {
        throw new NotFoundError(`段落不存在: ${segmentId}`);
      }
      
      // 2. 获取关联文件和项目
      const file = await File.findById(segment.fileId).exec();
      if (!file) {
        throw new NotFoundError(`关联文件不存在，段落ID: ${segmentId}, 文件ID: ${segment.fileId}`);
      }
      
      const project = await Project.findById(file.projectId).exec();
      if (!project) {
        throw new NotFoundError(`关联项目不存在，段落ID: ${segmentId}, 文件ID: ${segment.fileId}, 项目ID: ${file.projectId}`);
      }
      
      // 3. 检查用户权限
      const userIdStr = userId.toString();
      const projectReviewers = project.reviewers?.map(r => r.toString()) || [];
      const isManager = project.managerId.toString() === userIdStr;
      const isReviewer = projectReviewers.includes(userIdStr);
      const isTranslator = segment.translator && segment.translator.toString() === userIdStr;
      
      if (!isManager && !isReviewer && !isTranslator) {
        throw new ForbiddenError(`用户(${userId})无权查看段落(${segmentId})的审校结果`);
      }
      
      // 4. 如果段落没有审校结果，则返回空结果
      if (!segment.reviewResult) {
        return {
          segmentId: segment._id,
          status: segment.status,
          hasReviewResult: false,
          message: '段落尚未进行审校'
        };
      }
      
      // 5. 返回审校结果
      return {
        segmentId: segment._id,
        content: segment.content,
        originalTranslation: segment.reviewResult.originalTranslation,
        suggestedTranslation: segment.reviewResult.suggestedTranslation,
        finalTranslation: segment.reviewResult.finalTranslation || segment.translation,
        issues: segment.issues,
        scores: segment.reviewResult.scores,
        status: segment.status,
        reviewer: segment.reviewer,
        translator: segment.translator,
        reviewDate: segment.reviewResult.reviewDate,
        aiReviewer: segment.reviewResult.aiReviewer,
        modificationDegree: segment.reviewResult.modificationDegree,
        acceptedChanges: segment.reviewResult.acceptedChanges,
        reviewHistory: segment.reviewHistory,
        hasReviewResult: true
      };
      
    } catch (error: any) {
      logger.error('获取段落审校结果失败', { 
        segmentId, 
        userId, 
        error: error.message,
        stack: error.stack 
      });
      
      // 如果是已知错误类型，直接抛出
      if (error instanceof AppError) {
        throw error;
      }
      
      // 未知错误统一抛出BadRequestError
      throw new BadRequestError(`获取段落审校结果失败: ${error.message}`);
    }
  }
  
  /**
   * 获取段落上下文
   * @param segment 当前段落
   * @param file 所属文件
   * @returns 上下文段落
   */
  private async getContextSegments(segment: ISegment, file: IFile): Promise<any[]> {
    try {
      // 获取当前段落前后各两个段落作为上下文
      const contextSegments = await Segment.find({
        fileId: file._id,
        _id: { $ne: segment._id } // 排除当前段落
      })
        .sort({ _id: 1 }) // 按ID排序
        .limit(5) // 最多取5个段落
        .exec();
      
      // 过滤掉没有内容或翻译的段落
      return contextSegments
        .filter(seg => seg.content && (seg.translation || seg.status === SegmentStatus.TRANSLATED))
        .map(seg => ({
          content: seg.content,
          translation: seg.translation,
          position: 'context' // 标识为上下文段落
        }));
    } catch (error) {
      logger.error('获取上下文段落失败', { segmentId: segment._id, fileId: file._id, error });
      return []; // 出错时返回空数组，不影响主流程
    }
  }

  /**
   * 添加段落审校问题
   * @param segmentId 段落ID
   * @param userId 用户ID
   * @param issueData 问题数据
   * @returns 创建的问题对象
   */
  async addSegmentIssue(segmentId: string, userId: string, issueData: IssueData): Promise<any> {
    try {
      // 1. 查找段落
      const segment = await Segment.findById(segmentId).exec();
      if (!segment) {
        throw new NotFoundError(`段落不存在: ${segmentId}`);
      }

      // 2. 检查段落状态
      if (![SegmentStatus.REVIEW_IN_PROGRESS, SegmentStatus.TRANSLATED].includes(segment.status)) {
        throw new BadRequestError(`段落状态不允许添加问题，当前状态: ${segment.status}`);
      }

      // 3. 获取关联文件和项目
      const file = await File.findById(segment.fileId).exec();
      if (!file) {
        throw new NotFoundError(`关联文件不存在，段落ID: ${segmentId}, 文件ID: ${segment.fileId}`);
      }

      const project = await Project.findById(file.projectId).exec();
      if (!project) {
        throw new NotFoundError(`关联项目不存在，段落ID: ${segmentId}, 文件ID: ${segment.fileId}, 项目ID: ${file.projectId}`);
      }

      // 4. 检查用户权限
      const userIdStr = userId.toString();
      const projectReviewers = project.reviewers?.map(r => r.toString()) || [];
      const isManager = project.managerId.toString() === userIdStr;
      const isReviewer = projectReviewers.includes(userIdStr);

      if (!isManager && !isReviewer) {
        throw new ForbiddenError(`用户(${userId})无权为段落(${segmentId})添加问题`);
      }

      // 5. 验证问题数据
      if (!issueData || !issueData.type || !issueData.description) {
        throw new BadRequestError('问题数据不完整');
      }

      // 6. 创建新问题
      const issue = new Issue({
        type: issueData.type,
        description: issueData.description,
        position: issueData.position,
        suggestion: issueData.suggestion,
        resolved: false,
        createdAt: new Date(),
        createdBy: new mongoose.Types.ObjectId(userId)
      });

      // 7. 保存问题
      await issue.save();

      // 8. 更新段落
      // 此处需要使用Segment.findByIdAndUpdate而不是直接修改segment对象
      // 这样可以避免类型问题
      await Segment.findByIdAndUpdate(
        segmentId,
        {
          $push: { issues: issue._id },
          $set: {
            'reviewResult.issues': segment.reviewResult?.issues
              ? [...segment.reviewResult.issues, issue._id]
              : [issue._id]
          }
        },
        { new: true }
      );

      // 添加这个类型声明，处理issues类型问题
      // 在MongoDB实际运行时，segment.issues确实是ObjectId的数组而不是IIssue的数组
      // 这是由于TypeScript接口定义和实际Mongoose Schema的差异
      // @ts-ignore 忽略类型检查
      segment.issues.push(issue._id);

      return issue;
    } catch (error) {
      logger.error('添加段落审校问题失败', { segmentId, userId, error });
      throw error;
    }
  }

  /**
   * 解决段落审校问题
   * @param segmentId 段落ID
   * @param issueId 问题ID
   * @param userId 用户ID
   * @returns 更新后的问题对象
   */
  async resolveSegmentIssue(segmentId: string, issueId: string, userId: string): Promise<any> {
    try {
      // 1. 查找段落和问题
      const segment = await Segment.findById(segmentId).exec();
      if (!segment) {
        throw new NotFoundError(`段落不存在: ${segmentId}`);
      }

      const issue = await Issue.findById(issueId).exec();
      if (!issue) {
        throw new NotFoundError(`问题不存在: ${issueId}`);
      }

      // 2. 检查问题是否属于该段落
      const segmentHasIssue = segment.issues?.some(i => i.toString() === issueId);
      if (!segmentHasIssue) {
        throw new BadRequestError(`问题(${issueId})不属于该段落(${segmentId})`);
      }

      // 3. 获取关联文件和项目
      const file = await File.findById(segment.fileId).exec();
      if (!file) {
        throw new NotFoundError(`关联文件不存在，段落ID: ${segmentId}, 文件ID: ${segment.fileId}`);
      }

      const project = await Project.findById(file.projectId).exec();
      if (!project) {
        throw new NotFoundError(`关联项目不存在，段落ID: ${segmentId}, 文件ID: ${segment.fileId}, 项目ID: ${file.projectId}`);
      }

      // 4. 检查用户权限
      const userIdStr = userId.toString();
      const projectReviewers = project.reviewers?.map(r => r.toString()) || [];
      
      // 项目可能没有翻译者字段，所以只考虑段落的译者
      const isManager = project.managerId.toString() === userIdStr;
      const isReviewer = projectReviewers.includes(userIdStr);
      const isSegmentReviewer = segment.reviewer && segment.reviewer.toString() === userIdStr;
      const isSegmentTranslator = segment.translator && segment.translator.toString() === userIdStr;
      const isIssueCreator = issue.createdBy && issue.createdBy.toString() === userIdStr;

      if (!isManager && !isReviewer && !isSegmentTranslator && !isSegmentReviewer && !isIssueCreator) {
        throw new ForbiddenError(`用户(${userId})无权解决此问题(${issueId})`);
      }

      // 5. 检查问题是否已解决
      if (issue.resolved) {
        throw new BadRequestError(`问题(${issueId})已解决`);
      }

      // 6. 更新问题状态
      issue.resolved = true;
      issue.resolvedAt = new Date();
      issue.resolvedBy = new mongoose.Types.ObjectId(userId);

      // 7. 保存更新后的问题
      await issue.save();

      // 8. 检查是否所有问题都已解决
      const allIssuesResolved = await this.checkAllIssuesResolved(segment);
      if (allIssuesResolved && segment.status === SegmentStatus.REVIEW_IN_PROGRESS) {
        // 可以选择自动完成审校或记录日志提醒用户
        logger.info('段落所有问题已解决', { segmentId, issueCount: segment.issues?.length || 0 });
      }

      return issue;
    } catch (error) {
      logger.error('解决段落审校问题失败', { segmentId, issueId, userId, error });
      throw error;
    }
  }

  /**
   * 确认段落审校结果
   * @param segmentId 段落ID
   * @param userId 用户ID
   * @returns 更新后的段落对象
   */
  async finalizeSegmentReview(segmentId: string, userId: string): Promise<any> {
    try {
      // 1. 查找段落
      const segment = await Segment.findById(segmentId).exec();
      if (!segment) {
        throw new NotFoundError(`段落不存在: ${segmentId}`);
      }

      // 2. 检查段落状态
      if (segment.status !== SegmentStatus.REVIEW_COMPLETED) {
        throw new BadRequestError(`段落不处于审校完成状态，当前状态: ${segment.status}`);
      }

      // 3. 获取关联文件和项目
      const file = await File.findById(segment.fileId).exec();
      if (!file) {
        throw new NotFoundError(`关联文件不存在，段落ID: ${segmentId}, 文件ID: ${segment.fileId}`);
      }

      const project = await Project.findById(file.projectId).exec();
      if (!project) {
        throw new NotFoundError(`关联项目不存在，段落ID: ${segmentId}, 文件ID: ${segment.fileId}, 项目ID: ${file.projectId}`);
      }

      // 4. 检查用户权限
      const userIdStr = userId.toString();
      const isManager = project.managerId.toString() === userIdStr;
      const isTranslator = segment.translator && segment.translator.toString() === userIdStr;

      if (!isManager && !isTranslator) {
        throw new ForbiddenError(`用户(${userId})无权确认段落(${segmentId})的审校结果`);
      }

      // 5. 更新段落状态
      segment.status = SegmentStatus.COMPLETED;

      // 6. 保存更新后的段落
      await segment.save();

      // 7. 检查文件是否所有段落都已完成
      await this.checkFileCompletionStatus(file);

      return segment;
    } catch (error) {
      logger.error('确认段落审校结果失败', { segmentId, userId, error });
      throw error;
    }
  }

  /**
   * 批量更新段落审校状态
   * @param segmentIds 段落ID数组
   * @param userId 用户ID
   * @param status 目标状态
   * @returns 更新结果
   */
  async batchUpdateSegmentStatus(
    segmentIds: string[], 
    userId: string, 
    status: SegmentStatus
  ): Promise<{ success: number; failed: number; errors: any[]; modifiedCount: number; matchedCount: number }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
      modifiedCount: 0,
      matchedCount: segmentIds.length
    };

    try {
      if (!segmentIds || segmentIds.length === 0) {
        throw new BadRequestError('段落ID列表不能为空');
      }

      if (!userId) {
        throw new BadRequestError('用户ID不能为空');
      }

      if (!status) {
        throw new BadRequestError('目标状态不能为空');
      }

      // 验证目标状态
      // 使用显式类型注释
      const validStatusTransitions: Record<SegmentStatus, SegmentStatus[]> = {
        [SegmentStatus.PENDING]: [],
        [SegmentStatus.TRANSLATED]: [SegmentStatus.REVIEW_IN_PROGRESS, SegmentStatus.REVIEW_PENDING],
        [SegmentStatus.REVIEWING]: [],
        [SegmentStatus.REVIEW_PENDING]: [SegmentStatus.REVIEW_IN_PROGRESS],
        [SegmentStatus.REVIEW_IN_PROGRESS]: [SegmentStatus.REVIEW_COMPLETED, SegmentStatus.REVIEW_FAILED],
        [SegmentStatus.REVIEW_COMPLETED]: [SegmentStatus.COMPLETED],
        [SegmentStatus.REVIEW_FAILED]: [SegmentStatus.TRANSLATED],
        [SegmentStatus.COMPLETED]: [],
        [SegmentStatus.ERROR]: []
      };

      // 检查用户权限
      const userIdStr = userId.toString();

      // 对每个段落进行处理
      for (const segmentId of segmentIds) {
        try {
          // 查找段落
          const segment = await Segment.findById(segmentId).exec();
          if (!segment) {
            throw new NotFoundError(`段落不存在: ${segmentId}`);
          }

          // 获取关联文件
          const file = await File.findById(segment.fileId).exec();
          if (!file) {
            throw new NotFoundError(`关联文件不存在: ${segmentId}, 文件ID: ${segment.fileId}`);
          }

          // 获取关联项目
          const project = await Project.findById(file.projectId).exec();
          if (!project) {
            throw new NotFoundError(`关联项目不存在: ${segmentId}, 文件ID: ${segment.fileId}, 项目ID: ${file.projectId}`);
          }

          // 检查用户权限
          const projectReviewers = project.reviewers?.map(r => r.toString()) || [];
          const isManager = project.managerId.toString() === userIdStr;
          const isReviewer = projectReviewers.includes(userIdStr);
          const isSegmentReviewer = segment.reviewer && segment.reviewer.toString() === userIdStr;

          if (!isManager && !isReviewer && !isSegmentReviewer) {
            throw new ForbiddenError(`用户(${userId})无权更新段落状态: ${segmentId}`);
          }

          // 检查状态转换是否有效
          const currentStatus = segment.status;
          const validNextStatuses = validStatusTransitions[currentStatus] || [];
          
          if (!validNextStatuses.includes(status)) {
            throw new BadRequestError(`无效的状态转换: ${currentStatus} -> ${status}`);
          }

          // 更新段落状态
          segment.status = status;
          
          // 添加历史记录
          if (status === SegmentStatus.REVIEW_COMPLETED || status === SegmentStatus.COMPLETED) {
            if (!segment.reviewHistory) {
              segment.reviewHistory = [];
            }
            
            segment.reviewHistory.push({
              version: segment.reviewHistory.length + 1,
              // @ts-ignore: 忽略string|undefined不能赋值给string的错误
              content: segment.translation || '',
              timestamp: new Date(),
              modifiedBy: new mongoose.Types.ObjectId(userId),
              aiGenerated: false,
              acceptedByHuman: true
            });
          }

          // 保存更新后的段落
          try {
            await segment.save();
            results.success++;
            results.modifiedCount++;
          } catch (saveError: any) {
            results.failed++;
            results.errors.push({
              segmentId,
              error: `保存失败: ${saveError.message}`
            });
            logger.error('批量更新保存段落失败', { segmentId, status, error: saveError.message });
          }
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            segmentId,
            error: error instanceof Error ? error.message : String(error)
          });
          if (error instanceof AppError) {
            logger.warn('批量更新段落状态单个错误', { segmentId, errorType: error.name, errorMessage: error.message });
          } else {
            logger.error('批量更新段落状态单个未知错误', { segmentId, error: error.message });
          }
        }
      }

      // 返回更新结果
      return results;
    } catch (error: any) {
      logger.error('批量更新段落状态过程中发生未知错误', { segmentIds: segmentIds.length, error: error.message });
      // 依然返回当前的结果，即使出现错误
      return results;
    }
  }

  /**
   * 检查段落的所有问题是否都已解决
   * @param segment 段落对象
   * @returns 是否所有问题都已解决
   */
  private async checkAllIssuesResolved(segment: ISegment): Promise<boolean> {
    try {
      if (!segment.issues || segment.issues.length === 0) {
        return true;
      }

      const issueIds = segment.issues.map(id => id.toString());
      const unresolvedCount = await Issue.countDocuments({
        _id: { $in: issueIds },
        resolved: false
      }).exec();

      return unresolvedCount === 0;
    } catch (error) {
      logger.error('检查段落问题状态失败', { segmentId: segment._id, error });
      return false;
    }
  }

  /**
   * 检查文件完成状态并更新
   * @param file 文件对象
   */
  private async checkFileCompletionStatus(file: IFile): Promise<void> {
    try {
      // 检查文件下所有段落的状态
      const totalSegments = await Segment.countDocuments({ fileId: file._id }).exec();
      const completedSegments = await Segment.countDocuments({
        fileId: file._id,
        status: { $in: [SegmentStatus.REVIEW_COMPLETED, SegmentStatus.COMPLETED] }
      }).exec();
      
      // 如果所有段落都已完成或审校完成，更新文件状态
      if (totalSegments > 0 && completedSegments === totalSegments) {
        file.status = FileStatus.COMPLETED;
        try {
          await file.save();
          logger.info('文件所有段落审校完成', { fileId: file._id, totalSegments, completedSegments });
        } catch (saveError: any) {
          logger.error('更新文件状态失败', { fileId: file._id, error: saveError.message });
          // 不抛出异常，不影响主流程
        }
      }
    } catch (error) {
      logger.error('检查文件完成状态失败', { fileId: file._id, error });
      // 不抛出异常，因为这是辅助功能，不应影响主流程
    }
  }
}

// 创建并导出默认实例
const reviewService = new ReviewService();
export default reviewService; 