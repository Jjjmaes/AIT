import { Request, Response, NextFunction } from 'express';
import User from '../models/user.model';
import { AuthRequest } from '../middleware/auth.middleware';

export default class UserController {
  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await User.findById(req.user?.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }
      
      const userData = {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role
      };
      
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
      const user = await User.findById(req.user?.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }
      
      const { username, email } = req.body;
      
      if (username) user.username = username;
      if (email) user.email = email;
      
      await user.save();
      
      const userData = {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role
      };
      
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
      const user = await User.findById(req.user?.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在'
        });
      }
      
      const { currentPassword, newPassword } = req.body;
      
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: '当前密码错误'
        });
      }
      
      user.password = newPassword;
      await user.save();
      
      res.json({
        success: true,
        message: '密码修改成功'
      });
    } catch (error) {
      next(error);
    }
  }
} 