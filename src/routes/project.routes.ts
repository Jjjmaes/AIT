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

// Define specific routes BEFORE parameterized routes

// GET /api/projects/recent (Handles recent projects)
router.get('/recent', 
    projectController.getRecentProjects.bind(projectController)
);

// GET /api/projects (Handles project list with filters)
router.get('/', 
    projectController.getProjects.bind(projectController)
);

// POST /api/projects (Handles project creation)
router.post('/', 
    (req, res, next) => { // Keep schema logging if desired, or remove
        logger.info('[POST /api/projects] Using createProjectSchema. Keys:', Object.keys(createProjectSchema.shape));
        next();
    },
    validateRequest(createProjectSchema), 
    projectController.createProject.bind(projectController)
);

// Define parameterized routes AFTER specific routes

// GET /api/projects/:projectId (Handles fetching a single project) - Uncommented
router.get('/:projectId', 
    projectController.getProject.bind(projectController)
);

// PATCH /api/projects/:projectId (Handles project update)
router.patch('/:projectId', 
    (req, res, next) => {
        logger.info('[PATCH /api/projects/:id] Using updateProjectSchema. Keys:', Object.keys(updateProjectSchema.shape));
        next();
    },
    validateRequest(updateProjectSchema), 
    projectController.updateProject.bind(projectController)
);

// DELETE /api/projects/:projectId
router.delete('/:projectId', projectController.deleteProject.bind(projectController));

// GET /api/projects/:projectId/stats
router.get('/:projectId/stats', projectController.getProjectStats.bind(projectController));

// PUT /api/projects/:projectId/progress
router.put('/:projectId/progress', validateRequest(validateUpdateProjectProgress), projectController.updateProjectProgress.bind(projectController));

// Mount nested file routes
router.use('/:projectId/files', projectFilesRoutes);

export default router;