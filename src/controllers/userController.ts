import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { userService } from '../services/user.service';
import { UnauthorizedError } from '../utils/errors';

export default class UserController {
  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('请先登录'));
      }
      
      const userData = await userService.getUserById(req.user.id);
      
      res.json({
        success: true,
        data: userData
      });
    } catch (error) {
      next(error);
    }
  }
  
  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('请先登录'));
      }
      
      const userData = await userService.updateUser(req.user.id, req.body);
      
      res.json({
        success: true,
        data: userData
      });
    } catch (error) {
      next(error);
    }
  }
  
  async changePassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('请先登录'));
      }
      
      const result = await userService.changePassword(req.user.id, req.body);
      
      res.json({
        success: true,
        message: '密码修改成功'
      });
    } catch (error) {
      next(error);
    }
  }
} 