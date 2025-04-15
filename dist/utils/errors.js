"use strict";
// ===== 第五步：创建错误处理工具 =====
// src/utils/errors.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = exports.ConflictError = exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class NotFoundError extends AppError {
    constructor(message = '未找到资源') {
        super(message, 404);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends AppError {
    constructor(message = '未授权') {
        super(message, 401);
        this.name = 'UnauthorizedError';
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = '禁止访问') {
        super(message, 403);
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
class ConflictError extends AppError {
    constructor(message = '资源冲突') {
        super(message, 409);
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
class ValidationError extends AppError {
    constructor(message = '验证失败') {
        super(message, 400);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
