// ===== 第六步：创建错误处理中间件 =====
// src/middleware/error.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';
import { Error as MongooseError } from 'mongoose';
import logger from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Keep the initial comprehensive log
  logger.error('errorHandler received error:', { 
    message: err.message, 
    name: err.name, 
    stack: err.stack, 
    ...(err instanceof AppError && { statusCode: err.statusCode }),
    ...(err instanceof MongooseError.ValidationError && { errors: err.errors }),
    ...((err as any).code && { code: (err as any).code })
  });

  // Default error
  let statusCode = 500;
  let status = 'error';
  let message = '服务器内部错误';
  let details: any = undefined;

  // Handle our custom ValidationError
  if (err instanceof ValidationError) {
    statusCode = 400;
    status = 'fail';
    message = '请求参数验证失败';
    // Log the properties of the caught ValidationError
    logger.warn('Handling ValidationError instance:', { 
      name: err.name,
      message: err.message, // This is what we are trying to parse
      stack: err.stack?.split('\n').slice(0, 5).join('\n') // Log first few lines of stack
    });
    try {
        details = JSON.parse(err.message);
        logger.info('Parsed Zod error details:', details);
    } catch (parseError: any) {
        logger.error('Failed to parse Zod error details from message:', { parseErrorMessage: parseError.message });
        details = err.message; // Fallback to the raw message
    }
  }
  // Handle other AppError subtypes (like UnauthorizedError, NotFoundError)
  else if (err instanceof AppError) {
    statusCode = err.statusCode;
    status = statusCode >= 500 ? 'error' : 'fail';
    message = err.message;
  }
  // Handle Mongoose Validation Error
  else if (err instanceof MongooseError.ValidationError) {
    statusCode = 400;
    status = 'fail';
    message = '数据库验证失败';
    details = Object.values(err.errors)
      .map(error => ({ path: error.path, message: error.message }));
  }
  // Handle Mongoose Duplicate Key Error
  else if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    statusCode = 409;
    status = 'fail';
    const match = err.message.match(/index: (.+?) dup key: { (.+?) }/);
    message = match 
        ? `字段 '${match[2]}' 的值已存在。` 
        : '数据重复，无法保存。';
    details = (err as any).keyValue;
  }
  // Handle other potential errors (e.g., JSON parsing error from express.json())
  else if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
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