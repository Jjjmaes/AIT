// ===== 第九步：创建身份验证路由 =====
// src/routes/auth.routes.ts

import express from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticateJwt } from '../middleware/auth.middleware';
import { validateRegister, validateLogin } from '../validators/authValidator';
import { validateRequest } from '../middleware/validate.middleware';

const authRouter = express.Router();

// 用户注册
authRouter.post('/register', validateRequest(validateRegister), authController.register);

// 用户登录
authRouter.post('/login', validateRequest(validateLogin), authController.login);

// 用户登出
authRouter.post('/logout', authController.logout);

// GET /api/auth/profile (Protected route)
authRouter.get('/profile', authenticateJwt, authController.getProfile);

// TODO: Add routes for password reset, email verification, etc.

export default authRouter; 