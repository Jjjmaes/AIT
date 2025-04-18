"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLogin = exports.validateRegister = void 0;
const zod_1 = require("zod");
// 用户注册验证 (Schema directly validates the expected req.body structure)
exports.validateRegister = zod_1.z.object({
    username: zod_1.z.string()
        .min(3, '用户名长度必须在3-20个字符之间')
        .max(20, '用户名长度必须在3-20个字符之间'),
    password: zod_1.z.string()
        .min(6, '密码长度不能少于6个字符'),
    email: zod_1.z.string()
        .email('请输入有效的邮箱地址'),
    role: zod_1.z.enum(['admin', 'reviewer', 'translator'])
        .optional()
});
// 用户登录验证 (Schema directly validates the expected req.body structure)
exports.validateLogin = zod_1.z.object({
    email: zod_1.z.string()
        .email('请输入有效的邮箱地址'),
    password: zod_1.z.string()
        .min(1, '密码不能为空')
});
