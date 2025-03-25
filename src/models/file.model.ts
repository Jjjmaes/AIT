import mongoose, { Schema, Document } from 'mongoose';

export enum FileStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready',
  TRANSLATING = 'translating',
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
  MEMOQ_XLIFF = 'mqxliff',
  XLIFF = 'xliff'
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
  uploadedBy: mongoose.Types.ObjectId;
  storageUrl: string;
  formatInfo: {
    preserveFormatting: boolean;
    originalFormat: string;
    targetFormat: string;
  };
  processingOptions: {
    maxSegmentLength: number;
    minSegmentLength: number;
    preserveFormatting: boolean;
  };
  metadata: {
    sourceLanguage: string;
    targetLanguage: string;
    category: string;
    tags: string[];
  };
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
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    storageUrl: {
      type: String,
      required: true
    },
    formatInfo: {
      preserveFormatting: {
        type: Boolean,
        default: true
      },
      originalFormat: String,
      targetFormat: String
    },
    processingOptions: {
      maxSegmentLength: {
        type: Number,
        default: 1000
      },
      minSegmentLength: {
        type: Number,
        default: 100
      },
      preserveFormatting: {
        type: Boolean,
        default: true
      }
    },
    metadata: {
      sourceLanguage: String,
      targetLanguage: String,
      category: String,
      tags: [String]
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
fileSchema.index({ uploadedBy: 1 });
fileSchema.index({ 'metadata.sourceLanguage': 1, 'metadata.targetLanguage': 1 });

export const File = mongoose.model<IFile>('File', fileSchema);