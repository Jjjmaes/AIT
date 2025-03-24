import { Request, Response } from 'express';
import User from '../models/user.model';
import { validateUser } from '../validators/userValidator';
import { hashPassword } from '../utils/auth';
import { AuthRequest } from '../middleware/auth.middleware';

export const register = async (req: Request, res: Response) => {
  try {
    console.log('注册请求开始:', req.body);
    const { error } = validateUser(req.body);
    if (error) {
      console.log('验证错误:', error.details[0].message);
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const { email, password, username } = req.body;
    console.log('检查用户是否已存在:', email);
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('用户已存在:', email);
      return res.status(400).json({ success: false, message: '该邮箱已被注册' });
    }

    console.log('创建新用户:', email);
    const hashedPassword = await hashPassword(password);
    const user = new User({
      email,
      password: hashedPassword,
      username
    });

    await user.save();
    console.log('用户创建成功:', email);

    res.status(201).json({
      success: true,
      message: '注册成功',
      user: {
        id: user._id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    console.error('注册过程出错:', error);
    res.status(500).json({ success: false, message: '注册失败' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    console.log('获取用户信息请求开始');
    console.log('用户ID:', req.user?.id);
    
    if (!req.user?.id) {
      console.log('未找到用户ID');
      return res.status(401).json({ success: false, message: '未授权' });
    }

    console.log('查询用户信息:', req.user.id);
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      console.log('未找到用户');
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    console.log('用户信息查询成功:', user.email);
    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ success: false, message: '获取用户信息失败' });
  }
}; 