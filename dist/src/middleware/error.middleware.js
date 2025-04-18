"use strict";
// ===== 第六步：创建错误处理中间件 =====
// src/middleware/error.middleware.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errors_1 = require("../utils/errors");
const mongoose_1 = require("mongoose");
const logger_1 = __importDefault(require("../utils/logger"));
const errorHandler = (err, req, res, next) => {
    // Keep the initial comprehensive log
    logger_1.default.error('errorHandler received error:', {
        message: err.message,
        name: err.name,
        stack: err.stack,
        ...(err instanceof errors_1.AppError && { statusCode: err.statusCode }),
        ...(err instanceof mongoose_1.Error.ValidationError && { errors: err.errors }),
        ...(err.code && { code: err.code })
    });
    // Default error
    let statusCode = 500;
    let status = 'error';
    let message = '服务器内部错误';
    let details = undefined;
    // Handle our custom ValidationError
    if (err instanceof errors_1.ValidationError) {
        statusCode = 400;
        status = 'fail';
        message = err.message;
        details = undefined;
        logger_1.default.warn(`Handling ValidationError: ${message}`);
    }
    // Handle other AppError subtypes (like UnauthorizedError, NotFoundError)
    else if (err instanceof errors_1.AppError) {
        statusCode = err.statusCode;
        status = statusCode >= 500 ? 'error' : 'fail';
        message = err.message;
    }
    // Handle Mongoose Validation Error
    else if (err instanceof mongoose_1.Error.ValidationError) {
        statusCode = 400;
        status = 'fail';
        message = '数据库验证失败';
        details = Object.values(err.errors)
            .map(error => ({ path: error.path, message: error.message }));
    }
    // Handle Mongoose Duplicate Key Error
    else if (err.name === 'MongoServerError' && err.code === 11000) {
        statusCode = 409;
        status = 'fail';
        const match = err.message.match(/index: (.+?) dup key: { (.+?) }/);
        message = match
            ? `字段 '${match[2]}' 的值已存在。`
            : '数据重复，无法保存。';
        details = err.keyValue;
    }
    // Handle other potential errors (e.g., JSON parsing error from express.json())
    else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        statusCode = 400;
        status = 'fail';
        message = '无效的请求体格式 (Bad JSON)';
        details = err.message;
    }
    // Development environment details
    const stack = process.env.NODE_ENV === 'development' ? err.stack : undefined;
    res.status(statusCode).json({
        status,
        message,
        ...(details && { details }),
        ...(stack && { stack })
    });
};
exports.errorHandler = errorHandler;
