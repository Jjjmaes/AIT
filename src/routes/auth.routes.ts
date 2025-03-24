// ===== 第九步：创建身份验证路由 =====
// src/routes/auth.routes.ts

import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { authenticateJwt } from '../middleware/auth.middleware';
import { validateUser } from '../validators/userValidator';
import { validateLogin } from '../validators/authValidator';
import { validate } from '../middleware/validate.middleware';

const router = Router();

router.post('/register', validateUser, validate, authController.register);
router.post('/login', validateLogin, validate, authController.login);
router.get('/profile', authenticateJwt, authController.getCurrentUser);
router.post('/logout', authenticateJwt, authController.logout);

export default router; 