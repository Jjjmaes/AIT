import { z } from 'zod';
import { ProjectStatus, ProjectPriority } from '../types/project.types';

export const createProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空'),
  description: z.string().min(1, '项目描述不能为空'),
  sourceLanguage: z.string().min(1, '源语言不能为空'),
  targetLanguage: z.string().min(1, '目标语言不能为空'),
  translationPromptTemplate: z.string().min(1, '翻译提示模板不能为空'),
  reviewPromptTemplate: z.string().min(1, '审核提示模板不能为空'),
  deadline: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  priority: z.nativeEnum(ProjectPriority).optional()
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').optional(),
  description: z.string().min(1, '项目描述不能为空').optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  priority: z.nativeEnum(ProjectPriority).optional(),
  deadline: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  translationPromptTemplate: z.string().min(1, '翻译提示模板不能为空').optional(),
  reviewPromptTemplate: z.string().min(1, '审核提示模板不能为空').optional()
});

export const projectProgressSchema = z.object({
  completionPercentage: z.number().min(0).max(100),
  translatedWords: z.number().min(0),
  totalWords: z.number().min(0)
}); 