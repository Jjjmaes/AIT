// src/routes/project.routes.ts

import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { Container } from 'typedi';
import ProjectController from '../controllers/project.controller';
// Import schemas directly
import { createProjectSchema, updateProjectSchema } from '../schemas/project.schema'; 
// Import the remaining validator if needed
import { validateUpdateProjectProgress } from '../validators/projectValidator';
import projectFilesRoutes from './projectFiles.routes'; // Import the project file routes
import logger from '../utils/logger'; // Import logger

const router = Router();

// 所有项目路由都需要认证
router.use(authenticateJwt);

// Define specific routes BEFORE parameterized routes

// GET /api/projects/recent (Handles recent projects)
router.get('/recent', 
    (req, res, next) => Container.get(ProjectController).getRecentProjects(req, res, next)
);

// GET /api/projects (Handles project list with filters)
router.get('/', 
    (req, res, next) => Container.get(ProjectController).getProjects(req, res, next)
);

// POST /api/projects (Handles project creation)
router.post('/', 
    (req, res, next) => { // Keep schema logging if desired, or remove
        logger.info('[POST /api/projects] Using createProjectSchema. Keys:', Object.keys(createProjectSchema.shape));
        next();
    },
    validateRequest(createProjectSchema), 
    (req, res, next) => Container.get(ProjectController).createProject(req, res, next)
);

// Define parameterized routes AFTER specific routes

// GET /api/projects/:projectId (Handles fetching a single project) - Uncommented
router.get('/:projectId', 
    (req, res, next) => Container.get(ProjectController).getProject(req, res, next)
);

// PATCH /api/projects/:projectId (Handles project update)
router.patch('/:projectId', 
    (req, res, next) => {
        logger.info('[PATCH /api/projects/:id] Using updateProjectSchema. Keys:', Object.keys(updateProjectSchema.shape));
        next();
    },
    validateRequest(updateProjectSchema), 
    (req, res, next) => Container.get(ProjectController).updateProject(req, res, next)
);

// DELETE /api/projects/:projectId
router.delete('/:projectId', (req, res, next) => Container.get(ProjectController).deleteProject(req, res, next));

// GET /api/projects/:projectId/stats
router.get('/:projectId/stats', (req, res, next) => Container.get(ProjectController).getProjectStats(req, res, next));

// PUT /api/projects/:projectId/progress
router.put('/:projectId/progress', validateRequest(validateUpdateProjectProgress), (req, res, next) => Container.get(ProjectController).updateProjectProgress(req, res, next));

// Mount nested file routes
router.use('/:projectId/files', projectFilesRoutes);

export default router;