// src/validators/promptValidator.ts

import { z } from 'zod';
import { PromptType, PromptStatus } from '../models/prompt-template.model';
import { mongoIdSchema, createEnumValidator } from './common';

// 创建提示词模板验证
export const validateCreatePrompt = z.object({
  body: z.object({
    name: z.string()
      .min(3, '提示词模板名称长度必须在3-100个字符之间')
      .max(100, '提示词模板名称长度必须在3-100个字符之间'),
    type: createEnumValidator(PromptType),
    systemInstruction: z.string()
      .min(10, '系统指令长度不能少于10个字符'),
    userInputTemplate: z.string()
      .min(5, '用户输入模板长度不能少于5个字符'),
    variables: z.array(z.string())
      .optional(),
    sourceLanguages: z.array(z.string())
      .optional(),
    targetLanguages: z.array(z.string())
      .optional(),
    domains: z.array(z.string())
      .optional(),
    aiProvider: z.string()
      .min(1, 'AI提供商不能为空'),
    aiModel: z.string()
      .min(1, 'AI模型不能为空'),
    parentTemplate: mongoIdSchema
      .optional(),
    status: createEnumValidator(PromptStatus)
      .optional()
  })
});

// 更新提示词模板验证
export const validateUpdatePrompt = z.object({
  body: z.object({
    name: z.string()
      .min(3, '提示词模板名称长度必须在3-100个字符之间')
      .max(100, '提示词模板名称长度必须在3-100个字符之间')
      .optional(),
    description: z.string()
      .optional(),
    systemInstruction: z.string()
      .min(10, '系统指令长度不能少于10个字符')
      .optional(),
    userInputTemplate: z.string()
      .min(5, '用户输入模板长度不能少于5个字符')
      .optional(),
    outputFormat: z.string()
      .optional(),
    variables: z.array(z.string())
      .optional(),
    sourceLanguages: z.array(z.string())
      .optional(),
    targetLanguages: z.array(z.string())
      .optional(),
    domains: z.array(z.string())
      .optional(),
    aiProvider: z.string()
      .optional(),
    aiModel: z.string()
      .optional(),
    status: createEnumValidator(PromptStatus)
      .optional(),
    version: z.number()
      .int('版本必须是整数')
      .optional()
  })
});

// 测试提示词模板验证
export const validateTestPrompt = z.object({
  body: z.object({
    promptId: mongoIdSchema,
    sampleInput: z.string()
      .min(1, '测试输入不能为空'),
    variables: z.record(z.unknown())
      .optional()
  })
});