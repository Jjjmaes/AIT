import { z } from 'zod';
import { ProjectStatus, ILanguagePair } from '../models/project.model';

const languagePairSchema = z.object({
  source: z.string(),
  target: z.string()
});

// Define allowed priority values
const allowedPriorities = [1, 2, 3] as const;

export const createProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空'),
  description: z.string().optional(),
  languagePairs: z.array(languagePairSchema).min(1, '至少需要一个语言对'),
  manager: z.string().optional(), // Make manager optional here
  // Add fields based on CreateProjectDto in service
  reviewers: z.array(z.string()).optional(), 
  defaultTranslationPromptTemplate: z.string().optional(),
  defaultReviewPromptTemplate: z.string().optional(),
  translationPromptTemplate: z.string().optional(),
  reviewPromptTemplate: z.string().optional(),
  deadline: z.string().datetime({ message: "无效的日期时间格式" }).optional(), // Validate as ISO datetime string
  priority: z.number().refine(val => allowedPriorities.includes(val as typeof allowedPriorities[number]), {
    message: '优先级必须是 1 (低), 2 (中), 或 3 (高)'
  }).optional(),
  domain: z.string().optional(),
  industry: z.string().optional(), // Add industry field
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').optional(),
  description: z.string().optional(),
  languagePairs: z.array(languagePairSchema).optional(),
  manager: z.string().optional(), // Assuming manager ID can be updated
  reviewers: z.array(z.string()).optional(),
  defaultTranslationPromptTemplate: z.string().optional(),
  defaultReviewPromptTemplate: z.string().optional(),
  translationPromptTemplate: z.string().optional(),
  reviewPromptTemplate: z.string().optional(),
  deadline: z.string().datetime({ message: "无效的日期时间格式" }).optional(),
  priority: z.number().refine(val => allowedPriorities.includes(val as typeof allowedPriorities[number]), {
    message: '优先级必须是 1 (低), 2 (中), 或 3 (高)'
  }).optional(),
  domain: z.string().optional(),
  industry: z.string().optional(), // Add industry field
  status: z.nativeEnum(ProjectStatus).optional(), // Allow status updates from frontend?
});

export const projectProgressSchema = z.object({
  completionPercentage: z.number().min(0).max(100),
  translatedWords: z.number().min(0),
  totalWords: z.number().min(0)
}); 