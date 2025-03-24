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
    console.log('开始身份验证');
    const authHeader = req.headers.authorization;
    console.log('Authorization header:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('未提供有效的Authorization header');
      throw new UnauthorizedError('未提供身份验证令牌');
    }

    const token = authHeader.split(' ')[1];
    console.log('提取的token:', token.substring(0, 20) + '...');

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string };
    console.log('JWT验证成功，用户ID:', payload.sub);

    const user = await User.findById(payload.sub).select('-password');
    if (!user) {
      console.log('未找到用户:', payload.sub);
      throw new UnauthorizedError('无效的令牌');
    }

    console.log('用户验证成功:', user.email);
    req.user = {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      role: user.role
    };
    next();
  } catch (error) {
    console.error('身份验证失败:', error);
    next(new UnauthorizedError('身份验证失败'));
  }
};

// 角色授权中间件
export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    console.log('开始角色验证');
    console.log('用户角色:', req.user?.role);
    console.log('所需角色:', roles);

    if (!req.user) {
      console.log('未找到用户信息');
      return next(new UnauthorizedError('请先登录'));
    }

    if (!roles.includes(req.user.role)) {
      console.log('用户角色不匹配');
      return next(
        new UnauthorizedError('您没有权限访问此资源')
      );
    }

    console.log('角色验证通过');
    next();
  };
};