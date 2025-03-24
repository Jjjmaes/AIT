import mongoose, { Document, Schema } from 'mongoose';
import { IFile } from './file.model';
import { IUser } from './user.model';

export enum SegmentStatus {
  PENDING = 'pending',
  TRANSLATING = 'translating',
  TRANSLATED = 'translated',
  REVIEWING = 'reviewing',
  REVIEWED = 'reviewed',
  COMPLETED = 'completed',
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

export interface IIssue {
  type: IssueType;
  description: string;
  position?: {
    start: number;
    end: number;
  };
  suggestion?: string;
  resolved: boolean;
}

export interface ISegment extends Document {
  file: mongoose.Types.ObjectId | IFile;
  index: number;
  sourceText: string;
  aiTranslation?: string;
  aiReview?: string;
  finalTranslation?: string;
  status: SegmentStatus;
  issues: IIssue[];
  reviewer?: mongoose.Types.ObjectId | IUser;
  translationMetadata?: {
    aiModel: string;
    promptTemplateId: mongoose.Types.ObjectId;
    tokenCount: number;
    processingTime: number;
  };
  reviewMetadata?: {
    aiModel: string;
    promptTemplateId: mongoose.Types.ObjectId;
    tokenCount: number;
    processingTime: number;
    acceptedChanges: boolean;
    modificationDegree?: number;
  };
  translationCompletedAt?: Date;
  reviewCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IssueSchema: Schema = new Schema({
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
  }
}, { 
  _id: true 
});

const SegmentSchema: Schema = new Schema({
  file: { 
    type: Schema.Types.ObjectId, 
    ref: 'File',
    required: true 
  },
  index: { 
    type: Number, 
    required: true 
  },
  sourceText: { 
    type: String, 
    required: true 
  },
  aiTranslation: { 
    type: String 
  },
  aiReview: { 
    type: String 
  },
  finalTranslation: { 
    type: String 
  },
  status: { 
    type: String, 
    enum: Object.values(SegmentStatus),
    default: SegmentStatus.PENDING 
  },
  issues: [IssueSchema],
  reviewer: { 
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  },
  translationMetadata: {
    aiModel: { type: String },
    promptTemplateId: { type: Schema.Types.ObjectId, ref: 'PromptTemplate' },
    tokenCount: { type: Number },
    processingTime: { type: Number }
  },
  reviewMetadata: {
    aiModel: { type: String },
    promptTemplateId: { type: Schema.Types.ObjectId, ref: 'PromptTemplate' },
    tokenCount: { type: Number },
    processingTime: { type: Number },
    acceptedChanges: { type: Boolean },
    modificationDegree: { type: Number }
  },
  translationCompletedAt: { 
    type: Date 
  },
  reviewCompletedAt: { 
    type: Date 
  }
}, { 
  timestamps: true 
});

// 创建复合索引以便快速查找某个文件中的所有段落
SegmentSchema.index({ file: 1, index: 1 });

export default mongoose.model<ISegment>('Segment', SegmentSchema);