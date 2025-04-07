"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.asyncErrorHandler = exports.errorHandler = void 0;
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * 全局错误处理中间件
 * 捕获所有未处理的错误并转换为适当的HTTP响应
 */
const errorHandler = (err, req, res, next) => {
    // 记录错误
    logger_1.default.error(`[ErrorHandler] ${err.message}`, {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        stack: err.stack,
        ...(err.details ? { details: err.details } : {})
    });
    // 已知的应用错误
    if (err instanceof errors_1.AppError) {
        return res.status(err.statusCode).json({
            success: false,
            status: err.status,
            message: err.message,
            error: process.env.NODE_ENV === 'development' ? {
                name: err.name,
                stack: err.stack
            } : undefined,
            timestamp: new Date().toISOString()
        });
    }
    // Mongoose 验证错误
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors)
            .map((val) => val.message)
            .join(', ');
        return res.status(400).json({
            success: false,
            status: 'fail',
            message: message,
            timestamp: new Date().toISOString()
        });
    }
    // Mongoose 重复键错误
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const message = `${field} 已存在`;
        return res.status(409).json({
            success: false,
            status: 'fail',
            message: message,
            timestamp: new Date().toISOString()
        });
    }
    // JWT 错误
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            status: 'fail',
            message: '身份验证失败: 无效的令牌',
            timestamp: new Date().toISOString()
        });
    }
    // JWT 过期错误
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            status: 'fail',
            message: '身份验证失败: 令牌已过期',
            timestamp: new Date().toISOString()
        });
    }
    // 默认服务器错误响应
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
        success: false,
        status: 'error',
        message: process.env.NODE_ENV === 'production'
            ? '服务器内部错误'
            : err.message || '未知错误',
        error: process.env.NODE_ENV === 'development' ? {
            name: err.name,
            stack: err.stack
        } : undefined,
        timestamp: new Date().toISOString()
    });
};
exports.errorHandler = errorHandler;
/**
 * 捕获未处理的异步错误中间件
 */
const asyncErrorHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncErrorHandler = asyncErrorHandler;
/**
 * 未找到路由处理中间件
 */
const notFoundHandler = (req, res, next) => {
    const err = new Error(`找不到路径: ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        status: 'fail',
        message: `找不到路径: ${req.originalUrl}`,
        timestamp: new Date().toISOString()
    });
};
exports.notFoundHandler = notFoundHandler;
