// ===== 第四步：创建验证器 =====
// src/utils/validators.ts

import { body } from 'express-validator';

export const registerValidator = [
  body('username')
    .trim()
    .notEmpty().withMessage('用户名不能为空')
    .isLength({ min: 3 }).withMessage('用户名至少需要3个字符'),
  
  body('password')
    .notEmpty().withMessage('密码不能为空')
    .isLength({ min: 6 }).withMessage('密码长度不能少于6个字符'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('邮箱不能为空')
    .isEmail().withMessage('邮箱格式不正确'),
  
  body('role')
    .optional()
    .isIn(['admin', 'reviewer']).withMessage('角色必须是admin或reviewer')
];

export const loginValidator = [
  body('username')
    .trim()
    .notEmpty().withMessage('用户名不能为空'),
  
  body('password')
    .notEmpty().withMessage('密码不能为空')
];
