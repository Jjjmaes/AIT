"use strict";
// ===== 第六步：创建错误处理中间件 =====
// src/middleware/error.middleware.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errors_1 = require("../utils/errors");
const mongoose_1 = require("mongoose");
const errorHandler = (err, req, res, next) => {
    // 默认错误
    let statusCode = 500;
    let status = 'error';
    let message = err.message || '服务器内部错误';
    // 处理 AppError
    if (err instanceof errors_1.AppError) {
        statusCode = err.statusCode;
        status = statusCode >= 500 ? 'error' : 'fail';
        message = err.message;
    }
    // 处理 Mongoose 验证错误
    else if (err instanceof mongoose_1.Error.ValidationError) {
        statusCode = 400;
        status = 'fail';
        message = Object.values(err.errors)
            .map(error => error.message)
            .join(', ');
    }
    // 处理 Mongoose 重复键错误
    else if (err.name === 'MongoServerError' && err.code === 11000) {
        statusCode = 409;
        status = 'fail';
        message = '数据已存在';
    }
    // 开发环境下返回错误堆栈
    const stack = process.env.NODE_ENV === 'development' ? err.stack : undefined;
    res.status(statusCode).json({
        status,
        message,
        ...(stack && { stack })
    });
};
exports.errorHandler = errorHandler;
