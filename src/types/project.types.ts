import { Types } from 'mongoose';

export enum ProjectStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum ProjectPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
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
  };
  files: FileStats;
  progress: ProgressStats;
  time: TimeStats;
}

export interface CreateProjectDto {
  name: string;
  description: string;
  sourceLanguage: string;
  targetLanguage: string;
  translationPromptTemplate: string;
  reviewPromptTemplate: string;
  deadline?: Date;
  priority?: ProjectPriority;
  managerId: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  deadline?: Date;
  translationPromptTemplate?: string;
  reviewPromptTemplate?: string;
}

export interface ProjectProgressDto {
  completionPercentage: number;
  translatedWords: number;
  totalWords: number;
} 