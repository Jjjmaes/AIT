// src/validators/projectValidator.ts

import { body } from 'express-validator';
import { ProjectPriority, ProjectStatus } from '../models/project.model';

// 项目创建验证
export const validateCreateProject = [
  body('name')
    .trim()
    .notEmpty().withMessage('项目名称不能为空')
    .isLength({ min: 3, max: 100 }).withMessage('项目名称长度必须在3-100个字符之间'),
  
  body('sourceLanguage')
    .trim()
    .notEmpty().withMessage('源语言不能为空'),
  
  body('targetLanguage')
    .trim()
    .notEmpty().withMessage('目标语言不能为空'),
  
  body('manager')
    .optional()
    .isMongoId().withMessage('管理者ID格式无效'),
  
  body('reviewers')
    .optional()
    .isArray().withMessage('审校人员必须是数组')
    .custom((value) => {
      if (value && value.length > 0) {
        // 检查数组中的每个ID是否是有效的MongoDB ID
        const isValid = value.every((id: string) => /^[0-9a-fA-F]{24}$/.test(id));
        if (!isValid) {
          throw new Error('审校人员ID格式无效');
        }
      }
      return true;
    }),
  
  body('translationPromptTemplate')
    .notEmpty().withMessage('翻译提示词模板不能为空')
    .isMongoId().withMessage('翻译提示词模板ID格式无效'),
  
  body('reviewPromptTemplate')
    .notEmpty().withMessage('审校提示词模板不能为空')
    .isMongoId().withMessage('审校提示词模板ID格式无效'),
  
  body('deadline')
    .optional()
    .isISO8601().withMessage('截止日期格式无效'),
  
  body('priority')
    .optional()
    .isIn(Object.values(ProjectPriority)).withMessage('优先级值无效')
];

// 项目更新验证
export const validateUpdateProject = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 }).withMessage('项目名称长度必须在3-100个字符之间'),
  
  body('sourceLanguage')
    .optional()
    .trim(),
  
  body('targetLanguage')
    .optional()
    .trim(),
  
  body('manager')
    .optional()
    .isMongoId().withMessage('管理者ID格式无效'),
  
  body('reviewers')
    .optional()
    .isArray().withMessage('审校人员必须是数组')
    .custom((value) => {
      if (value && value.length > 0) {
        const isValid = value.every((id: string) => /^[0-9a-fA-F]{24}$/.test(id));
        if (!isValid) {
          throw new Error('审校人员ID格式无效');
        }
      }
      return true;
    }),
  
  body('translationPromptTemplate')
    .optional()
    .isMongoId().withMessage('翻译提示词模板ID格式无效'),
  
  body('reviewPromptTemplate')
    .optional()
    .isMongoId().withMessage('审校提示词模板ID格式无效'),
  
  body('deadline')
    .optional()
    .isISO8601().withMessage('截止日期格式无效'),
  
  body('priority')
    .optional()
    .isIn(Object.values(ProjectPriority)).withMessage('优先级值无效'),
  
  body('status')
    .optional()
    .isIn(Object.values(ProjectStatus)).withMessage('状态值无效')
];