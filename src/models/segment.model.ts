import mongoose, { Schema, Document, Types } from 'mongoose';
import { IFile } from './file.model';
import { IUser } from './user.model';

export enum SegmentStatus {
  PENDING = 'pending',
  TRANSLATING = 'translating',
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
  OMISSION = 'omission',
  ADDITION = 'addition',
  OTHER = 'other'
}

export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum IssueStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
  DEFERRED = 'deferred'
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
  _id?: Types.ObjectId; // Optional _id for subdocuments
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  position?: { start: number; end: number; };
  suggestion?: string;
  status: IssueStatus;
  resolution?: { action: 'accept' | 'modify' | 'reject'; modifiedText?: string; comment?: string; };
  createdAt?: Date;
  resolvedAt?: Date;
  createdBy?: Types.ObjectId;
  resolvedBy?: Types.ObjectId;
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
  index: number;
  sourceText: string;
  sourceLength: number;
  translation?: string;
  translatedLength?: number;
  review?: string;
  finalText?: string;
  status: SegmentStatus;
  issues?: IIssue[];
  reviewer?: mongoose.Types.ObjectId;
  translationMetadata?: {
    aiModel?: string;
    promptTemplateId?: mongoose.Types.ObjectId;
    tokenCount?: number;
    processingTime?: number;
  };
  reviewMetadata?: {
    aiModel?: string;
    promptTemplateId?: mongoose.Types.ObjectId;
    tokenCount?: number;
    processingTime?: number;
    acceptedChanges?: boolean;
    modificationDegree?: number;
  };
  metadata?: Record<string, any>;
  translationCompletedAt?: Date;
  reviewCompletedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define IssueSchema for embedding
const IssueSchema = new Schema<IIssue>({
  type: { type: String, enum: Object.values(IssueType), required: true },
  severity: { type: String, enum: Object.values(IssueSeverity), required: true },
  description: { type: String, required: true },
  position: { start: { type: Number }, end: { type: Number } },
  suggestion: { type: String },
  status: { type: String, enum: Object.values(IssueStatus), required: true, default: IssueStatus.OPEN },
  resolution: {
      action: { type: String, enum: ['accept', 'modify', 'reject'] },
      modifiedText: String,
      comment: String
  },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { _id: true }); // Enable _id for subdocuments if needed

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
      required: true,
      index: true
    },
    index: { type: Number, required: true },
    sourceText: {
      type: String,
      required: true
    },
    sourceLength: {
      type: Number,
      required: true
    },
    translation: {
      type: String
    },
    translatedLength: {
      type: Number
    },
    review: {
      type: String
    },
    finalText: {
      type: String
    },
    status: {
      type: String,
      enum: Object.values(SegmentStatus),
      default: SegmentStatus.PENDING,
      index: true
    },
    issues: [IssueSchema],
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    translationMetadata: {
      aiModel: String,
      promptTemplateId: {
        type: Schema.Types.ObjectId,
        ref: 'PromptTemplate'
      },
      tokenCount: Number,
      processingTime: Number
    },
    reviewMetadata: {
      aiModel: String,
      promptTemplateId: {
        type: Schema.Types.ObjectId,
        ref: 'PromptTemplate'
      },
      tokenCount: Number,
      processingTime: Number,
      acceptedChanges: Boolean,
      modificationDegree: Number
    },
    metadata: {
      type: Schema.Types.Mixed
    },
    translationCompletedAt: {
      type: Date
    },
    reviewCompletedAt: {
      type: Date
    },
    error: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient querying within a file
segmentSchema.index({ fileId: 1, index: 1 });

// Existing indexes
segmentSchema.index({ fileId: 1 });
segmentSchema.index({ status: 1 });
segmentSchema.index({ reviewer: 1 });

export const Segment = mongoose.model<ISegment>('Segment', segmentSchema);
export const Issue = mongoose.model<IIssue>('Issue', IssueSchema);