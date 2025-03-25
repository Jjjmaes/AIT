// src/routes/project.routes.ts

import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import ProjectController from '../controllers/project.controller';
import { validateCreateProject, validateUpdateProject, validateUpdateProjectProgress } from '../validators/projectValidator';
import multer from 'multer';

const router = Router();
const projectController = new ProjectController();

// 所有项目路由都需要认证
router.use(authenticateJwt);

// 获取用户的项目列表
router.get('/', projectController.getProjects.bind(projectController));

// 创建新项目
router.post('/', validate(validateCreateProject), projectController.createProject.bind(projectController));

// 获取单个项目信息
router.get('/:projectId', projectController.getProject.bind(projectController));

// 更新项目信息
router.put('/:projectId', validate(validateUpdateProject), projectController.updateProject.bind(projectController));

// 删除项目
router.delete('/:projectId', projectController.deleteProject.bind(projectController));

// 获取项目统计信息
router.get('/:projectId/stats', projectController.getProjectStats.bind(projectController));

// 上传项目文件
const upload = multer({ dest: 'uploads/' });
router.post('/:projectId/files', upload.single('file'), projectController.uploadFile.bind(projectController));

// 获取项目文件列表
router.get('/:projectId/files', projectController.getProjectFiles.bind(projectController));

// 获取文件段落列表
router.get('/files/:fileId/segments', projectController.getFileSegments.bind(projectController));

// 更新项目进度
router.put('/:projectId/progress', validate(validateUpdateProjectProgress), projectController.updateProjectProgress.bind(projectController));

export default router;