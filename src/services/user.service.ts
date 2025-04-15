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
  ForbiddenError,
  AppError
} from '../utils/errors';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { validateId, validateEntityExists } from '../utils/errorHandler';
import bcrypt from 'bcryptjs';
import { handleServiceError } from '../utils/errorHandler';
import mongoose from 'mongoose';

interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    fullName?: string;
  };
}

// Options for filtering users
export interface GetUsersOptions {
  role?: string;
  // Add other potential filters: search, pagination etc.
}

export class UserService {
  private serviceName = 'UserService';

  /**
   * 用户注册
   */
  async registerUser(data: RegisterUserDto): Promise<IUser> {
    const methodName = 'registerUser';
    try {
      // 检查用户名和邮箱是否已被注册
      const existingUser = await User.findOne({ 
        $or: [{ username: data.username }, { email: data.email }] 
      });
      
      if (existingUser) {
        throw new ConflictError('用户名或邮箱已被注册');
      }
      
      // 创建新用户
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await User.create({
        username: data.username,
        email: data.email,
        password: hashedPassword,
        role: data.role || UserRole.TRANSLATOR,
        active: true
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
        role: user.role,
        fullName: user.fullName
      };
      
      logger.info(`User registered: ${user._id}`);
      // const userToReturn = user.toObject();
      // delete userToReturn.password;
      // Return the Mongoose document itself
      return user;
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      if ((error as any).code === 11000) {
        throw new ConflictError('用户名或邮箱已被注册');
      }
      throw handleServiceError(error, this.serviceName, methodName, '用户注册');
    }
  }

  /**
   * 用户登录
   */
  async loginUser(data: LoginUserDto): Promise<LoginResponse> {
    const methodName = 'loginUser';
    try {
      // 查找用户
      logger.debug(`[${methodName}] Attempting to find user with email: ${data.email}`);
      // Find user, explicitly requesting password
      const user = await User.findOne({ email: data.email }).select('+password').exec(); 
      
      // --- Separate Checks --- 
      if (!user) { // First, check if user was found at all
        logger.warn(`[${methodName}] User not found for email: ${data.email}`);
        throw new UnauthorizedError('邮箱或密码不正确 (User not found)'); // More specific error internally
      } 
      logger.debug(`[${methodName}] User found. ID: ${user._id}. Checking password field...`);

      if (!user.password) { // Then, check if password field exists on the found user
        logger.error(`[${methodName}] Password field missing from user object despite using .select('+password')! User ID: ${user._id}`);
        throw new AppError('Internal server error during login (password field missing).', 500); // Indicate internal issue
      }
      // ----------------------
      
      // --- More Detailed Password Comparison Logging --- 
      const providedPassword = data.password;
      const storedHash = user.password; // Now we know user and user.password exist
      logger.debug(`[${methodName}] Comparing Provided Password: [${providedPassword}] (Length: ${providedPassword?.length})`);
      logger.debug(`[${methodName}] With Stored Hash: [${storedHash}] (Length: ${storedHash?.length})`);
      
      const isPasswordValid = await bcrypt.compare(providedPassword, storedHash);
      logger.debug(`[${methodName}] Password comparison result (isPasswordValid): ${isPasswordValid}`); 
      // ------------------------------------------
      
      if (!isPasswordValid) {
        logger.warn(`[${methodName}] Password validation failed for user ${user._id}.`);
        throw new UnauthorizedError('邮箱或密码不正确');
      }
      
      // 检查用户是否被禁用
      if (!user.active) {
        throw new UnauthorizedError('用户账号已被禁用');
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
        role: user.role,
        fullName: user.fullName
      };
      
      logger.info(`User logged in: ${user._id}`);
      return { token, user: userData };
    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      // 不要在登录失败时暴露具体的内部错误
      if (error instanceof UnauthorizedError || error instanceof ValidationError) {
        throw error; // 重新抛出已知的认证或验证错误
      }
      // 为其他错误抛出通用错误
      throw new UnauthorizedError('登录失败，请稍后重试');
    }
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
    const methodName = 'changePassword';
    validateId(userId, '用户');
    if (!data.currentPassword || !data.newPassword) {
        throw new ValidationError('当前密码和新密码不能为空');
    }
    if (data.newPassword.length < 6) {
        throw new ValidationError('新密码长度不能小于6位');
    }
    
    try {
        // Fetch user including password
        const user = await User.findById(userId).select('+password');
        if (!user || !user.password) {
          throw new NotFoundError('用户不存在或无法验证密码');
        }
        
        // Compare password using bcrypt directly
        const isPasswordValid = await bcrypt.compare(data.currentPassword, user.password);
        if (!isPasswordValid) {
          throw new UnauthorizedError('当前密码不正确');
        }
        
        // Hash and save new password
        user.password = await bcrypt.hash(data.newPassword, 10);
        await user.save();
        
        logger.info(`Password changed for user: ${userId}`);
        return { success: true };
    } catch (error) {
         logger.error(`Error in ${this.serviceName}.${methodName} for user ${userId}:`, error);
         throw handleServiceError(error, this.serviceName, methodName, '修改密码');
    }
  }

  /**
   * Get a list of users, optionally filtered.
   * @param options - Filtering options.
   */
  async getUsers(options: GetUsersOptions = {}): Promise<IUser[]> {
    const methodName = 'getUsers';
    const { role } = options;

    try {
      const query: mongoose.FilterQuery<IUser> = {};

      if (role) {
        query.role = role;
      }

      // Exclude password field from results
      const users = await User.find(query).select('-password').exec();
      logger.info(`Fetched ${users.length} users with filter: ${JSON.stringify(options)}`);
      return users;

    } catch (error) {
      logger.error(`Error in ${this.serviceName}.${methodName}:`, error);
      throw handleServiceError(error, this.serviceName, methodName, '获取用户列表');
    }
  }
}

export const userService = new UserService(); 