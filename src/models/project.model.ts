import mongoose from 'mongoose';
import { IUser } from './user.model';

// 项目状态枚举
export enum ProjectStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// 项目优先级枚举
export enum ProjectPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

// 项目进度接口
interface IProjectProgress {
  totalSegments: number;
  translatedSegments: number;
  reviewedSegments: number;
  completionPercentage: number;
}

// 项目基础接口
interface IProjectBase {
  name: string;
  description?: string;
  sourceLanguage: string;
  targetLanguage: string;
  managerId: mongoose.Types.ObjectId;
  reviewers?: mongoose.Types.ObjectId[];
  status: ProjectStatus;
  priority: ProjectPriority;
  deadline?: Date;
  progress: IProjectProgress;
  createdAt: Date;
  updatedAt: Date;
}

// 项目接口（包含 _id）
export interface IProject extends IProjectBase {
  _id: mongoose.Types.ObjectId;
}

// 项目文档类型（用于 Mongoose）
export type ProjectDocument = mongoose.Document & IProjectBase;

// 项目Schema
const projectSchema = new mongoose.Schema<ProjectDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true
    },
    description: String,
    sourceLanguage: {
      type: String,
      required: true
    },
    targetLanguage: {
      type: String,
      required: true
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reviewers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    status: {
      type: String,
      enum: Object.values(ProjectStatus),
      default: ProjectStatus.DRAFT
    },
    priority: {
      type: String,
      enum: Object.values(ProjectPriority),
      default: ProjectPriority.MEDIUM
    },
    deadline: Date,
    progress: {
      totalSegments: {
        type: Number,
        default: 0
      },
      translatedSegments: {
        type: Number,
        default: 0
      },
      reviewedSegments: {
        type: Number,
        default: 0
      },
      completionPercentage: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true
  }
);

// 创建索引
projectSchema.index({ managerId: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ priority: 1 });
projectSchema.index({ deadline: 1 });

export const Project = mongoose.model<ProjectDocument>('Project', projectSchema);