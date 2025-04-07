import { TranslationOptions, TranslationResult } from '../types/translation.types';
import { IProject, IProjectFile } from '../models/project.model';

export { TranslationOptions, TranslationResult };

export interface ITranslationQueue {
  addJob(job: TranslationJob): Promise<void>;
  getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    completedCount: number;
    totalCount: number;
    error?: string;
  }>;
  cancelJob(jobId: string): Promise<void>;
  addSegmentTranslationJob(
    projectId: string,
    fileId: string,
    segmentId: string,
    options: TranslationOptions
  ): Promise<string>;
  addFileTranslationJob(
    projectId: string,
    fileId: string,
    options: TranslationOptions
  ): Promise<string>;
  addProjectTranslationJob(
    projectId: string,
    options: TranslationOptions
  ): Promise<string>;
}

export interface IAIProviderManager {
  translateText(text: string, options: TranslationOptions): Promise<string>;
  translateBatch(texts: string[], options: TranslationOptions): Promise<string[]>;
}

export interface IProjectService {
  getProject(projectId: string): Promise<IProject>;
  updateProject(projectId: string, data: Partial<IProject>): Promise<IProject>;
}

export interface TranslationJob {
  id: string;
  type: 'file' | 'project';
  projectId: string;
  fileId?: string;
  options: TranslationOptions;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  result?: TranslationResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TranslationJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type TranslationJobType = 'file' | 'project'; 