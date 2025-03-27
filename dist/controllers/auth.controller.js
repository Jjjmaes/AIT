"use strict";
// ===== 第八步：创建身份验证控制器 =====
// src/controllers/auth.controller.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importDefault(require("../models/user.model"));
const errors_1 = require("../utils/errors");
// 注册新用户
const register = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        // 检查用户名和邮箱是否已被注册
        const existingUser = await user_model_1.default.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return next(new errors_1.ConflictError('用户名或邮箱已被注册'));
        }
        // 创建新用户
        const user = await user_model_1.default.create({
            username,
            email,
            password, // 密码会在模型的pre-save钩子中自动加密
        });
        // 生成JWT令牌
        const token = jsonwebtoken_1.default.sign({ sub: user._id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1d' });
        // 移除密码后返回用户数据
        const userData = {
            id: user._id,
            email: user.email,
            username: user.username
        };
        res.status(201).json({
            success: true,
            token,
            user: userData
        });
    }
    catch (error) {
        next(error);
    }
};
// 用户登录
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        // 查找用户
        const user = await user_model_1.default.findOne({ email });
        if (!user) {
            return next(new errors_1.UnauthorizedError('邮箱或密码不正确'));
        }
        // 验证密码
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return next(new errors_1.UnauthorizedError('邮箱或密码不正确'));
        }
        // 生成JWT令牌
        const token = jsonwebtoken_1.default.sign({ sub: user._id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1d' });
        // 移除密码后返回用户数据
        const userData = {
            id: user._id,
            email: user.email,
            username: user.username
        };
        res.status(200).json({
            success: true,
            token,
            user: userData
        });
    }
    catch (error) {
        next(error);
    }
};
// 获取当前用户信息
const getCurrentUser = async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new errors_1.UnauthorizedError('请先登录'));
        }
        const user = await user_model_1.default.findById(req.user.id).select('-password');
        if (!user) {
            return next(new errors_1.NotFoundError('用户不存在'));
        }
        const userData = {
            id: user._id,
            email: user.email,
            username: user.username,
            role: user.role
        };
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
        const { username, email, role } = req.body;
        // 检查邮箱是否已被其他用户使用
        if (email) {
            const existingUser = await user_model_1.default.findOne({ email, _id: { $ne: userId } });
            if (existingUser) {
                return next(new errors_1.ConflictError('该邮箱已被其他用户使用'));
            }
        }
        // 更新用户信息
        const user = await user_model_1.default.findByIdAndUpdate(userId, { username, email, role }, { new: true, runValidators: true });
        if (!user) {
            return next(new errors_1.NotFoundError('用户不存在'));
        }
        res.status(200).json({
            success: true,
            data: {
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role
            }
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
        const user = await user_model_1.default.findById(req.user.id);
        if (!user) {
            return next(new errors_1.NotFoundError('用户不存在'));
        }
        const { currentPassword, newPassword } = req.body;
        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            return next(new errors_1.UnauthorizedError('当前密码不正确'));
        }
        user.password = newPassword;
        await user.save();
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
    register,
    login,
    getCurrentUser,
    logout,
    updateProfile,
    changePassword
};
