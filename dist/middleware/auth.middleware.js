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
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errors_1.UnauthorizedError('未提供身份验证令牌');
        }
        const token = authHeader.split(' ')[1];
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await user_model_1.default.findById(payload.sub).select('-password');
        if (!user) {
            throw new errors_1.UnauthorizedError('无效的令牌');
        }
        req.user = {
            id: user._id.toString(),
            email: user.email,
            username: user.username,
            role: user.role
        };
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            next(new errors_1.UnauthorizedError('无效的令牌'));
        }
        else {
            next(new errors_1.UnauthorizedError('身份验证失败'));
        }
    }
};
exports.authenticateJwt = authenticateJwt;
// 角色授权中间件
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new errors_1.UnauthorizedError('请先登录'));
        }
        if (!roles.includes(req.user.role)) {
            return next(new errors_1.UnauthorizedError('您没有权限访问此资源'));
        }
        next();
    };
};
exports.authorizeRoles = authorizeRoles;
