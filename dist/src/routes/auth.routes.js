"use strict";
// ===== 第九步：创建身份验证路由 =====
// src/routes/auth.routes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const authValidator_1 = require("../validators/authValidator");
const validate_middleware_1 = require("../middleware/validate.middleware");
const authRouter = express_1.default.Router();
// 用户注册
authRouter.post('/register', (0, validate_middleware_1.validateRequest)(authValidator_1.validateRegister), auth_controller_1.authController.register.bind(auth_controller_1.authController));
// 用户登录
authRouter.post('/login', (0, validate_middleware_1.validateRequest)(authValidator_1.validateLogin), auth_controller_1.authController.login.bind(auth_controller_1.authController));
// 用户登出
authRouter.post('/logout', auth_controller_1.authController.logout.bind(auth_controller_1.authController));
// GET /api/auth/profile (Protected route)
authRouter.get('/profile', auth_middleware_1.authenticateJwt, auth_controller_1.authController.getProfile.bind(auth_controller_1.authController));
// TODO: Add routes for password reset, email verification, etc.
exports.default = authRouter;
