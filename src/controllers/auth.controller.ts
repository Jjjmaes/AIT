// ===== 第八步：创建身份验证控制器 =====
// src/controllers/auth.controller.ts

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { userService } from '../services/user.service';
import { RegisterUserDto, LoginUserDto } from '../types/user';
import { UnauthorizedError } from '../utils/errors';

// 注册新用户
const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const registerData: RegisterUserDto = req.body;
    const result = await userService.register(registerData);
    
    res.status(201).json({
      success: true,
      token: result.token,
      user: result.user
    });
  } catch (error) {
    next(error);
  }
};

// 用户登录
const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const loginData: LoginUserDto = req.body;
    const result = await userService.login(loginData);
    
    res.status(200).json({
      success: true,
      token: result.token,
      user: result.user
    });
  } catch (error) {
    next(error);
  }
};

// 获取当前用户信息
const getCurrentUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError('请先登录'));
    }

    const userData = await userService.getUserById(req.user.id);

    res.status(200).json({
      success: true,
      data: userData
    });
  } catch (error) {
    next(error);
  }
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
      return next(new UnauthorizedError('请先登录'));
    }

    const userId = req.user.id;
    const userData = await userService.updateUser(userId, req.body);

    res.status(200).json({
      success: true,
      data: userData
    });
  } catch (error) {
    next(error);
  }
};

// 修改密码
const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError('请先登录'));
    }

    const result = await userService.changePassword(req.user.id, req.body);

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