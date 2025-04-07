"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const file_controller_1 = require("../controllers/file.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const project_controller_1 = require("../controllers/project.controller");
const router = (0, express_1.Router)();
const fileController = new file_controller_1.FileController();
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
router.get('/projects/:projectId/files', auth_middleware_1.authenticateJwt, fileController.getFiles);
// Route to get a specific file
router.get('/projects/:projectId/files/:fileId', auth_middleware_1.authenticateJwt, fileController.getFile);
// Route to upload a file to a project
router.post('/projects/:projectId/files', auth_middleware_1.authenticateJwt, project_controller_1.upload.single('file'), fileController.uploadFile);
// Route to delete a file
router.delete('/projects/:projectId/files/:fileId', auth_middleware_1.authenticateJwt, fileController.deleteFile);
exports.default = router;
