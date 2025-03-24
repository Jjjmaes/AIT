import { body } from 'express-validator';

export const validateUser = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('用户名不能为空')
    .isLength({ min: 3, max: 20 })
    .withMessage('用户名长度必须在3-20个字符之间'),
  
  body('email')
    .trim()
    .notEmpty()
    .withMessage('邮箱不能为空')
    .isEmail()
    .withMessage('请输入有效的邮箱地址'),
  
  body('password')
    .trim()
    .notEmpty()
    .withMessage('密码不能为空')
    .isLength({ min: 6 })
    .withMessage('密码长度不能少于6个字符')
]; 