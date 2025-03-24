// ===== 第六步：创建错误处理中间件 =====
// src/middleware/error.middleware.ts

import { Request, Response, NextFunction } from 'express';

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
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  err.statusCode = err.statusCode || 500;
  err.success = false;

  res.status(err.statusCode).json({
    success: false,
    message: err.message
  });
}; 