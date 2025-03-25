import { Types } from 'mongoose';
import { ProjectStatus, ProjectPriority, CreateProjectDto } from '../../types/project.types';

export const mockProjects: CreateProjectDto[] = [
  {
    name: 'Test Project 1',
    description: 'Test Description 1',
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    managerId: new Types.ObjectId().toString(),
    translationPromptTemplate: 'translation template 1',
    reviewPromptTemplate: 'review template 1',
    priority: ProjectPriority.MEDIUM,
    deadline: new Date('2024-12-31')
  },
  {
    name: 'Test Project 2',
    description: 'Test Description 2',
    sourceLanguage: 'ja',
    targetLanguage: 'en',
    managerId: new Types.ObjectId().toString(),
    translationPromptTemplate: 'translation template 2',
    reviewPromptTemplate: 'review template 2',
    priority: ProjectPriority.HIGH,
    deadline: new Date('2024-12-31')
  }
];

export const mockProjectsWithStatus = mockProjects.map(project => ({
  ...project,
  status: ProjectStatus.PENDING,
  progress: {
    totalWords: 1000,
    translatedWords: 0,
    completionPercentage: 0
  },
  reviewers: [new Types.ObjectId().toString()],
  createdAt: new Date(),
  updatedAt: new Date()
})); 