import { z } from 'zod';

// 用户注册验证
export const validateRegister = z.object({
  body: z.object({
    username: z.string()
      .min(3, '用户名长度必须在3-20个字符之间')
      .max(20, '用户名长度必须在3-20个字符之间'),
    password: z.string()
      .min(6, '密码长度不能少于6个字符'),
    email: z.string()
      .email('请输入有效的邮箱地址'),
    role: z.enum(['admin', 'reviewer', 'translator'])
      .optional()
  })
});

// 用户登录验证
export const validateLogin = z.object({
  body: z.object({
    email: z.string()
      .email('请输入有效的邮箱地址'),
    password: z.string()
      .min(1, '密码不能为空')
  })
}); 