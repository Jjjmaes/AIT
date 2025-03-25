// ===== 第六步：创建错误处理中间件 =====
// src/middleware/error.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';

export class ApiError extends Error {
  statusCode: number;
  success: boolean;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.success = false;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('错误详情:', err);

  // 处理自定义错误
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  // 处理其他类型的错误
  if (err instanceof UnauthorizedError) {
    return res.status(401).json({
      success: false,
      message: err.message
    });
  }

  if (err instanceof NotFoundError) {
    return res.status(404).json({
      success: false,
      message: err.message
    });
  }

  if (err instanceof ForbiddenError) {
    return res.status(403).json({
      success: false,
      message: err.message
    });
  }

  if (err instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  // 处理 JWT 错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: '无效的令牌'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: '令牌已过期'
    });
  }

  // 处理 MongoDB 错误
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: '数据验证失败',
      errors: Object.values((err as any).errors).map((e: any) => e.message)
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: '无效的ID格式'
    });
  }

  // 处理其他未知错误
  return res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
}; 