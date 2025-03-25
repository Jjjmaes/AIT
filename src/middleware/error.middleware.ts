// ===== 第六步：创建错误处理中间件 =====
// src/middleware/error.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { Error as MongooseError } from 'mongoose';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 默认错误
  let statusCode = 500;
  let status = 'error';
  let message = err.message || '服务器内部错误';

  // 处理 AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    status = statusCode >= 500 ? 'error' : 'fail';
    message = err.message;
  }
  // 处理 Mongoose 验证错误
  else if (err instanceof MongooseError.ValidationError) {
    statusCode = 400;
    status = 'fail';
    message = Object.values(err.errors)
      .map(error => error.message)
      .join(', ');
  }
  // 处理 Mongoose 重复键错误
  else if (err.name === 'MongoServerError' && (err as any).code === 11000) {
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