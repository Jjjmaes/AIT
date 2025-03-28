import { Request, Response, NextFunction } from 'express';
import authController from '../../controllers/auth.controller';
import { userService } from '../../services/user.service';
import { 
  RegisterUserDto, 
  LoginUserDto, 
  UpdateUserDto, 
  UserRole 
} from '../../types/user';
import { UnauthorizedError } from '../../utils/errors';
import logger from '../../utils/logger';
import { AuthRequest } from '../../middleware/auth.middleware';

// 模拟依赖
jest.mock('../../services/user.service');
jest.mock('../../utils/logger');

describe('Auth Controller', () => {
  let mockRequest: Partial<Request>;
  let mockAuthRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock<NextFunction>;
  
  // 模拟用户数据
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    username: 'testuser',
    role: UserRole.TRANSLATOR
  };

  // 重置请求和响应对象
  beforeEach(() => {
    mockRequest = {
      body: {}
    };
    
    mockAuthRequest = {
      body: {},
      user: mockUser
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    mockNext = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterUserDto = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    };
    
    const mockUserResult = {
      token: 'test-token',
      user: {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        role: UserRole.TRANSLATOR
      }
    };

    it('should register user successfully', async () => {
      mockRequest.body = registerDto;
      (userService.register as jest.Mock).mockResolvedValue(mockUserResult);
      
      await authController.register(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(userService.register).toHaveBeenCalledWith(registerDto);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        token: mockUserResult.token,
        user: mockUserResult.user
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass error to next middleware', async () => {
      mockRequest.body = registerDto;
      const error = new Error('注册失败');
      (userService.register as jest.Mock).mockRejectedValue(error);
      
      await authController.register(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(userService.register).toHaveBeenCalledWith(registerDto);
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('login', () => {
    const loginDto: LoginUserDto = {
      email: 'test@example.com',
      password: 'password123'
    };
    
    const mockUserResult = {
      token: 'test-token',
      user: {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        role: UserRole.TRANSLATOR
      }
    };

    it('should login user successfully', async () => {
      mockRequest.body = loginDto;
      (userService.login as jest.Mock).mockResolvedValue(mockUserResult);
      
      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(userService.login).toHaveBeenCalledWith(loginDto);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        token: mockUserResult.token,
        user: mockUserResult.user
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass error to next middleware', async () => {
      mockRequest.body = loginDto;
      const error = new Error('登录失败');
      (userService.login as jest.Mock).mockRejectedValue(error);
      
      await authController.login(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(userService.login).toHaveBeenCalledWith(loginDto);
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getCurrentUser', () => {
    const mockUserData = {
      id: 'user123',
      username: 'testuser',
      email: 'test@example.com',
      role: UserRole.TRANSLATOR
    };

    it('should get current user successfully', async () => {
      mockAuthRequest = {
        user: mockUser
      };
      (userService.getUserById as jest.Mock).mockResolvedValue(mockUserData);
      
      await authController.getCurrentUser(mockAuthRequest as AuthRequest, mockResponse as Response, mockNext);
      
      expect(userService.getUserById).toHaveBeenCalledWith('user123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockUserData
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return unauthorized error if no user in request', async () => {
      mockAuthRequest = {};
      
      await authController.getCurrentUser(mockAuthRequest as AuthRequest, mockResponse as Response, mockNext);
      
      expect(userService.getUserById).not.toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should pass error to next middleware', async () => {
      mockAuthRequest = {
        user: mockUser
      };
      const error = new Error('获取用户失败');
      (userService.getUserById as jest.Mock).mockRejectedValue(error);
      
      await authController.getCurrentUser(mockAuthRequest as AuthRequest, mockResponse as Response, mockNext);
      
      expect(userService.getUserById).toHaveBeenCalledWith('user123');
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateProfile', () => {
    const updateDto: UpdateUserDto = {
      username: 'updateduser',
      email: 'updated@example.com'
    };
    
    const mockUpdatedUser = {
      id: 'user123',
      username: 'updateduser',
      email: 'updated@example.com',
      role: UserRole.TRANSLATOR
    };

    it('should update profile successfully', async () => {
      mockAuthRequest = {
        user: mockUser,
        body: updateDto
      };
      (userService.updateUser as jest.Mock).mockResolvedValue(mockUpdatedUser);
      
      await authController.updateProfile(mockAuthRequest as AuthRequest, mockResponse as Response, mockNext);
      
      expect(userService.updateUser).toHaveBeenCalledWith('user123', updateDto);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedUser
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return unauthorized error if no user in request', async () => {
      mockAuthRequest = {
        body: updateDto
      };
      
      await authController.updateProfile(mockAuthRequest as AuthRequest, mockResponse as Response, mockNext);
      
      expect(userService.updateUser).not.toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should pass error to next middleware', async () => {
      mockAuthRequest = {
        user: mockUser,
        body: updateDto
      };
      const error = new Error('更新用户失败');
      (userService.updateUser as jest.Mock).mockRejectedValue(error);
      
      await authController.updateProfile(mockAuthRequest as AuthRequest, mockResponse as Response, mockNext);
      
      expect(userService.updateUser).toHaveBeenCalledWith('user123', updateDto);
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('changePassword', () => {
    const passwordDto = {
      currentPassword: 'oldpassword',
      newPassword: 'newpassword'
    };

    it('should change password successfully', async () => {
      mockAuthRequest = {
        user: mockUser,
        body: passwordDto
      };
      (userService.changePassword as jest.Mock).mockResolvedValue({ success: true });
      
      await authController.changePassword(mockAuthRequest as AuthRequest, mockResponse as Response, mockNext);
      
      expect(userService.changePassword).toHaveBeenCalledWith('user123', passwordDto);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: '密码修改成功'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return unauthorized error if no user in request', async () => {
      mockAuthRequest = {
        body: passwordDto
      };
      
      await authController.changePassword(mockAuthRequest as AuthRequest, mockResponse as Response, mockNext);
      
      expect(userService.changePassword).not.toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should pass error to next middleware', async () => {
      mockAuthRequest = {
        user: mockUser,
        body: passwordDto
      };
      const error = new Error('修改密码失败');
      (userService.changePassword as jest.Mock).mockRejectedValue(error);
      
      await authController.changePassword(mockAuthRequest as AuthRequest, mockResponse as Response, mockNext);
      
      expect(userService.changePassword).toHaveBeenCalledWith('user123', passwordDto);
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
}); 