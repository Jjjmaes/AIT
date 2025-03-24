// src/validators/promptValidator.ts

import { body } from 'express-validator';
import { PromptType, PromptStatus } from '../models/prompt-template.model';

// 创建提示词模板验证
export const validateCreatePrompt = [
  body('name')
    .trim()
    .notEmpty().withMessage('提示词模板名称不能为空')
    .isLength({ min: 3, max: 100 }).withMessage('提示词模板名称长度必须在3-100个字符之间'),
  
  body('type')
    .notEmpty().withMessage('提示词类型不能为空')
    .isIn(Object.values(PromptType)).withMessage('提示词类型无效'),
  
  body('systemInstruction')
    .notEmpty().withMessage('系统指令不能为空')
    .isLength({ min: 10 }).withMessage('系统指令长度不能少于10个字符'),
  
  body('userInputTemplate')
    .notEmpty().withMessage('用户输入模板不能为空')
    .isLength({ min: 5 }).withMessage('用户输入模板长度不能少于5个字符'),
  
  body('variables')
    .optional()
    .isArray().withMessage('变量必须是数组'),
  
  body('sourceLanguages')
    .optional()
    .isArray().withMessage('源语言必须是数组'),
  
  body('targetLanguages')
    .optional()
    .isArray().withMessage('目标语言必须是数组'),
  
  body('domains')
    .optional()
    .isArray().withMessage('领域必须是数组'),
  
  body('aiProvider')
    .notEmpty().withMessage('AI提供商不能为空')
    .isString().withMessage('AI提供商必须是字符串'),
  
  body('aiModel')
    .notEmpty().withMessage('AI模型不能为空')
    .isString().withMessage('AI模型必须是字符串'),
  
  body('parentTemplate')
    .optional()
    .isMongoId().withMessage('父模板ID格式无效'),
  
  body('status')
    .optional()
    .isIn(Object.values(PromptStatus)).withMessage('状态值无效')
];

// 更新提示词模板验证
export const validateUpdatePrompt = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 }).withMessage('提示词模板名称长度必须在3-100个字符之间'),
  
  body('description')
    .optional()
    .trim(),
  
  body('systemInstruction')
    .optional()
    .isLength({ min: 10 }).withMessage('系统指令长度不能少于10个字符'),
  
  body('userInputTemplate')
    .optional()
    .isLength({ min: 5 }).withMessage('用户输入模板长度不能少于5个字符'),
  
  body('outputFormat')
    .optional(),
  
  body('variables')
    .optional()
    .isArray().withMessage('变量必须是数组'),
  
  body('sourceLanguages')
    .optional()
    .isArray().withMessage('源语言必须是数组'),
  
  body('targetLanguages')
    .optional()
    .isArray().withMessage('目标语言必须是数组'),
  
  body('domains')
    .optional()
    .isArray().withMessage('领域必须是数组'),
  
  body('aiProvider')
    .optional()
    .isString().withMessage('AI提供商必须是字符串'),
  
  body('aiModel')
    .optional()
    .isString().withMessage('AI模型必须是字符串'),
  
  body('status')
    .optional()
    .isIn(Object.values(PromptStatus)).withMessage('状态值无效'),
  
  body('version')
    .optional()
    .isNumeric().withMessage('版本必须是数字')
];

// 测试提示词模板验证
export const validateTestPrompt = [
  body('promptId')
    .notEmpty().withMessage('提示词模板ID不能为空')
    .isMongoId().withMessage('提示词模板ID格式无效'),
  
  body('sampleInput')
    .notEmpty().withMessage('测试输入不能为空')
    .isString().withMessage('测试输入必须是字符串'),
  
  body('variables')
    .optional()
    .isObject().withMessage('变量必须是对象')
];