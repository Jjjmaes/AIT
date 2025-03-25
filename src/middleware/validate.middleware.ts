// ===== 第七步：创建请求验证中间件 =====
// src/middleware/validate.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from './error.middleware';

export const validate = (schema: AnyZodObject) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.errors.map(err => err.message).join(', ');
        return next(new ApiError(400, message));
      }
      next(error);
    }
  };
}; 