// src/validators/fileValidator.ts

import { body, param, query } from 'express-validator';
import { FileStatus, FileType } from '../models/file.model';

// 上传文件验证（针对请求中可能包含的元数据）
export const validateFileUpload = [
  body('projectId')
    .notEmpty().withMessage('项目ID不能为空')
    .isMongoId().withMessage('项目ID格式无效'),
  
  body('type')
    .optional()
    .isIn(Object.values(FileType)).withMessage('文件类型无效')
];

// 更新文件状态验证
export const validateUpdateFileStatus = [
  param('fileId')
    .notEmpty().withMessage('文件ID不能为空')
    .isMongoId().withMessage('文件ID格式无效'),
  
  body('status')
    .notEmpty().withMessage('状态不能为空')
    .isIn(Object.values(FileStatus)).withMessage('状态值无效')
];

// 获取文件列表验证
export const validateGetFiles = [
  query('projectId')
    .notEmpty().withMessage('项目ID不能为空')
    .isMongoId().withMessage('项目ID格式无效'),
  
  query('status')
    .optional()
    .isIn(Object.values(FileStatus)).withMessage('状态值无效'),
  
  query('type')
    .optional()
    .isIn(Object.values(FileType)).withMessage('文件类型无效')
];

// 处理文件验证
export const validateProcessFile = [
  param('fileId')
    .notEmpty().withMessage('文件ID不能为空')
    .isMongoId().withMessage('文件ID格式无效'),
  
  body('segmentationOptions')
    .optional()
    .isObject().withMessage('分段选项必须是对象')
];

// 获取文件段落验证
export const validateGetFileSegments = [
  param('fileId')
    .notEmpty().withMessage('文件ID不能为空')
    .isMongoId().withMessage('文件ID格式无效'),
  
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('页码必须是大于0的整数'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('每页数量必须是1-100之间的整数'),
  
  query('status')
    .optional()
    .isString().withMessage('状态必须是字符串')
];