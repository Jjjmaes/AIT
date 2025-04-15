// src/routes/project.routes.ts

import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import ProjectController from '../controllers/project.controller';
// Import schemas directly
import { createProjectSchema, updateProjectSchema } from '../schemas/project.schema'; 
// Import the remaining validator if needed
import { validateUpdateProjectProgress } from '../validators/projectValidator';
import projectFilesRoutes from './projectFiles.routes'; // Import the project file routes
import logger from '../utils/logger'; // Import logger

const router = Router();
const projectController = new ProjectController();

// 所有项目路由都需要认证
router.use(authenticateJwt);

// 获取用户的项目列表
router.get('/', projectController.getProjects.bind(projectController));

// 创建新项目 - Log the schema before using it
router.post('/', 
  (req, res, next) => {
    // Log the structure of the schema being used for validation
    logger.info('[POST /api/projects] Using createProjectSchema. Keys:', Object.keys(createProjectSchema.shape));
    // Log if manager is marked as optional in the schema being used
    // Accessing internal Zod details can be fragile, but useful for debugging
    try {
      const managerFieldDef = createProjectSchema.shape.manager;
      // @ts-ignore - Accessing internal property for debugging
      logger.info('[POST /api/projects] createProjectSchema.shape.manager.isOptional:', managerFieldDef?._def?.isOptional);
    } catch (e) { logger.warn('Could not inspect manager optionality'); }
    next();
  },
  validateRequest(createProjectSchema), 
  projectController.createProject.bind(projectController)
);

// 获取单个项目信息
router.get('/:projectId', projectController.getProject.bind(projectController));

// 更新项目信息 - Log the schema before using it
router.patch('/:projectId', 
  (req, res, next) => {
    logger.info('[PATCH /api/projects/:id] Using updateProjectSchema. Keys:', Object.keys(updateProjectSchema.shape));
    next();
  },
  validateRequest(updateProjectSchema), 
  projectController.updateProject.bind(projectController)
);
// If PUT is required (replace entire resource):
// router.put('/:projectId', validateRequest(updateProjectSchema), projectController.updateProject.bind(projectController));

// 删除项目
router.delete('/:projectId', projectController.deleteProject.bind(projectController));

// 获取项目统计信息
router.get('/:projectId/stats', projectController.getProjectStats.bind(projectController));

// 更新项目进度 - Use the specific validator
router.put('/:projectId/progress', validateRequest(validateUpdateProjectProgress), projectController.updateProjectProgress.bind(projectController));

// Mount project file routes correctly under /:projectId/files
// This router will now handle requests like GET /api/projects/123/files/
// or POST /api/projects/123/files/
router.use('/:projectId/files', projectFilesRoutes); 

export default router;