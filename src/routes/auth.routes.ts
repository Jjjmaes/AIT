// ===== 第九步：创建身份验证路由 =====
// src/routes/auth.routes.ts

import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { validateRegister, validateLogin } from '../validators/authValidator';
import { validateRequest } from '../middleware/validate.middleware';

const router = Router();

// 用户注册
router.post('/register', validateRequest(validateRegister), authController.register);

// 用户登录
router.post('/login', validateRequest(validateLogin), authController.login);

// 用户登出
router.post('/logout', authController.logout);

export default router; 