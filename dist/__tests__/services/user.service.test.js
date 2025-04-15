"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const user_service_1 = require("../../services/user.service");
const user_model_1 = __importDefault(require("../../models/user.model"));
const user_1 = require("../../types/user");
const errors_1 = require("../../utils/errors");
const mongoose_1 = __importDefault(require("mongoose"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
// 模拟依赖
jest.mock('../../models/user.model');
jest.mock('../../utils/logger');
jest.mock('jsonwebtoken');
jest.mock('bcrypt');
describe('UserService', () => {
    let userService;
    // 测试数据
    const mockUserId = new mongoose_1.default.Types.ObjectId().toString();
    const mockUser = {
        _id: mockUserId,
        username: 'testuser',
        email: 'test@example.com',
        role: user_1.UserRole.TRANSLATOR,
        comparePassword: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({
            _id: mockUserId,
            username: 'testuser',
            email: 'test@example.com',
            role: user_1.UserRole.TRANSLATOR
        })
    };
    beforeEach(() => {
        userService = new user_service_1.UserService();
        jest.clearAllMocks();
    });
    describe('registerUser', () => {
        const registerDto = {
            username: 'newuser',
            email: 'new@example.com',
            password: 'password123'
        };
        it('should register a user successfully', async () => {
            // Mock dependencies
            user_model_1.default.findOne.mockResolvedValue(null);
            user_model_1.default.create.mockResolvedValue(mockUser);
            jsonwebtoken_1.default.sign.mockReturnValue('mockToken');
            // Call the service method
            const result = await userService.registerUser(registerDto);
            // Assertions
            expect(user_model_1.default.findOne).toHaveBeenCalledWith({ $or: [{ username: registerDto.username }, { email: registerDto.email }] });
            expect(user_model_1.default.create).toHaveBeenCalled();
            expect(jsonwebtoken_1.default.sign).toHaveBeenCalled();
            expect(result).toBeDefined();
            expect(result.email).toBe(registerDto.email);
            // Ensure password is not returned
            expect(result).not.toHaveProperty('password');
        });
        it('should throw ConflictError if user already exists', async () => {
            user_model_1.default.findOne.mockResolvedValue(mockUser);
            // Expect registerUser to throw
            await expect(userService.registerUser(registerDto)).rejects.toThrow(errors_1.ConflictError);
        });
        it('should re-throw ConflictError for duplicate key errors', async () => {
            const error = new Error('Duplicate key');
            error.code = 11000;
            user_model_1.default.findOne.mockResolvedValue(null);
            user_model_1.default.create.mockRejectedValue(error);
            // Expect registerUser to throw
            await expect(userService.registerUser(registerDto)).rejects.toThrow(errors_1.ConflictError);
        });
    });
    describe('loginUser', () => {
        const loginDto = {
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
            user_model_1.default.findOne.mockReturnValue(selectMock);
            bcrypt_1.default.compare.mockResolvedValue(true);
            jsonwebtoken_1.default.sign.mockReturnValue('mockToken');
            // Call the service method
            const result = await userService.loginUser(loginDto);
            // Assertions
            expect(user_model_1.default.findOne).toHaveBeenCalledWith({ email: loginDto.email });
            expect(selectMock.select).toHaveBeenCalledWith('+password');
            // Compare against the password in the mock object
            expect(bcrypt_1.default.compare).toHaveBeenCalledWith(loginDto.password, mockUserWithPassword.password);
            expect(jsonwebtoken_1.default.sign).toHaveBeenCalled();
            expect(result).toBeDefined();
            expect(result.token).toBe('mockToken');
            expect(result.user.email).toBe(loginDto.email);
        });
        it('should throw UnauthorizedError if user not found', async () => {
            const selectMock = { select: jest.fn().mockResolvedValue(null) };
            user_model_1.default.findOne.mockReturnValue(selectMock);
            // Expect loginUser to throw
            await expect(userService.loginUser(loginDto)).rejects.toThrow(errors_1.UnauthorizedError);
        });
        it('should throw UnauthorizedError if password is invalid', async () => {
            const selectMock = { select: jest.fn().mockResolvedValue(mockUserWithPassword) };
            user_model_1.default.findOne.mockReturnValue(selectMock);
            bcrypt_1.default.compare.mockResolvedValue(false);
            // Expect loginUser to throw
            await expect(userService.loginUser(loginDto)).rejects.toThrow(errors_1.UnauthorizedError);
        });
    });
    describe('getUserById', () => {
        it('should get user by ID successfully', async () => {
            // 模拟User.findById方法
            user_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockUser)
            });
            const result = await userService.getUserById(mockUserId);
            expect(user_model_1.default.findById).toHaveBeenCalledWith(mockUserId);
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('email', mockUser.email);
            expect(result).toHaveProperty('username', mockUser.username);
        });
        it('should throw NotFoundError if user not found', async () => {
            // 模拟User.findById方法返回null
            user_model_1.default.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(null)
            });
            await expect(userService.getUserById(mockUserId)).rejects.toThrow(errors_1.NotFoundError);
            expect(user_model_1.default.findById).toHaveBeenCalledWith(mockUserId);
        });
    });
    describe('updateUser', () => {
        const updateDto = {
            username: 'updatedname',
            email: 'updated@example.com'
        };
        it('should update user successfully', async () => {
            // 模拟User.findOne方法（检查邮箱是否被使用）
            user_model_1.default.findOne.mockResolvedValue(null);
            // 模拟User.findByIdAndUpdate方法
            const updatedUser = {
                ...mockUser,
                username: updateDto.username,
                email: updateDto.email
            };
            user_model_1.default.findByIdAndUpdate.mockReturnValue({
                select: jest.fn().mockResolvedValue(updatedUser)
            });
            const result = await userService.updateUser(mockUserId, updateDto);
            expect(user_model_1.default.findOne).toHaveBeenCalled();
            expect(user_model_1.default.findByIdAndUpdate).toHaveBeenCalledWith(mockUserId, updateDto, { new: true, runValidators: true });
            expect(result).toHaveProperty('username', updateDto.username);
            expect(result).toHaveProperty('email', updateDto.email);
        });
        it('should throw ConflictError if email is already in use', async () => {
            // 模拟User.findOne方法返回已存在的用户
            user_model_1.default.findOne.mockResolvedValue(mockUser);
            await expect(userService.updateUser(mockUserId, updateDto)).rejects.toThrow(errors_1.ConflictError);
            expect(user_model_1.default.findOne).toHaveBeenCalled();
            expect(user_model_1.default.findByIdAndUpdate).not.toHaveBeenCalled();
        });
        it('should throw NotFoundError if user not found', async () => {
            // 模拟User.findOne方法（检查邮箱是否被使用）
            user_model_1.default.findOne.mockResolvedValue(null);
            // 模拟User.findByIdAndUpdate方法返回null
            user_model_1.default.findByIdAndUpdate.mockReturnValue({
                select: jest.fn().mockResolvedValue(null)
            });
            await expect(userService.updateUser(mockUserId, updateDto)).rejects.toThrow(errors_1.NotFoundError);
            expect(user_model_1.default.findByIdAndUpdate).toHaveBeenCalled();
        });
    });
    describe('changePassword', () => {
        const passwordDto = {
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
                role: user_1.UserRole.TRANSLATOR,
                password: 'oldpassword',
                comparePassword: mockComparePassword,
                save: mockSave
            };
            user_model_1.default.findById.mockResolvedValue(mockUserWithMethods);
            const result = await userService.changePassword(mockUserId, passwordDto);
            expect(user_model_1.default.findById).toHaveBeenCalledWith(mockUserId);
            expect(mockComparePassword).toHaveBeenCalledWith(passwordDto.currentPassword);
            expect(mockSave).toHaveBeenCalled();
            expect(mockUserWithMethods.password).toBe(passwordDto.newPassword);
            expect(result).toHaveProperty('success', true);
        });
        it('should throw NotFoundError if user not found', async () => {
            // 模拟User.findById方法返回null
            user_model_1.default.findById.mockResolvedValue(null);
            await expect(userService.changePassword(mockUserId, passwordDto)).rejects.toThrow(errors_1.NotFoundError);
            expect(user_model_1.default.findById).toHaveBeenCalledWith(mockUserId);
        });
        it('should throw UnauthorizedError if current password is incorrect', async () => {
            const mockComparePassword = jest.fn().mockResolvedValue(false);
            // 模拟User.findById方法
            user_model_1.default.findById.mockResolvedValue({
                _id: mockUserId,
                username: 'testuser',
                email: 'test@example.com',
                role: user_1.UserRole.TRANSLATOR,
                comparePassword: mockComparePassword
            });
            await expect(userService.changePassword(mockUserId, passwordDto)).rejects.toThrow(errors_1.UnauthorizedError);
            expect(user_model_1.default.findById).toHaveBeenCalledWith(mockUserId);
            expect(mockComparePassword).toHaveBeenCalledWith(passwordDto.currentPassword);
        });
    });
});
