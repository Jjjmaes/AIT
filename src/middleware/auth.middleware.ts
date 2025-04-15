// ===== 第三步：创建身份验证中间件 =====
// src/middleware/auth.middleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import { UnauthorizedError } from '../utils/errors';
import logger from '../utils/logger';

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
  logger.debug('Attempting JWT authentication...');
  try {
    const authHeader = req.headers.authorization;
    logger.debug('Authorization Header:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('No Bearer token found in Authorization header.');
      throw new UnauthorizedError('未提供身份验证令牌');
    }

    const token = authHeader.split(' ')[1];
    logger.debug('Extracted Token:', token ? `${token.substring(0, 10)}...` : 'null');
    
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET is not defined in environment variables!');
      throw new Error('JWT Secret not configured');
    }

    // Define the expected payload interface based on how token is created
    interface JwtPayload {
      id: string;
      email: string;
      role: string;
      username: string;
      // Add iat and exp if needed, verify automatically handles them
      iat?: number;
      exp?: number;
    }

    // Verify the token and assert the new payload structure
    const payload = jwt.verify(token, jwtSecret) as JwtPayload;
    logger.debug('JWT Payload verified (new structure):', payload);

    // Use payload.id (from the new token structure) to find the user
    const user = await User.findById(payload.id).select('-password');
    if (!user) {
      logger.warn(`User not found for token id: ${payload.id}`);
      throw new UnauthorizedError('无效的令牌 - 用户不存在');
    }

    logger.info(`Authenticated user: ${user.username} (ID: ${user._id}, Role: ${user.role})`);
    // Populate req.user with verified data
    req.user = {
      id: user._id.toString(), // Use database ID for consistency
      email: user.email,
      username: user.username,
      role: user.role
    };
    next();
  } catch (error: any) {
    logger.error('JWT Authentication failed:', { 
        errorName: error.name, 
        errorMessage: error.message 
    });
    
    let finalError: Error;
    if (error instanceof jwt.TokenExpiredError) {
      finalError = new UnauthorizedError('身份验证令牌已过期');
    } else if (error instanceof jwt.JsonWebTokenError) {
      finalError = new UnauthorizedError('无效的令牌');
    } else if (error instanceof UnauthorizedError) {
      finalError = error;
    } else {
      finalError = new UnauthorizedError('身份验证失败');
    }
    logger.error(`[Auth Middleware] Passing error to next(): ${finalError.name} - ${finalError.message}`);
    next(finalError);
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