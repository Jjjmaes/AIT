import { Router } from 'express';
import fileController from '../controllers/file.controller';
import { authenticateJwt } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { validateProcessFile, validateUpdateFileProgress } from '../validators/fileValidator';

const router = Router();

// 文件处理路由
router.post(
  '/:fileId/process',
  authenticateJwt,
  validateRequest(validateProcessFile),
  fileController.processFile
);
router.get(
  '/:fileId/segments',
  authenticateJwt,
  fileController.getFileSegments
);

// 更新文件进度
router.put(
  '/:fileId/progress',
  authenticateJwt,
  validateRequest(validateUpdateFileProgress),
  fileController.updateFileProgress
);

export default router; 