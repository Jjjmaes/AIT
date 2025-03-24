import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import authController from '../controllers/auth.controller';

const router = Router();

router.get('/profile', authenticateJwt, authController.getCurrentUser);

export default router; 