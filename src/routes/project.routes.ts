// src/routes/project.routes.ts

import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import ProjectController from '../controllers/project.controller';
import { validateCreateProject, validateUpdateProject, validateUpdateProjectProgress } from '../validators/projectValidator';
import projectFilesRoutes from './projectFiles.routes'; // Import the project file routes

const router = Router();
const projectController = new ProjectController();

// 所有项目路由都需要认证
router.use(authenticateJwt);

// 获取用户的项目列表
router.get('/', projectController.getProjects.bind(projectController));

// 创建新项目
router.post('/', validateRequest(validateCreateProject), projectController.createProject.bind(projectController));

// 获取单个项目信息
router.get('/:projectId', projectController.getProject.bind(projectController));

// 更新项目信息
router.put('/:projectId', validateRequest(validateUpdateProject), projectController.updateProject.bind(projectController));

// 删除项目
router.delete('/:projectId', projectController.deleteProject.bind(projectController));

// 获取项目统计信息
router.get('/:projectId/stats', projectController.getProjectStats.bind(projectController));

// 更新项目进度
router.put('/:projectId/progress', validateRequest(validateUpdateProjectProgress), projectController.updateProjectProgress.bind(projectController));

// Mount project file routes (handles /:projectId/files/...)
router.use('/', projectFilesRoutes); 

export default router;