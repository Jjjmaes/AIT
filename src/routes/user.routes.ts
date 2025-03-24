import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import authController from '../controllers/auth.controller';
import { validateUpdateUser, validateChangePassword } from '../validators/userValidator';
import { validate } from '../middleware/validate.middleware';

const router = Router();

// 获取用户资料
router.get('/profile', authenticateJwt, authController.getCurrentUser);

// 更新用户信息
router.put('/profile', authenticateJwt, validateUpdateUser, validate, authController.updateProfile);

// 修改密码
router.put('/password', authenticateJwt, validateChangePassword, validate, authController.changePassword);

const userRoutes = router;
export default userRoutes; 