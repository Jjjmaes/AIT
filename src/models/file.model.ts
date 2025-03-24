import mongoose, { Document, Schema } from 'mongoose';
import { IProject } from './project.model';

export enum FileStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  TRANSLATED = 'translated',
  REVIEWING = 'reviewing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export enum FileType {
  DOCX = 'docx',
  TXT = 'txt',
  HTML = 'html',
  XML = 'xml',
  JSON = 'json',
  MARKDOWN = 'md',
  CSV = 'csv',
  EXCEL = 'xlsx'
}

export interface IFile extends Document {
  name: string;
  originalName: string;
  project: mongoose.Types.ObjectId | IProject;
  path: string;
  type: FileType;
  size: number;
  status: FileStatus;
  segmentCount: number;
  translatedCount: number;
  reviewedCount: number;
  errorDetails?: string;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FileSchema: Schema = new Schema({
  name: { 
    type: String, 
    required: true 
  },
  originalName: { 
    type: String, 
    required: true 
  },
  project: { 
    type: Schema.Types.ObjectId, 
    ref: 'Project',
    required: true 
  },
  path: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: Object.values(FileType),
    required: true 
  },
  size: { 
    type: Number, 
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
  errorDetails: { 
    type: String 
  },
  processingStartedAt: { 
    type: Date 
  },
  processingCompletedAt: { 
    type: Date 
  }
}, { 
  timestamps: true 
});

export default mongoose.model<IFile>('File', FileSchema);