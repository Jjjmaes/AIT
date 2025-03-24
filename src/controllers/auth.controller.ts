// ===== 第八步：创建身份验证控制器 =====
// src/controllers/auth.controller.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import User from '../models/user.model';
import { ApiError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';

// 注册新用户
const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, password } = req.body;
    
    // 检查用户是否已存在
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return next(new ApiError(409, '用户名或邮箱已被注册'));
    }
    
    // 创建新用户
    const user = await User.create({
      username,
      email,
      password, // 密码会在模型的pre-save钩子中自动加密
    });
    
    // 生成JWT令牌
    const token = jwt.sign(
      { sub: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );
    
    // 移除密码后返回用户数据
    const userData = {
      id: user._id,
      email: user.email,
      username: user.username
    };
    
    res.status(201).json({
      success: true,
      token,
      user: userData
    });
  } catch (error) {
    next(error);
  }
};

// 用户登录
const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    
    // 查找用户并验证密码
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return next(new ApiError(401, '邮箱或密码不正确'));
    }
    
    // 生成JWT令牌
    const token = jwt.sign(
      { sub: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );
    
    // 移除密码后返回用户数据
    const userData = {
      id: user._id,
      email: user.email,
      username: user.username
    };
    
    res.status(200).json({
      success: true,
      token,
      user: userData
    });
  } catch (error) {
    next(error);
  }
};

// 获取当前用户信息
const getCurrentUser = (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '请先登录'
    });
  }

  const userData = {
    id: req.user.id,
    email: req.user.email,
    username: req.user.username,
    role: req.user.role
  };

  res.status(200).json({
    success: true,
    data: userData
  });
};

// 用户登出（仅在客户端实现，这里仅作为API端点）
const logout = (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: '用户已登出'
  });
};

// 更新用户信息
const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new ApiError(401, '请先登录'));
    }

    const userId = req.user.id;
    const { username, email, role } = req.body;

    // 检查邮箱是否已被其他用户使用
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return next(new ApiError(409, '该邮箱已被其他用户使用'));
      }
    }

    // 更新用户信息
    const user = await User.findByIdAndUpdate(
      userId,
      { username, email, role },
      { new: true, runValidators: true }
    );

    if (!user) {
      return next(new ApiError(404, '用户不存在'));
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// 修改密码
const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new ApiError(401, '请先登录'));
    }

    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // 获取用户并验证当前密码
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return next(new ApiError(404, '用户不存在'));
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return next(new ApiError(401, '当前密码不正确'));
    }

    // 更新密码
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    next(error);
  }
};

export default {
  register,
  login,
  getCurrentUser,
  logout,
  updateProfile,
  changePassword
}; 