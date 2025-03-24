import { body } from 'express-validator';
import { UserStatus } from '../models/user.model';

// 用户信息更新验证
export const validateUpdateUser = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('用户名长度应在3-30个字符之间'),
  
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('请输入有效的邮箱地址'),
  
  body('password')
    .optional()
    .trim()
    .isLength({ min: 6 }).withMessage('密码长度不能少于6个字符'),
  
  body('role')
    .optional()
    .trim()
    .isIn(['admin', 'translator', 'reviewer']).withMessage('角色无效'),
  
  body('status')
    .optional()
    .isIn(Object.values(UserStatus)).withMessage('状态必须是active或inactive')
];

// 用户密码修改验证
export const validateChangePassword = [
  body('currentPassword')
    .trim()
    .notEmpty().withMessage('当前密码不能为空'),
  
  body('newPassword')
    .trim()
    .notEmpty().withMessage('新密码不能为空')
    .isLength({ min: 6 }).withMessage('密码长度不能小于6位')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('新密码不能与当前密码相同');
      }
      return true;
    })
]; 