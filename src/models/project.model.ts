import mongoose, { Document } from 'mongoose';
import { IUser } from './user.model';

// 项目状态枚举
export enum ProjectStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  REVIEWING = 'reviewing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// 项目优先级枚举
export enum ProjectPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// 项目进度接口
interface IProjectProgress {
  totalSegments: number;
  translatedSegments: number;
  reviewedSegments: number;
  lastUpdated: Date;
}

// 项目接口
export interface IProject extends Document {
  name: string;
  description?: string;
  sourceLanguage: string;
  targetLanguage: string;
  manager: mongoose.Types.ObjectId | IUser;
  reviewers: mongoose.Types.ObjectId[] | IUser[];
  translationPromptTemplate: mongoose.Types.ObjectId;
  reviewPromptTemplate: mongoose.Types.ObjectId;
  deadline?: Date;
  priority: ProjectPriority;
  status: ProjectStatus;
  progress: IProjectProgress;
  files: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

// 项目Schema
const projectSchema = new mongoose.Schema<IProject>({
  name: {
    type: String,
    required: [true, '项目名称不能为空'],
    trim: true,
    minlength: [3, '项目名称至少需要3个字符'],
    maxlength: [100, '项目名称不能超过100个字符']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, '项目描述不能超过500个字符']
  },
  sourceLanguage: {
    type: String,
    required: [true, '源语言不能为空'],
    trim: true
  },
  targetLanguage: {
    type: String,
    required: [true, '目标语言不能为空'],
    trim: true
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '项目管理者不能为空']
  },
  reviewers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  translationPromptTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromptTemplate',
    required: [true, '翻译提示词模板不能为空']
  },
  reviewPromptTemplate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromptTemplate',
    required: [true, '审校提示词模板不能为空']
  },
  deadline: {
    type: Date
  },
  priority: {
    type: String,
    enum: Object.values(ProjectPriority),
    default: ProjectPriority.MEDIUM
  },
  status: {
    type: String,
    enum: Object.values(ProjectStatus),
    default: ProjectStatus.DRAFT
  },
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
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  files: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File'
  }]
}, {
  timestamps: true
});

// 创建索引
projectSchema.index({ name: 1, manager: 1 }, { unique: true });
projectSchema.index({ status: 1 });
projectSchema.index({ priority: 1 });
projectSchema.index({ deadline: 1 });

const Project = mongoose.model<IProject>('Project', projectSchema);

export default Project;