import mongoose, { Schema, Document, Types } from 'mongoose';
import { IFile } from './file.model';
import { IUser } from './user.model';
import { IProject } from './project.model';

export enum SegmentStatus {
  PENDING = 'pending',               // Segment extracted, ready for translation
  TRANSLATING = 'translating',         // Sent to AI for translation
  TRANSLATION_FAILED = 'translation_failed', // AI translation attempt failed
  TRANSLATED_TM = 'translated_tm',     // Translated using Translation Memory
  TRANSLATED = 'translated',           // AI translation completed, ready for review
  // PENDING_REVIEW state might not be needed at segment level if file status tracks it
  REVIEWING = 'reviewing',             // Sent to AI for review (or assigned to human)
  REVIEW_FAILED = 'review_failed',       // AI review attempt failed (NEW)
  REVIEW_COMPLETED = 'review_completed',   // AI review completed (or human review done)
  NEEDS_MANUAL_REVIEW = 'needs_manual_review', // AI review flagged issues requiring human check
  CONFIRMED = 'confirmed'            // Final state after human review/acceptance
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

// Define the structure for review issues
export interface IReviewIssue extends Document {
  type: string; // e.g., 'grammar', 'terminology', 'style', 'mistranslation'
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  description: string;
  suggestion?: string; // Optional AI suggestion
  resolved: boolean;
  resolvedBy?: Types.ObjectId | IUser;
  resolvedAt?: Date;
}

// Interface for the Segment document
export interface ISegment extends Document {
  fileId: Types.ObjectId | IFile;
  projectId: Types.ObjectId | IProject;
  index: number; // Order within the file
  sourceText: string;
  translation?: string;
  status: SegmentStatus;
  sourceLength: number;
  translatedLength?: number;
  metadata?: Record<string, any>; // Store things like XLIFF ID, context keys
  issues?: IReviewIssue[]; // Array to store review findings
  locked?: boolean; // Prevent modification
  createdAt: Date;
  updatedAt: Date;
  translatedAt?: Date;
  reviewedAt?: Date; // Timestamp for review completion (NEW)
  errorDetails?: string; // Store error messages (NEW)
  // Optional fields for tracking review process
  reviewer?: Types.ObjectId | IUser; 
  reviewStartedAt?: Date;
  // Optional field for final confirmed text after review/edits
  finalText?: string; 
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

// Mongoose Schema definition
const ReviewIssueSchema = new Schema<IReviewIssue>({
  type: { type: String, required: true },
  severity: { type: String, required: true, enum: ['critical', 'major', 'minor', 'suggestion'] },
  description: { type: String, required: true },
  suggestion: { type: String },
  resolved: { type: Boolean, default: false },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
}, { _id: true, timestamps: true }); // Add timestamps to issues?

const SegmentSchema = new Schema<ISegment>({
  fileId: { type: Schema.Types.ObjectId, ref: 'File', required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  index: { type: Number, required: true },
  sourceText: { type: String, required: true },
  translation: { type: String },
  status: { type: String, enum: Object.values(SegmentStatus), default: SegmentStatus.PENDING, index: true },
  sourceLength: { type: Number, required: true },
  translatedLength: { type: Number },
  metadata: { type: Schema.Types.Mixed },
  issues: [ReviewIssueSchema], // Embed issues
  locked: { type: Boolean, default: false },
  translatedAt: { type: Date },
  reviewedAt: { type: Date }, // Add field (NEW)
  errorDetails: { type: String }, // Add field (NEW)
  reviewer: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewStartedAt: { type: Date },
  finalText: { type: String },
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Compound index for faster lookups within a file
SegmentSchema.index({ fileId: 1, index: 1 });

// Existing indexes
SegmentSchema.index({ fileId: 1 });
SegmentSchema.index({ status: 1 });
SegmentSchema.index({ reviewer: 1 });

// Model
export const Segment = mongoose.model<ISegment>('Segment', SegmentSchema);
export const Issue = mongoose.model<IIssue>('Issue', IssueSchema);