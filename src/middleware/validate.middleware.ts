// ===== 第七步：创建请求验证中间件 =====
// src/middleware/validate.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';

export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Assume schema primarily validates the body for POST/PUT/PATCH
      // If validation needs query/params too, this needs adjustment based on schema structure
      await schema.parseAsync(req.body); 
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = JSON.stringify(error.flatten());
        next(new ValidationError(errorMessage));
      } else {
        next(error);
      }
    }
  };
}; 