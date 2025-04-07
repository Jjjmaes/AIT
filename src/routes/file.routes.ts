import { Router } from 'express';
import { FileController } from '../controllers/file.controller';
import { authenticateJwt } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { validateProcessFile, validateUpdateFileProgress } from '../validators/fileValidator';
import { upload } from '../controllers/project.controller';

const router = Router();
const fileController = new FileController();

// 文件处理路由 - Commented out routes using non-existent FileController methods
/*
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
*/

// Route to get files for a project
router.get(
  '/projects/:projectId/files',
  authenticateJwt,
  fileController.getFiles
);

// Route to get a specific file
router.get(
  '/projects/:projectId/files/:fileId',
  authenticateJwt,
  fileController.getFile
);

// Route to upload a file to a project
router.post(
  '/projects/:projectId/files',
  authenticateJwt,
  upload.single('file'),
  fileController.uploadFile
);

// Route to delete a file
router.delete(
  '/projects/:projectId/files/:fileId',
  authenticateJwt,
  fileController.deleteFile
);

export default router; 