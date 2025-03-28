import { Types } from 'mongoose';
import User, { IUser } from '../models/user.model';
import { 
  RegisterUserDto, 
  UpdateUserDto, 
  ChangePasswordDto,
  LoginUserDto,
  UserRole
} from '../types/user';
import { 
  ValidationError, 
  NotFoundError, 
  ConflictError, 
  UnauthorizedError,
  ForbiddenError
} from '../utils/errors';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { validateId, validateEntityExists } from '../utils/errorHandler';

export class UserService {
  /**
   * 用户注册
   */
  async register(data: RegisterUserDto) {
    try {
      // 检查用户名和邮箱是否已被注册
      const existingUser = await User.findOne({ 
        $or: [{ username: data.username }, { email: data.email }] 
      });
      
      if (existingUser) {
        throw new ConflictError('用户名或邮箱已被注册');
      }
      
      // 创建新用户
      const user = await User.create({
        username: data.username,
        email: data.email,
        password: data.password,
        role: data.role || UserRole.TRANSLATOR
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
        username: user.username,
        role: user.role
      };
      
      logger.info(`User registered: ${user._id}`);
      return { token, user: userData };
    } catch (error) {
      if ((error as any).code === 11000) {
        throw new ConflictError('用户名或邮箱已被注册');
      }
      throw error;
    }
  }

  /**
   * 用户登录
   */
  async login(data: LoginUserDto) {
    // 查找用户
    const user = await User.findOne({ email: data.email });
    if (!user) {
      throw new UnauthorizedError('邮箱或密码不正确');
    }
    
    // 验证密码
    const isPasswordValid = await user.comparePassword(data.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('邮箱或密码不正确');
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
      username: user.username,
      role: user.role
    };
    
    logger.info(`User logged in: ${user._id}`);
    return { token, user: userData };
  }

  /**
   * 获取用户详情
   */
  async getUserById(userId: string) {
    validateId(userId, '用户');
    
    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw new NotFoundError('用户不存在');
    }
    
    return {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status
    };
  }

  /**
   * 更新用户信息
   */
  async updateUser(userId: string, updateData: UpdateUserDto) {
    validateId(userId, '用户');
    
    // 检查邮箱是否已被其他用户使用
    if (updateData.email) {
      const existingUser = await User.findOne({ 
        email: updateData.email, 
        _id: { $ne: new Types.ObjectId(userId) } 
      });
      
      if (existingUser) {
        throw new ConflictError('该邮箱已被其他用户使用');
      }
    }
    
    // 更新用户信息
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      throw new NotFoundError('用户不存在');
    }
    
    logger.info(`User updated: ${userId}`);
    return {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status
    };
  }

  /**
   * 修改密码
   */
  async changePassword(userId: string, data: ChangePasswordDto) {
    validateId(userId, '用户');
    
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }
    
    const isPasswordValid = await user.comparePassword(data.currentPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedError('当前密码不正确');
    }
    
    user.password = data.newPassword;
    await user.save();
    
    logger.info(`Password changed for user: ${userId}`);
    return { success: true };
  }
}

export const userService = new UserService(); 