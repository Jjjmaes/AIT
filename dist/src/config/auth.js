"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTokenFromRequest = exports.verifyToken = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '24h';
// 生成JWT令牌
const generateToken = (user) => {
    const payload = {
        sub: user.id,
        email: user.email,
        role: user.role
    };
    const options = {
        expiresIn: JWT_EXPIRES_IN
    };
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, options);
};
exports.generateToken = generateToken;
// 验证JWT令牌
const verifyToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch (error) {
        throw error;
    }
};
exports.verifyToken = verifyToken;
// 从请求中提取令牌
const extractTokenFromRequest = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7); // 去除'Bearer '前缀
    }
    return null;
};
exports.extractTokenFromRequest = extractTokenFromRequest;
