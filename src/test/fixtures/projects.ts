import { Types } from 'mongoose';
import { ProjectStatus } from '../../models/project.model';
import { ProjectPriority, CreateProjectDto } from '../../types/project.types';

export const mockProjects: CreateProjectDto[] = [
  {
    name: 'Test Project 1',
    description: 'Test Description 1',
    languagePairs: [{ source: 'en', target: 'zh' }],
    manager: new Types.ObjectId().toString(),
    priority: 1
  },
  {
    name: 'Test Project 2',
    description: 'Test Description 2',
    languagePairs: [{ source: 'ja', target: 'en' }],
    manager: new Types.ObjectId().toString(),
    priority: 2
  }
];

// export const mockProjectsWithStatus = mockProjects.map(project => ({ ... }));