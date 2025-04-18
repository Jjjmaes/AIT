"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const auth_controller_1 = __importDefault(require("../../controllers/auth.controller"));
const user_service_1 = require("../../services/user.service");
const user_1 = require("../../types/user");
const errors_1 = require("../../utils/errors");
// 模拟依赖
jest.mock('../../services/user.service');
jest.mock('../../utils/logger');
describe('Auth Controller', () => {
    let mockRequest;
    let mockAuthRequest;
    let mockResponse;
    let mockNext;
    // 模拟用户数据
    const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        role: user_1.UserRole.TRANSLATOR
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
        const registerDto = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123'
        };
        it('should register a user successfully', async () => {
            mockRequest.body = registerDto;
            const mockUserResult = { _id: 'user123', ...registerDto };
            // Mock registerUser
            user_service_1.userService.registerUser.mockResolvedValue(mockUserResult);
            await auth_controller_1.default.register(mockRequest, mockResponse, mockNext);
            // Expect registerUser to be called
            expect(user_service_1.userService.registerUser).toHaveBeenCalledWith(registerDto);
            expect(mockResponse.status).toHaveBeenCalledWith(201);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                message: '用户注册成功',
                data: expect.objectContaining({ _id: 'user123' })
            });
        });
        it('should handle registration errors', async () => {
            mockRequest.body = registerDto;
            const error = new Error('Registration failed');
            // Mock registerUser
            user_service_1.userService.registerUser.mockRejectedValue(error);
            await auth_controller_1.default.register(mockRequest, mockResponse, mockNext);
            // Expect registerUser to be called
            expect(user_service_1.userService.registerUser).toHaveBeenCalledWith(registerDto);
            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
    describe('login', () => {
        const loginDto = {
            email: 'test@example.com',
            password: 'password123'
        };
        it('should log in a user successfully', async () => {
            mockRequest.body = loginDto;
            const mockLoginResponse = { token: 'jwttoken', user: { id: 'user123', email: loginDto.email } };
            // Mock loginUser
            user_service_1.userService.loginUser.mockResolvedValue(mockLoginResponse);
            await auth_controller_1.default.login(mockRequest, mockResponse, mockNext);
            // Expect loginUser to be called
            expect(user_service_1.userService.loginUser).toHaveBeenCalledWith(loginDto);
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                message: '登录成功',
                data: mockLoginResponse
            });
        });
        it('should handle login errors', async () => {
            mockRequest.body = loginDto;
            const error = new errors_1.UnauthorizedError('Invalid credentials');
            // Mock loginUser
            user_service_1.userService.loginUser.mockRejectedValue(error);
            await auth_controller_1.default.login(mockRequest, mockResponse, mockNext);
            // Expect loginUser to be called
            expect(user_service_1.userService.loginUser).toHaveBeenCalledWith(loginDto);
            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
    describe('getCurrentUser', () => {
        const mockUserData = {
            id: 'user123',
            username: 'testuser',
            email: 'test@example.com',
            role: user_1.UserRole.TRANSLATOR
        };
        it('should get current user successfully', async () => {
            mockAuthRequest = {
                user: mockUser
            };
            user_service_1.userService.getUserById.mockResolvedValue(mockUserData);
            await auth_controller_1.default.getCurrentUser(mockAuthRequest, mockResponse, mockNext);
            expect(user_service_1.userService.getUserById).toHaveBeenCalledWith('user123');
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: mockUserData
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
        it('should return unauthorized error if no user in request', async () => {
            mockAuthRequest = {};
            await auth_controller_1.default.getCurrentUser(mockAuthRequest, mockResponse, mockNext);
            expect(user_service_1.userService.getUserById).not.toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
            expect(mockResponse.json).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledWith(expect.any(errors_1.UnauthorizedError));
        });
        it('should pass error to next middleware', async () => {
            mockAuthRequest = {
                user: mockUser
            };
            const error = new Error('获取用户失败');
            user_service_1.userService.getUserById.mockRejectedValue(error);
            await auth_controller_1.default.getCurrentUser(mockAuthRequest, mockResponse, mockNext);
            expect(user_service_1.userService.getUserById).toHaveBeenCalledWith('user123');
            expect(mockResponse.status).not.toHaveBeenCalled();
            expect(mockResponse.json).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
    describe('updateProfile', () => {
        const updateDto = {
            username: 'updateduser',
            email: 'updated@example.com'
        };
        const mockUpdatedUser = {
            id: 'user123',
            username: 'updateduser',
            email: 'updated@example.com',
            role: user_1.UserRole.TRANSLATOR
        };
        it('should update profile successfully', async () => {
            mockAuthRequest = {
                user: mockUser,
                body: updateDto
            };
            user_service_1.userService.updateUser.mockResolvedValue(mockUpdatedUser);
            await auth_controller_1.default.updateProfile(mockAuthRequest, mockResponse, mockNext);
            expect(user_service_1.userService.updateUser).toHaveBeenCalledWith('user123', updateDto);
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
            await auth_controller_1.default.updateProfile(mockAuthRequest, mockResponse, mockNext);
            expect(user_service_1.userService.updateUser).not.toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
            expect(mockResponse.json).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledWith(expect.any(errors_1.UnauthorizedError));
        });
        it('should pass error to next middleware', async () => {
            mockAuthRequest = {
                user: mockUser,
                body: updateDto
            };
            const error = new Error('更新用户失败');
            user_service_1.userService.updateUser.mockRejectedValue(error);
            await auth_controller_1.default.updateProfile(mockAuthRequest, mockResponse, mockNext);
            expect(user_service_1.userService.updateUser).toHaveBeenCalledWith('user123', updateDto);
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
            user_service_1.userService.changePassword.mockResolvedValue({ success: true });
            await auth_controller_1.default.changePassword(mockAuthRequest, mockResponse, mockNext);
            expect(user_service_1.userService.changePassword).toHaveBeenCalledWith('user123', passwordDto);
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
            await auth_controller_1.default.changePassword(mockAuthRequest, mockResponse, mockNext);
            expect(user_service_1.userService.changePassword).not.toHaveBeenCalled();
            expect(mockResponse.status).not.toHaveBeenCalled();
            expect(mockResponse.json).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledWith(expect.any(errors_1.UnauthorizedError));
        });
        it('should pass error to next middleware', async () => {
            mockAuthRequest = {
                user: mockUser,
                body: passwordDto
            };
            const error = new Error('修改密码失败');
            user_service_1.userService.changePassword.mockRejectedValue(error);
            await auth_controller_1.default.changePassword(mockAuthRequest, mockResponse, mockNext);
            expect(user_service_1.userService.changePassword).toHaveBeenCalledWith('user123', passwordDto);
            expect(mockResponse.status).not.toHaveBeenCalled();
            expect(mockResponse.json).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
});
