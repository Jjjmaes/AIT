"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateChangePassword = exports.validateUpdateUser = void 0;
const zod_1 = require("zod");
const user_model_1 = require("../models/user.model");
// 用户信息更新验证
exports.validateUpdateUser = zod_1.z.object({
    body: zod_1.z.object({
        username: zod_1.z.string()
            .min(3, '用户名长度应在3-30个字符之间')
            .max(30, '用户名长度应在3-30个字符之间')
            .optional(),
        email: zod_1.z.string()
            .email('请输入有效的邮箱地址')
            .optional(),
        password: zod_1.z.string()
            .min(6, '密码长度不能少于6个字符')
            .optional(),
        role: zod_1.z.enum(['admin', 'translator', 'reviewer'])
            .optional(),
        status: zod_1.z.enum([user_model_1.UserStatus.ACTIVE, user_model_1.UserStatus.INACTIVE])
            .optional()
    })
});
// 用户密码修改验证
exports.validateChangePassword = zod_1.z.object({
    body: zod_1.z.object({
        currentPassword: zod_1.z.string()
            .min(1, '当前密码不能为空'),
        newPassword: zod_1.z.string()
            .min(6, '密码长度不能小于6位')
    }).refine((data) => data.newPassword !== data.currentPassword, {
        message: '新密码不能与当前密码相同'
    })
});
