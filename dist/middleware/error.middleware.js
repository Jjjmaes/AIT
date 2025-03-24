"use strict";
// ===== 第六步：创建错误处理中间件 =====
// src/middleware/error.middleware.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.ApiError = void 0;
class ApiError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.success = false;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.ApiError = ApiError;
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.success = false;
    res.status(err.statusCode).json({
        success: false,
        message: err.message
    });
};
exports.errorHandler = errorHandler;
