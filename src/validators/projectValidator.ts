// src/validators/projectValidator.ts

import { z } from 'zod';
import { ProjectPriority, ProjectStatus } from '../types/project.types';
import { mongoIdSchema, createEnumValidator } from './common';

// 项目创建验证
export const validateCreateProject = z.object({
  body: z.object({
    name: z.string()
      .min(1, '项目名称不能为空'),
    description: z.string()
      .optional(),
    sourceLanguage: z.string()
      .min(1, '源语言不能为空'),
    targetLanguage: z.string()
      .min(1, '目标语言不能为空'),
    manager: mongoIdSchema
      .optional(),
    reviewers: z.array(mongoIdSchema)
      .optional(),
    translationPromptTemplate: z.string()
      .min(1, '翻译提示模板不能为空'),
    reviewPromptTemplate: z.string()
      .min(1, '审阅提示模板不能为空'),
    deadline: z.string()
      .datetime('截止日期格式无效')
      .optional(),
    priority: createEnumValidator(ProjectPriority)
      .optional()
  })
});

// 项目更新验证
export const validateUpdateProject = z.object({
  body: z.object({
    name: z.string()
      .optional(),
    description: z.string()
      .optional(),
    sourceLanguage: z.string()
      .optional(),
    targetLanguage: z.string()
      .optional(),
    manager: mongoIdSchema
      .optional(),
    reviewers: z.array(mongoIdSchema)
      .optional(),
    translationPromptTemplate: z.string()
      .optional(),
    reviewPromptTemplate: z.string()
      .optional(),
    deadline: z.string()
      .datetime('截止日期格式无效')
      .optional(),
    priority: createEnumValidator(ProjectPriority)
      .optional(),
    status: createEnumValidator(ProjectStatus)
      .optional()
  })
});

// 更新项目进度验证
export const validateUpdateProjectProgress = z.object({
  params: z.object({
    projectId: mongoIdSchema
  }),
  body: z.object({
    status: createEnumValidator(ProjectStatus)
      .optional(),
    progress: z.object({
      totalSegments: z.number()
        .optional(),
      translatedSegments: z.number()
        .optional(),
      reviewedSegments: z.number()
        .optional()
    })
      .optional()
  })
});