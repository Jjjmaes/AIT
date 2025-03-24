import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { IUser } from '../models/user.model';

// JWT配置
export const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// 生成JWT令牌
export const generateToken = (user: IUser): string => {
  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role
  };

  return jwt.sign(
    payload,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// 验证JWT令牌
export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// 从请求中提取令牌
export const extractTokenFromRequest = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // 去除'Bearer '前缀
  }
  
  return null;
};