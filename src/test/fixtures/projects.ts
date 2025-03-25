import { Types } from 'mongoose';
import { ProjectStatus, ProjectPriority } from '../../models/project.model';

export const mockProjects = [
  {
    name: 'Test Project 1',
    description: 'Test Description 1',
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    managerId: new Types.ObjectId(),
    translationPromptTemplate: 'translation template 1',
    reviewPromptTemplate: 'review template 1',
    status: ProjectStatus.DRAFT,
    priority: ProjectPriority.MEDIUM,
    progress: {
      totalSegments: 100,
      translatedSegments: 0,
      reviewedSegments: 0,
      completionPercentage: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Test Project 2',
    description: 'Test Description 2',
    sourceLanguage: 'ja',
    targetLanguage: 'en',
    managerId: new Types.ObjectId(),
    translationPromptTemplate: 'translation template 2',
    reviewPromptTemplate: 'review template 2',
    status: ProjectStatus.IN_PROGRESS,
    priority: ProjectPriority.HIGH,
    progress: {
      totalSegments: 50,
      translatedSegments: 25,
      reviewedSegments: 10,
      completionPercentage: 20
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
]; 