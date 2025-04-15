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
const logger_1 = __importDefault(require("../utils/logger"));
const authenticateJwt = async (req, res, next) => {
    logger_1.default.debug('Attempting JWT authentication...');
    try {
        const authHeader = req.headers.authorization;
        logger_1.default.debug('Authorization Header:', authHeader);
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger_1.default.warn('No Bearer token found in Authorization header.');
            throw new errors_1.UnauthorizedError('未提供身份验证令牌');
        }
        const token = authHeader.split(' ')[1];
        logger_1.default.debug('Extracted Token:', token ? `${token.substring(0, 10)}...` : 'null');
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            logger_1.default.error('JWT_SECRET is not defined in environment variables!');
            throw new Error('JWT Secret not configured');
        }
        const payload = jsonwebtoken_1.default.verify(token, jwtSecret);
        logger_1.default.debug('JWT Payload verified:', payload);
        const user = await user_model_1.default.findById(payload.sub).select('-password');
        if (!user) {
            logger_1.default.warn(`User not found for token sub: ${payload.sub}`);
            throw new errors_1.UnauthorizedError('无效的令牌 - 用户不存在');
        }
        logger_1.default.info(`Authenticated user: ${user.username} (ID: ${user._id}, Role: ${user.role})`);
        req.user = {
            id: user._id.toString(),
            email: user.email,
            username: user.username,
            role: user.role
        };
        next();
    }
    catch (error) {
        logger_1.default.error('JWT Authentication failed:', {
            errorName: error.name,
            errorMessage: error.message
        });
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            next(new errors_1.UnauthorizedError('身份验证令牌已过期'));
        }
        else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            next(new errors_1.UnauthorizedError('无效的令牌'));
        }
        else if (error instanceof errors_1.UnauthorizedError) {
            next(error);
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
