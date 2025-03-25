import { Schema, model, Document } from 'mongoose';
import { ProjectStatus, ProjectPriority } from '../types/project.types';

export interface IProjectProgress {
  completionPercentage: number;
  translatedWords: number;
  totalWords: number;
}

export interface IProject extends Document {
  name: string;
  description: string;
  managerId: string;
  sourceLanguage: string;
  targetLanguage: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  translationPromptTemplate: string;
  reviewPromptTemplate: string;
  deadline?: Date;
  estimatedCompletionTime?: Date;
  progress: IProjectProgress;
  reviewers: Schema.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  managerId: { type: String, required: true },
  sourceLanguage: { type: String, required: true },
  targetLanguage: { type: String, required: true },
  status: { 
    type: String, 
    enum: Object.values(ProjectStatus),
    default: ProjectStatus.PENDING 
  },
  priority: { 
    type: String, 
    enum: Object.values(ProjectPriority),
    default: ProjectPriority.MEDIUM 
  },
  translationPromptTemplate: { type: String, required: true },
  reviewPromptTemplate: { type: String, required: true },
  deadline: { type: Date },
  estimatedCompletionTime: { type: Date },
  progress: {
    completionPercentage: { type: Number, default: 0 },
    translatedWords: { type: Number, default: 0 },
    totalWords: { type: Number, default: 0 }
  },
  reviewers: [{ type: Schema.Types.ObjectId, ref: 'User' }]
}, {
  timestamps: true
});

export default model<IProject>('Project', projectSchema);