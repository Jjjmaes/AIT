// ===== 第三步：创建身份验证中间件 =====
// src/middleware/auth.middleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import { UnauthorizedError } from '../utils/errors';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
}

export const authenticateJwt = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('未提供身份验证令牌');
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string };

    const user = await User.findById(payload.sub).select('-password');
    if (!user) {
      throw new UnauthorizedError('无效的令牌');
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      role: user.role
    };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('无效的令牌'));
    } else {
      next(new UnauthorizedError('身份验证失败'));
    }
  }
};

// 角色授权中间件
export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('请先登录'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new UnauthorizedError('您没有权限访问此资源'));
    }

    next();
  };
};