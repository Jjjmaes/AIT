import mongoose, { Schema, Document, Types } from 'mongoose';
import { FileType } from './file.model';
import { IPromptTemplate } from './promptTemplate.model';

// Define ProjectStatus enum here and export it
export enum ProjectStatus {
  ACTIVE = 'active',
  PENDING = 'pending', // Add other relevant statuses if needed
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export interface IFileSegment {
  id: string;
  source: string;
  target: string;
  status: string;
  metadata?: {
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
  id: string;
  name: string;
  path: string;
  wordCount: number;
  characterCount: number;
  status: string;
  progress: number;
  segments: IFileSegment[];
}

export interface ILanguagePair {
  source: string;
  target: string;
}

export interface IProject extends Document {
  name: string;
  description?: string;
  owner: Types.ObjectId;
  manager: Types.ObjectId;
  reviewers?: Types.ObjectId[];
  members: Types.ObjectId[];
  languagePairs: ILanguagePair[];
  defaultTranslationPromptTemplate?: Types.ObjectId | IPromptTemplate;
  defaultReviewPromptTemplate?: Types.ObjectId | IPromptTemplate;
  translationPromptTemplate?: Types.ObjectId | IPromptTemplate;
  reviewPromptTemplate?: Types.ObjectId | IPromptTemplate;
  domain?: string;
  industry?: string;
  terminology?: Types.ObjectId;
  translationAIConfigId?: Types.ObjectId;
  status: ProjectStatus;
  priority?: number;
  deadline?: Date;
  files: IProjectFile[];
  progress?: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

const fileSegmentSchema = new Schema<IFileSegment>({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String },
  status: { type: String, default: 'pending' },
  metadata: {
    processingTime: { type: Number },
    tokens: { type: Number },
    cost: { type: Number },
    reviewStatus: { type: String, enum: ['approved', 'rejected'] }
  },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date }
});

const projectFileSchema = new Schema<IProjectFile>({
  id: String,
  name: String,
  path: String,
  wordCount: Number,
  characterCount: Number,
  status: String,
  progress: Number,
  segments: [Schema.Types.Mixed]
});

const languagePairSchema = new Schema<ILanguagePair>({
  source: { type: String, required: true },
  target: { type: String, required: true }
}, { _id: false });

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, index: true },
    description: { type: String },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    manager: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reviewers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    languagePairs: [languagePairSchema],
    defaultTranslationPromptTemplate: { type: Schema.Types.ObjectId, ref: 'PromptTemplate' },
    defaultReviewPromptTemplate: { type: Schema.Types.ObjectId, ref: 'PromptTemplate' },
    translationPromptTemplate: { type: Schema.Types.ObjectId, ref: 'PromptTemplate' },
    reviewPromptTemplate: { type: Schema.Types.ObjectId, ref: 'PromptTemplate' },
    domain: { type: String },
    industry: { type: String },
    terminology: { type: Schema.Types.ObjectId, ref: 'Terminology' },
    translationAIConfigId: { type: Schema.Types.ObjectId, ref: 'AIProviderConfig', required: false },
    status: { 
        type: String, 
        enum: Object.values(ProjectStatus),
        default: ProjectStatus.ACTIVE,
        index: true 
    },
    priority: { type: Number, index: true },
    deadline: { type: Date, index: true },
    files: [projectFileSchema],
    progress: { type: Number },
    completedAt: { type: Date }
  },
  {
    timestamps: true
  }
);

// Indexes for querying
projectSchema.index({ owner: 1 });
projectSchema.index({ manager: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ priority: 1 });
projectSchema.index({ deadline: 1 });

export const Project = mongoose.model<IProject>('Project', projectSchema);
export default Project;