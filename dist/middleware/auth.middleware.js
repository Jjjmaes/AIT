"use strict";
// ===== 第三步：创建身份验证中间件 =====
// src/middleware/auth.middleware.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRoles = exports.authenticateJwt = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importDefault(require("../models/user.model"));
const errors_1 = require("../utils/errors");
const authenticateJwt = async (req, res, next) => {
    try {
        console.log('开始身份验证');
        const authHeader = req.headers.authorization;
        console.log('Authorization header:', authHeader);
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('未提供有效的Authorization header');
            throw new errors_1.UnauthorizedError('未提供身份验证令牌');
        }
        const token = authHeader.split(' ')[1];
        console.log('提取的token:', token.substring(0, 20) + '...');
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        console.log('JWT验证成功，用户ID:', payload.sub);
        const user = await user_model_1.default.findById(payload.sub).select('-password');
        if (!user) {
            console.log('未找到用户:', payload.sub);
            throw new errors_1.UnauthorizedError('无效的令牌');
        }
        console.log('用户验证成功:', user.email);
        req.user = {
            id: user._id.toString(),
            email: user.email,
            username: user.username,
            role: user.role
        };
        next();
    }
    catch (error) {
        console.error('身份验证失败:', error);
        next(new errors_1.UnauthorizedError('身份验证失败'));
    }
};
exports.authenticateJwt = authenticateJwt;
// 角色授权中间件
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        console.log('开始角色验证');
        console.log('用户角色:', req.user?.role);
        console.log('所需角色:', roles);
        if (!req.user) {
            console.log('未找到用户信息');
            return next(new errors_1.UnauthorizedError('请先登录'));
        }
        if (!roles.includes(req.user.role)) {
            console.log('用户角色不匹配');
            return next(new errors_1.UnauthorizedError('您没有权限访问此资源'));
        }
        console.log('角色验证通过');
        next();
    };
};
exports.authorizeRoles = authorizeRoles;
