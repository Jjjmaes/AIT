import mongoose, { Schema, Document } from 'mongoose';
import { IFile } from './file.model';
import { IUser } from './user.model';

export enum SegmentStatus {
  PENDING = 'pending',
  TRANSLATED = 'translated',
  REVIEWING = 'reviewing',
  REVIEW_PENDING = 'review_pending', // 等待审校
  REVIEW_IN_PROGRESS = 'review_in_progress', // 审校中
  REVIEW_FAILED = 'review_failed', // 审校失败，需重新提交
  REVIEW_COMPLETED = 'review_completed', // 审校完成，待确认
  COMPLETED = 'completed', // 审校确认，最终完成
  ERROR = 'error'
}

export enum IssueType {
  TERMINOLOGY = 'terminology',
  GRAMMAR = 'grammar',
  STYLE = 'style',
  ACCURACY = 'accuracy',
  FORMATTING = 'formatting',
  CONSISTENCY = 'consistency',
  OTHER = 'other'
}

export enum ReviewScoreType {
  OVERALL = 'overall', // 总体评分
  ACCURACY = 'accuracy', // 准确性
  FLUENCY = 'fluency', // 流畅度
  TERMINOLOGY = 'terminology', // 术语准确性
  STYLE = 'style', // 风格一致性
  LOCALE = 'locale' // 本地化适配
}

export interface IIssue {
  type: IssueType;
  description: string;
  position?: {
    start: number;
    end: number;
  };
  suggestion?: string;
  resolved: boolean;
  createdAt?: Date;
  resolvedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  resolvedBy?: mongoose.Types.ObjectId;
}

// 审校变更历史
export interface IReviewChange {
  version: number; // 版本号
  content: string; // 修改后的内容
  timestamp: Date; // 修改时间
  modifiedBy: mongoose.Types.ObjectId; // 修改人
  aiGenerated: boolean; // 是否由AI生成
  acceptedByHuman: boolean; // 是否被人类确认接受
}

// 审校质量评分
export interface IReviewScore {
  type: ReviewScoreType; // 评分类型
  score: number; // 分数 (0-100)
  details?: string; // 评分详情
}

// 审校结果
export interface IReviewResult {
  originalTranslation: string; // 原始翻译
  suggestedTranslation?: string; // AI建议的翻译
  finalTranslation?: string; // 最终确认的翻译
  issues: mongoose.Types.ObjectId[]; // 问题列表
  scores: IReviewScore[]; // 评分
  reviewDate: Date; // 审校日期
  reviewerId?: mongoose.Types.ObjectId; // 人工审校人员
  aiReviewer?: string; // AI审校模型
  modificationDegree?: number; // 修改程度 (0-1)
  acceptedChanges?: boolean; // 是否接受AI修改
}

export interface ISegment extends Document {
  fileId: mongoose.Types.ObjectId;
  content: string;
  translation?: string;
  originalLength: number;
  translatedLength: number;
  status: SegmentStatus;
  translator?: mongoose.Types.ObjectId;
  reviewer?: mongoose.Types.ObjectId;
  metadata?: {
    path?: string;
    [key: string]: any;
  };
  error?: string;
  issues?: IIssue[]; // 审校问题列表
  reviewResult?: IReviewResult; // 审校结果
  reviewHistory?: IReviewChange[]; // 审校历史
  createdAt: Date;
  updatedAt: Date;
}

const IssueSchema = new Schema<IIssue>({
  type: { 
    type: String, 
    enum: Object.values(IssueType),
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  position: {
    start: { type: Number },
    end: { type: Number }
  },
  suggestion: { 
    type: String 
  },
  resolved: { 
    type: Boolean, 
    default: false 
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: Date,
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  _id: true 
});

const ReviewScoreSchema = new Schema<IReviewScore>({
  type: {
    type: String,
    enum: Object.values(ReviewScoreType),
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  details: String
}, {
  _id: false
});

const ReviewChangeSchema = new Schema<IReviewChange>({
  version: {
    type: Number,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  modifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  aiGenerated: {
    type: Boolean,
    default: false
  },
  acceptedByHuman: {
    type: Boolean,
    default: false
  }
}, {
  _id: false
});

const ReviewResultSchema = new Schema<IReviewResult>({
  originalTranslation: {
    type: String,
    required: true
  },
  suggestedTranslation: String,
  finalTranslation: String,
  issues: [{
    type: Schema.Types.ObjectId,
    ref: 'Issue'
  }],
  scores: [ReviewScoreSchema],
  reviewDate: {
    type: Date,
    default: Date.now
  },
  reviewerId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  aiReviewer: String,
  modificationDegree: {
    type: Number,
    min: 0,
    max: 1
  },
  acceptedChanges: Boolean
}, {
  _id: false
});

const segmentSchema = new Schema<ISegment>(
  {
    fileId: {
      type: Schema.Types.ObjectId,
      ref: 'File',
      required: true
    },
    content: {
      type: String,
      required: true
    },
    translation: String,
    originalLength: {
      type: Number,
      required: true
    },
    translatedLength: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: Object.values(SegmentStatus),
      default: SegmentStatus.PENDING
    },
    translator: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    metadata: {
      type: Schema.Types.Mixed
    },
    error: String,
    issues: [IssueSchema],
    reviewResult: ReviewResultSchema,
    reviewHistory: [ReviewChangeSchema]
  },
  {
    timestamps: true
  }
);

// 创建索引
segmentSchema.index({ fileId: 1 });
segmentSchema.index({ status: 1 });
segmentSchema.index({ translator: 1 });
segmentSchema.index({ reviewer: 1 });

export const Segment = mongoose.model<ISegment>('Segment', segmentSchema);

// 导出问题模型，用于独立查询
export const Issue = mongoose.model<IIssue>('Issue', IssueSchema);