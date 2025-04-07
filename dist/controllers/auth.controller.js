"use strict";
// ===== 第八步：创建身份验证控制器 =====
// src/controllers/auth.controller.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const user_service_1 = require("../services/user.service");
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
// Define AuthRequest locally if not imported
/*
interface AuthRequest extends Request {
  user?: { id: string; [key: string]: any };
}
*/
class AuthController {
    constructor() {
        this.serviceName = 'AuthController';
        // TODO: Add methods for password reset, email verification etc.
    }
    async register(req, res, next) {
        const methodName = 'register';
        // Optional: Input validation using express-validator or similar
        // const errors = validationResult(req);
        // if (!errors.isEmpty()) {
        //   return next(new ValidationError('输入验证失败', errors.array()));
        // }
        try {
            const userData = req.body;
            logger_1.default.info(`${this.serviceName}.${methodName} - Attempting registration for: ${userData.email}`);
            const newUser = await user_service_1.userService.registerUser(userData);
            // Exclude password from response
            const { password, ...userResponse } = newUser.toObject();
            res.status(201).json({
                success: true,
                message: '用户注册成功',
                data: userResponse
            });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error); // Pass to error handling middleware
        }
    }
    async login(req, res, next) {
        const methodName = 'login';
        // Optional: Input validation
        try {
            const loginData = req.body;
            logger_1.default.info(`${this.serviceName}.${methodName} - Attempting login for: ${loginData.email}`);
            const loginResponse = await user_service_1.userService.loginUser(loginData);
            res.status(200).json({
                success: true,
                message: '登录成功',
                data: loginResponse // Contains token and user info
            });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error); // Pass to error handling middleware
        }
    }
    // Optional: Get current user profile
    async getProfile(req, res, next) {
        const methodName = 'getProfile';
        try {
            const userId = req.user?.id;
            if (!userId) {
                return next(new errors_1.UnauthorizedError('认证失败，无法获取用户信息'));
            }
            // Fetch user details (excluding password) - userService method needed
            // const userProfile = await userService.getUserProfile(userId);
            // res.status(200).json({ success: true, data: userProfile });
            // For now, just return the user info from the token payload
            res.status(200).json({ success: true, data: req.user });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error);
        }
    }
    // Placeholder for logout
    async logout(req, res, next) {
        const methodName = 'logout';
        try {
            // In a stateless JWT setup, logout is typically handled client-side by deleting the token.
            // Server-side might involve blacklisting the token if using a blacklist strategy.
            logger_1.default.info(`${this.serviceName}.${methodName} - Logout requested.`);
            res.status(200).json({ success: true, message: '登出成功' });
        }
        catch (error) {
            logger_1.default.error(`Error in ${this.serviceName}.${methodName}:`, error);
            next(error);
        }
    }
}
exports.authController = new AuthController();
// 获取当前用户信息
const getCurrentUser = async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new errors_1.UnauthorizedError('请先登录'));
        }
        const userData = await user_service_1.userService.getUserById(req.user.id);
        res.status(200).json({
            success: true,
            data: userData
        });
    }
    catch (error) {
        next(error);
    }
};
// 用户登出（仅在客户端实现，这里仅作为API端点）
const logout = (req, res) => {
    res.status(200).json({
        success: true,
        message: '用户已登出'
    });
};
// 更新用户信息
const updateProfile = async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new errors_1.UnauthorizedError('请先登录'));
        }
        const userId = req.user.id;
        const userData = await user_service_1.userService.updateUser(userId, req.body);
        res.status(200).json({
            success: true,
            data: userData
        });
    }
    catch (error) {
        next(error);
    }
};
// 修改密码
const changePassword = async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new errors_1.UnauthorizedError('请先登录'));
        }
        const result = await user_service_1.userService.changePassword(req.user.id, req.body);
        res.status(200).json({
            success: true,
            message: '密码修改成功'
        });
    }
    catch (error) {
        next(error);
    }
};
exports.default = {
    register: exports.authController.register,
    login: exports.authController.login,
    getCurrentUser,
    logout,
    updateProfile,
    changePassword,
    getProfile: exports.authController.getProfile
};
