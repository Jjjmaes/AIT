import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import authController from '../controllers/auth.controller';
import { userController } from '../controllers/user.controller';
import { validateUpdateUser, validateChangePassword } from '../validators/userValidator';
import { validateRequest } from '../middleware/validate.middleware';

const router = Router();

// 获取用户资料
router.get('/profile', authenticateJwt, authController.getCurrentUser);

// 更新用户信息
router.put('/profile', authenticateJwt, validateRequest(validateUpdateUser), authController.updateProfile);

// 修改密码
router.put('/password', authenticateJwt, validateRequest(validateChangePassword), authController.changePassword);

// 获取用户列表 (e.g., for selecting reviewers)
// Add appropriate authentication/authorization middleware here
// For now, just require login
router.get('/', authenticateJwt, userController.getAllUsers);

// 获取当前用户的统计信息
router.get('/stats', authenticateJwt, userController.getUserStats);

export default router; 