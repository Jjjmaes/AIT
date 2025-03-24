// ===== 第七步：创建请求验证中间件 =====
// src/middleware/validate.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ApiError } from './error.middleware';

export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const message = errors.array().map(err => `${err.msg}`).join(', ');
    return next(new ApiError(400, message));
  }
  
  next();
}; 