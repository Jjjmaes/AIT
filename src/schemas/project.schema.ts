import { z } from 'zod';
import { ProjectStatus, ILanguagePair } from '../models/project.model';
import { ProjectPriority } from '../types/project.types';

const languagePairSchema = z.object({
  source: z.string(),
  target: z.string()
});

export const createProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空'),
  description: z.string().optional(),
  languagePairs: z.array(languagePairSchema).min(1, '至少需要一个语言对'),
  manager: z.string(),
  members: z.array(z.string()).optional(),
  defaultPromptTemplateId: z.string().optional(),
  domain: z.string().optional(),
  terminologyId: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  priority: z.number().optional()
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').optional(),
  description: z.string().optional(),
  languagePairs: z.array(languagePairSchema).optional(),
  manager: z.string().optional(),
  members: z.array(z.string()).optional(),
  defaultPromptTemplateId: z.string().optional(),
  domain: z.string().optional(),
  terminologyId: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  priority: z.number().optional()
});

export const projectProgressSchema = z.object({
  completionPercentage: z.number().min(0).max(100),
  translatedWords: z.number().min(0),
  totalWords: z.number().min(0)
}); 