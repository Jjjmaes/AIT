import mongoose, { Schema, Document } from 'mongoose';
import { IFile } from './file.model';
import { IUser } from './user.model';

export enum SegmentStatus {
  PENDING = 'pending',
  TRANSLATED = 'translated',
  REVIEWING = 'reviewing',
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
  }
}, { 
  _id: true 
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
      type: Map,
      of: Schema.Types.Mixed
    },
    error: String
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