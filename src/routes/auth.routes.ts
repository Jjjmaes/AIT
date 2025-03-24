// ===== 第九步：创建身份验证路由 =====
// src/routes/auth.routes.ts

import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { authenticateJwt } from '../middleware/auth.middleware';
import { validateRegister, validateLogin } from '../validators/authValidator';
import { validate } from '../middleware/validate.middleware';

const router = Router();

// 用户注册
router.post('/register', validateRegister, validate, authController.register);

// 用户登录
router.post('/login', validateLogin, validate, authController.login);

// 获取当前用户信息
router.get('/profile', authenticateJwt, authController.getCurrentUser);

// 用户登出
router.post('/logout', authenticateJwt, authController.logout);

export default router; 