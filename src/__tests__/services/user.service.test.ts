import { UserService } from '../../services/user.service';
import User from '../../models/user.model';
import { 
  RegisterUserDto, 
  LoginUserDto, 
  UpdateUserDto, 
  ChangePasswordDto,
  UserRole 
} from '../../types/user';
import { 
  ConflictError,
  NotFoundError,
  UnauthorizedError
} from '../../utils/errors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

// 模拟依赖
jest.mock('../../models/user.model');
jest.mock('../../utils/logger');
jest.mock('jsonwebtoken');

describe('UserService', () => {
  let userService: UserService;
  
  // 测试数据
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockUser = {
    _id: mockUserId,
    username: 'testuser',
    email: 'test@example.com',
    role: UserRole.TRANSLATOR,
    comparePassword: jest.fn(),
    save: jest.fn().mockResolvedValue(true),
    toObject: jest.fn().mockReturnValue({
      _id: mockUserId,
      username: 'testuser',
      email: 'test@example.com',
      role: UserRole.TRANSLATOR
    })
  };

  beforeEach(() => {
    userService = new UserService();
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterUserDto = {
      username: 'newuser',
      email: 'new@example.com',
      password: 'password123'
    };

    it('should register a new user successfully', async () => {
      // 模拟User.findOne方法
      (User.findOne as jest.Mock).mockResolvedValue(null);
      
      // 模拟User.create方法
      (User.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        _id: new mongoose.Types.ObjectId(),
        username: registerDto.username,
        email: registerDto.email
      });

      // 模拟jwt.sign方法
      (jwt.sign as jest.Mock).mockReturnValue('mock-token');

      const result = await userService.register(registerDto);

      expect(User.findOne).toHaveBeenCalledWith({
        $or: [{ username: registerDto.username }, { email: registerDto.email }]
      });
      expect(User.create).toHaveBeenCalledWith({
        username: registerDto.username,
        email: registerDto.email,
        password: registerDto.password,
        role: UserRole.TRANSLATOR
      });
      expect(jwt.sign).toHaveBeenCalled();
      expect(result).toHaveProperty('token', 'mock-token');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('username', registerDto.username);
      expect(result.user).toHaveProperty('email', registerDto.email);
    });

    it('should throw ConflictError if username or email is already taken', async () => {
      // 模拟User.findOne方法返回已存在的用户
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);

      await expect(userService.register(registerDto)).rejects.toThrow(ConflictError);
      expect(User.findOne).toHaveBeenCalled();
      expect(User.create).not.toHaveBeenCalled();
    });

    it('should handle MongoDB duplicate key error', async () => {
      // 模拟User.findOne方法
      (User.findOne as jest.Mock).mockResolvedValue(null);
      
      // 模拟User.create方法抛出重复键错误
      const duplicateError = new Error('Duplicate key error');
      (duplicateError as any).code = 11000;
      (User.create as jest.Mock).mockRejectedValue(duplicateError);

      await expect(userService.register(registerDto)).rejects.toThrow(ConflictError);
    });
  });

  describe('login', () => {
    const loginDto: LoginUserDto = {
      email: 'test@example.com',
      password: 'password123'
    };

    it('should login successfully with correct credentials', async () => {
      const mockComparePassword = jest.fn().mockResolvedValue(true);
      
      // 模拟User.findOne方法
      (User.findOne as jest.Mock).mockResolvedValue({
        _id: mockUserId,
        email: loginDto.email,
        username: 'testuser',
        role: UserRole.TRANSLATOR,
        comparePassword: mockComparePassword
      });
      
      // 模拟jwt.sign方法
      (jwt.sign as jest.Mock).mockReturnValue('mock-token');

      const result = await userService.login(loginDto);

      expect(User.findOne).toHaveBeenCalledWith({ email: loginDto.email });
      expect(mockComparePassword).toHaveBeenCalledWith(loginDto.password);
      expect(jwt.sign).toHaveBeenCalled();
      expect(result).toHaveProperty('token', 'mock-token');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('email', loginDto.email);
    });

    it('should throw UnauthorizedError if user not found', async () => {
      // 模拟User.findOne方法返回null
      (User.findOne as jest.Mock).mockResolvedValue(null);

      await expect(userService.login(loginDto)).rejects.toThrow(UnauthorizedError);
      expect(User.findOne).toHaveBeenCalled();
    });

    it('should throw UnauthorizedError if password is incorrect', async () => {
      const mockComparePassword = jest.fn().mockResolvedValue(false);
      
      // 模拟User.findOne方法
      (User.findOne as jest.Mock).mockResolvedValue({
        _id: mockUserId,
        email: loginDto.email,
        username: 'testuser',
        role: UserRole.TRANSLATOR,
        comparePassword: mockComparePassword
      });

      await expect(userService.login(loginDto)).rejects.toThrow(UnauthorizedError);
      expect(User.findOne).toHaveBeenCalled();
      expect(mockComparePassword).toHaveBeenCalledWith(loginDto.password);
    });
  });

  describe('getUserById', () => {
    it('should get user by ID successfully', async () => {
      // 模拟User.findById方法
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      const result = await userService.getUserById(mockUserId);

      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email', mockUser.email);
      expect(result).toHaveProperty('username', mockUser.username);
    });

    it('should throw NotFoundError if user not found', async () => {
      // 模拟User.findById方法返回null
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await expect(userService.getUserById(mockUserId)).rejects.toThrow(NotFoundError);
      expect(User.findById).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('updateUser', () => {
    const updateDto: UpdateUserDto = {
      username: 'updatedname',
      email: 'updated@example.com'
    };

    it('should update user successfully', async () => {
      // 模拟User.findOne方法（检查邮箱是否被使用）
      (User.findOne as jest.Mock).mockResolvedValue(null);
      
      // 模拟User.findByIdAndUpdate方法
      const updatedUser = {
        ...mockUser,
        username: updateDto.username,
        email: updateDto.email
      };
      (User.findByIdAndUpdate as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(updatedUser)
      });

      const result = await userService.updateUser(mockUserId, updateDto);

      expect(User.findOne).toHaveBeenCalled();
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUserId,
        updateDto,
        { new: true, runValidators: true }
      );
      expect(result).toHaveProperty('username', updateDto.username);
      expect(result).toHaveProperty('email', updateDto.email);
    });

    it('should throw ConflictError if email is already in use', async () => {
      // 模拟User.findOne方法返回已存在的用户
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);

      await expect(userService.updateUser(mockUserId, updateDto)).rejects.toThrow(ConflictError);
      expect(User.findOne).toHaveBeenCalled();
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError if user not found', async () => {
      // 模拟User.findOne方法（检查邮箱是否被使用）
      (User.findOne as jest.Mock).mockResolvedValue(null);
      
      // 模拟User.findByIdAndUpdate方法返回null
      (User.findByIdAndUpdate as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await expect(userService.updateUser(mockUserId, updateDto)).rejects.toThrow(NotFoundError);
      expect(User.findByIdAndUpdate).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const passwordDto: ChangePasswordDto = {
      currentPassword: 'oldpassword',
      newPassword: 'newpassword'
    };

    it('should change password successfully', async () => {
      const mockComparePassword = jest.fn().mockResolvedValue(true);
      const mockSave = jest.fn().mockResolvedValue(true);
      
      // 模拟User.findById方法
      const mockUserWithMethods = {
        _id: mockUserId,
        username: 'testuser',
        email: 'test@example.com',
        role: UserRole.TRANSLATOR,
        password: 'oldpassword',
        comparePassword: mockComparePassword,
        save: mockSave
      };
      
      (User.findById as jest.Mock).mockResolvedValue(mockUserWithMethods);

      const result = await userService.changePassword(mockUserId, passwordDto);

      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(mockComparePassword).toHaveBeenCalledWith(passwordDto.currentPassword);
      expect(mockSave).toHaveBeenCalled();
      expect(mockUserWithMethods.password).toBe(passwordDto.newPassword);
      expect(result).toHaveProperty('success', true);
    });

    it('should throw NotFoundError if user not found', async () => {
      // 模拟User.findById方法返回null
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(userService.changePassword(mockUserId, passwordDto)).rejects.toThrow(NotFoundError);
      expect(User.findById).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw UnauthorizedError if current password is incorrect', async () => {
      const mockComparePassword = jest.fn().mockResolvedValue(false);
      
      // 模拟User.findById方法
      (User.findById as jest.Mock).mockResolvedValue({
        _id: mockUserId,
        username: 'testuser',
        email: 'test@example.com',
        role: UserRole.TRANSLATOR,
        comparePassword: mockComparePassword
      });

      await expect(userService.changePassword(mockUserId, passwordDto)).rejects.toThrow(UnauthorizedError);
      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(mockComparePassword).toHaveBeenCalledWith(passwordDto.currentPassword);
    });
  });
}); 