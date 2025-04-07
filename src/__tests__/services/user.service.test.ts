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
import bcrypt from 'bcrypt';

// 模拟依赖
jest.mock('../../models/user.model');
jest.mock('../../utils/logger');
jest.mock('jsonwebtoken');
jest.mock('bcrypt');

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

  describe('registerUser', () => {
    const registerDto: RegisterUserDto = {
      username: 'newuser',
      email: 'new@example.com',
      password: 'password123'
    };

    it('should register a user successfully', async () => {
      // Mock dependencies
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockResolvedValue(mockUser);
      (jwt.sign as jest.Mock).mockReturnValue('mockToken');

      // Call the service method
      const result = await userService.registerUser(registerDto);

      // Assertions
      expect(User.findOne).toHaveBeenCalledWith({ $or: [{ username: registerDto.username }, { email: registerDto.email }] });
      expect(User.create).toHaveBeenCalled();
      expect(jwt.sign).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.email).toBe(registerDto.email);
      // Ensure password is not returned
      expect(result).not.toHaveProperty('password'); 
    });

    it('should throw ConflictError if user already exists', async () => {
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);

      // Expect registerUser to throw
      await expect(userService.registerUser(registerDto)).rejects.toThrow(ConflictError);
    });

    it('should re-throw ConflictError for duplicate key errors', async () => {
      const error: any = new Error('Duplicate key');
      error.code = 11000;
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.create as jest.Mock).mockRejectedValue(error);
      
      // Expect registerUser to throw
      await expect(userService.registerUser(registerDto)).rejects.toThrow(ConflictError);
    });
  });

  describe('loginUser', () => {
    const loginDto: LoginUserDto = {
      email: 'test@example.com',
      password: 'password123'
    };

    // Define a mock user with password for login tests
    const mockUserWithPassword = {
        ...mockUser, // Include basic user details
        password: 'hashedpassword', // Add password field
        active: true, // Add active field as it's checked in loginUser
        select: jest.fn().mockReturnThis(), // Mock select method if called
        toObject: jest.fn().mockReturnThis() // Mock toObject if needed
    };

    it('should login a user successfully', async () => {
      // Mock dependencies
      const selectMock = { select: jest.fn().mockResolvedValue(mockUserWithPassword) };
      (User.findOne as jest.Mock).mockReturnValue(selectMock);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mockToken');

      // Call the service method
      const result = await userService.loginUser(loginDto);

      // Assertions
      expect(User.findOne).toHaveBeenCalledWith({ email: loginDto.email });
      expect(selectMock.select).toHaveBeenCalledWith('+password');
      // Compare against the password in the mock object
      expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUserWithPassword.password);
      expect(jwt.sign).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.token).toBe('mockToken');
      expect(result.user.email).toBe(loginDto.email);
    });

    it('should throw UnauthorizedError if user not found', async () => {
      const selectMock = { select: jest.fn().mockResolvedValue(null) };
      (User.findOne as jest.Mock).mockReturnValue(selectMock);

      // Expect loginUser to throw
      await expect(userService.loginUser(loginDto)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if password is invalid', async () => {
      const selectMock = { select: jest.fn().mockResolvedValue(mockUserWithPassword) };
      (User.findOne as jest.Mock).mockReturnValue(selectMock);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Expect loginUser to throw
      await expect(userService.loginUser(loginDto)).rejects.toThrow(UnauthorizedError);
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