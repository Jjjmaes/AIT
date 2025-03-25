import { z } from 'zod';
import { UserStatus } from '../models/user.model';

// 用户信息更新验证
export const validateUpdateUser = z.object({
  body: z.object({
    username: z.string()
      .min(3, '用户名长度应在3-30个字符之间')
      .max(30, '用户名长度应在3-30个字符之间')
      .optional(),
    email: z.string()
      .email('请输入有效的邮箱地址')
      .optional(),
    password: z.string()
      .min(6, '密码长度不能少于6个字符')
      .optional(),
    role: z.enum(['admin', 'translator', 'reviewer'])
      .optional(),
    status: z.enum([UserStatus.ACTIVE, UserStatus.INACTIVE])
      .optional()
  })
});

// 用户密码修改验证
export const validateChangePassword = z.object({
  body: z.object({
    currentPassword: z.string()
      .min(1, '当前密码不能为空'),
    newPassword: z.string()
      .min(6, '密码长度不能小于6位')
  }).refine((data) => data.newPassword !== data.currentPassword, {
    message: '新密码不能与当前密码相同'
  })
}); 