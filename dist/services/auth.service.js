"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const user_model_1 = __importDefault(require("../models/user.model"));
const errors_1 = require("../utils/errors");
const jsonwebtoken_1 = require("jsonwebtoken");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const errors_2 = require("../utils/errors");
class AuthService {
    constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
        this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
        this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
        this.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    }
    async register(data) {
        const existingUser = await user_model_1.default.findOne({ email: data.email });
        if (existingUser) {
            throw new errors_1.AppError('该邮箱已被注册', 400);
        }
        const user = new user_model_1.default(data);
        await user.save();
        return user;
    }
    async login(email, password) {
        const user = await user_model_1.default.findOne({ email });
        if (!user) {
            throw new errors_1.AppError('邮箱或密码错误', 401);
        }
        // Ensure user and password exist before comparing
        if (!user || typeof user.password !== 'string') {
            throw new errors_2.UnauthorizedError('用户不存在或密码格式错误');
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            throw new errors_1.AppError('邮箱或密码错误', 401);
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
            // @ts-ignore
            const decoded = (0, jsonwebtoken_1.verify)(token, this.JWT_REFRESH_SECRET);
            const user = await user_model_1.default.findById(decoded.id);
            if (!user || user.refreshToken !== token) {
                throw new errors_1.AppError('Invalid refresh token', 401);
            }
            const accessToken = this.generateAccessToken(user);
            return { accessToken };
        }
        catch (error) {
            throw new errors_1.AppError('Invalid refresh token', 401);
        }
    }
    async logout(token) {
        try {
            // @ts-ignore
            const decoded = (0, jsonwebtoken_1.verify)(token, this.JWT_REFRESH_SECRET);
            const user = await user_model_1.default.findById(decoded.id);
            if (user) {
                user.refreshToken = undefined;
                await user.save();
            }
        }
        catch (error) {
            throw new errors_1.AppError('Invalid refresh token', 401);
        }
    }
    generateAccessToken(user) {
        // @ts-ignore
        return (0, jsonwebtoken_1.sign)({ id: user._id, role: user.role }, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN });
    }
    generateRefreshToken(user) {
        // @ts-ignore
        return (0, jsonwebtoken_1.sign)({ id: user._id }, this.JWT_REFRESH_SECRET, { expiresIn: this.JWT_REFRESH_EXPIRES_IN });
    }
}
exports.AuthService = AuthService;
