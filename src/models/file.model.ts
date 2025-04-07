import mongoose, { Schema, Document, Types } from 'mongoose';
import { TranslationStatus } from '../types/translation.types';

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
  MD = 'md',
  DOCX = 'docx',
  HTML = 'html',
  XML = 'xml',
  CSV = 'csv',
  XLSX = 'xlsx',
  MEMOQ_XLIFF = 'mqxliff',
  XLIFF = 'xliff'
}

export interface IFile extends Document {
  projectId: Types.ObjectId;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  type: FileType;
  status: FileStatus;
  uploadedBy: Types.ObjectId;
  storageUrl: string;
  path: string;
  metadata: {
    sourceLanguage: string;
    targetLanguage: string;
    category?: string;
    tags?: string[];
  };
  progress?: {
    total: number;
    completed: number;
    translated: number;
    percentage: number;
  };
  error?: string;
  errorDetails?: string;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  segmentCount: number;
  translatedCount: number;
  reviewedCount: number;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFileSegment {
  id: string;
  sourceText: string;
  translatedText: string;
  status: TranslationStatus;
  metadata: {
    processingTime?: number;
    tokens?: number;
    cost?: number;
    reviewStatus?: 'approved' | 'rejected';
  };
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
}

export interface IProjectFile {
  _id: Types.ObjectId;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  type: FileType;
  status: FileStatus;
  uploadedBy: Types.ObjectId;
  storageUrl: string;
  path: string;
  metadata: {
    processingTime?: number;
    tokens?: number;
    cost?: number;
  };
  progress: number;
  error?: string;
  errorDetails?: any;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  segmentCount: number;
  translatedCount: number;
  reviewedCount: number;
  segments: IFileSegment[];
  processedAt?: Date;
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
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    storageUrl: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    metadata: {
      sourceLanguage: {
        type: String,
        required: true
      },
      targetLanguage: {
        type: String,
        required: true
      },
      category: String,
      tags: [String]
    },
    progress: {
      total: Number,
      completed: Number,
      translated: Number,
      percentage: Number
    },
    error: String,
    errorDetails: String,
    processingStartedAt: Date,
    processingCompletedAt: Date,
    segmentCount: {
      type: Number,
      required: true,
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
    processedAt: Date
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