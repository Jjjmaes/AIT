import mongoose, { Schema, Document } from 'mongoose';

export enum FileStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  TRANSLATED = 'translated',
  REVIEWING = 'reviewing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export enum FileType {
  TXT = 'txt',
  JSON = 'json',
  MD = 'md'
}

export interface IFile extends Document {
  projectId: mongoose.Types.ObjectId;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  type: FileType;
  status: FileStatus;
  segmentCount: number;
  translatedCount: number;
  reviewedCount: number;
  path: string;
  processedAt?: Date;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  error?: string;
  errorDetails?: string;
  createdAt: Date;
  updatedAt: Date;
}

const fileSchema = new Schema<IFile>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    fileName: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: Object.values(FileType),
      required: true
    },
    status: {
      type: String,
      enum: Object.values(FileStatus),
      default: FileStatus.PENDING
    },
    segmentCount: {
      type: Number,
      default: 0
    },
    translatedCount: {
      type: Number,
      default: 0
    },
    reviewedCount: {
      type: Number,
      default: 0
    },
    path: {
      type: String,
      required: true
    },
    processedAt: Date,
    processingStartedAt: Date,
    processingCompletedAt: Date,
    error: String,
    errorDetails: String
  },
  {
    timestamps: true
  }
);

// 创建索引
fileSchema.index({ projectId: 1 });
fileSchema.index({ status: 1 });
fileSchema.index({ type: 1 });

export const File = mongoose.model<IFile>('File', fileSchema);