import { Types } from 'mongoose';
import { FileStatus, FileType } from '../models/file.model';
import { ILanguagePair, ProjectStatus } from '../models/project.model'; // Assuming this interface exists

export enum ProjectPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface FileStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

export interface ProgressStats {
  completionPercentage: number;
  translatedWords: number;
  totalWords: number;
}

export interface TimeStats {
  createdAt: Date;
  updatedAt: Date;
  deadline?: Date;
  estimatedCompletionTime?: Date;
}

export interface ProjectStats {
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    priority: ProjectPriority;
    sourceLanguage: string;
    targetLanguage: string;
    industry: string;
  };
  files: FileStats;
  progress: ProgressStats;
  time: TimeStats;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  languagePairs: ILanguagePair[];
  manager: string;
  members?: string[];
  defaultPromptTemplateId?: string | Types.ObjectId;
  domain?: string;
  terminologyId?: string | Types.ObjectId;
  status?: ProjectStatus;
  priority?: number;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  languagePairs?: ILanguagePair[];
  manager?: string;
  members?: string[];
  defaultPromptTemplateId?: string | Types.ObjectId | null;
  domain?: string;
  terminologyId?: string | Types.ObjectId | null;
  status?: ProjectStatus;
  priority?: number;
}

export interface IProjectProgress {
  completionPercentage: number;
  translatedWords: number;
  totalWords: number;
} 