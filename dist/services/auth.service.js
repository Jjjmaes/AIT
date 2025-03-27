"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const user_model_1 = require("../models/user.model");
const AppError_1 = require("../utils/AppError");
const error_types_1 = require("../types/error.types");
const jsonwebtoken_1 = require("jsonwebtoken");
const bcrypt_1 = __importDefault(require("bcrypt"));
class AuthService {
    constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
        this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
        this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
        this.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    }
    async register(data) {
        const existingUser = await user_model_1.User.findOne({ email: data.email });
        if (existingUser) {
            throw new AppError_1.AppError(error_types_1.ErrorCode.VALIDATION_ERROR, '该邮箱已被注册', 400);
        }
        const user = new user_model_1.User(data);
        await user.save();
        return user;
    }
    async login(email, password) {
        const user = await user_model_1.User.findOne({ email });
        if (!user) {
            throw new AppError_1.AppError(error_types_1.ErrorCode.INVALID_CREDENTIALS, '邮箱或密码错误', 401);
        }
        const isPasswordValid = await bcrypt_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            throw new AppError_1.AppError(error_types_1.ErrorCode.INVALID_CREDENTIALS, '邮箱或密码错误', 401);
        }
        const accessToken = this.generateAccessToken(user);
        const refreshToken = this.generateRefreshToken(user);
        user.refreshToken = refreshToken;
        await user.save();
        return {
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                role: user.role
            },
            accessToken,
            refreshToken
        };
    }
    async refreshToken(token) {
        try {
            const decoded = (0, jsonwebtoken_1.verify)(token, this.JWT_REFRESH_SECRET);
            const user = await user_model_1.User.findById(decoded.id);
            if (!user || user.refreshToken !== token) {
                throw new AppError_1.AppError(error_types_1.ErrorCode.UNAUTHORIZED, 'Invalid refresh token', 401);
            }
            const accessToken = this.generateAccessToken(user);
            return { accessToken };
        }
        catch (error) {
            throw new AppError_1.AppError(error_types_1.ErrorCode.UNAUTHORIZED, 'Invalid refresh token', 401);
        }
    }
    async logout(token) {
        try {
            const decoded = (0, jsonwebtoken_1.verify)(token, this.JWT_REFRESH_SECRET);
            const user = await user_model_1.User.findById(decoded.id);
            if (user) {
                user.refreshToken = undefined;
                await user.save();
            }
        }
        catch (error) {
            throw new AppError_1.AppError(error_types_1.ErrorCode.UNAUTHORIZED, 'Invalid refresh token', 401);
        }
    }
    generateAccessToken(user) {
        return (0, jsonwebtoken_1.sign)({ id: user._id, role: user.role }, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN });
    }
    generateRefreshToken(user) {
        return (0, jsonwebtoken_1.sign)({ id: user._id }, this.JWT_REFRESH_SECRET, { expiresIn: this.JWT_REFRESH_EXPIRES_IN });
    }
}
exports.AuthService = AuthService;
