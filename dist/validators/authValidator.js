"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLogin = exports.validateRegister = void 0;
const express_validator_1 = require("express-validator");
// 用户注册验证
exports.validateRegister = [
    (0, express_validator_1.body)('username')
        .trim()
        .notEmpty().withMessage('用户名不能为空')
        .isLength({ min: 3, max: 20 }).withMessage('用户名长度必须在3-20个字符之间'),
    (0, express_validator_1.body)('password')
        .trim()
        .notEmpty().withMessage('密码不能为空')
        .isLength({ min: 6 }).withMessage('密码长度不能少于6个字符'),
    (0, express_validator_1.body)('email')
        .trim()
        .notEmpty().withMessage('邮箱不能为空')
        .isEmail().withMessage('请输入有效的邮箱地址'),
    (0, express_validator_1.body)('role')
        .optional()
        .isIn(['admin', 'reviewer']).withMessage('角色必须是admin或reviewer')
];
// 用户登录验证
exports.validateLogin = [
    (0, express_validator_1.body)('email')
        .trim()
        .notEmpty().withMessage('邮箱不能为空')
        .isEmail().withMessage('请输入有效的邮箱地址'),
    (0, express_validator_1.body)('password')
        .trim()
        .notEmpty().withMessage('密码不能为空')
];
