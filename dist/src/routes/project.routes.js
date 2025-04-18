"use strict";
// src/routes/project.routes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const project_controller_1 = __importDefault(require("../controllers/project.controller"));
// Import schemas directly
const project_schema_1 = require("../schemas/project.schema");
// Import the remaining validator if needed
const projectValidator_1 = require("../validators/projectValidator");
const projectFiles_routes_1 = __importDefault(require("./projectFiles.routes")); // Import the project file routes
const logger_1 = __importDefault(require("../utils/logger")); // Import logger
const router = (0, express_1.Router)();
const projectController = new project_controller_1.default();
// 所有项目路由都需要认证
router.use(auth_middleware_1.authenticateJwt);
// Define specific routes BEFORE parameterized routes
// GET /api/projects/recent (Handles recent projects)
router.get('/recent', projectController.getRecentProjects.bind(projectController));
// GET /api/projects (Handles project list with filters)
router.get('/', projectController.getProjects.bind(projectController));
// POST /api/projects (Handles project creation)
router.post('/', (req, res, next) => {
    logger_1.default.info('[POST /api/projects] Using createProjectSchema. Keys:', Object.keys(project_schema_1.createProjectSchema.shape));
    next();
}, (0, validate_middleware_1.validateRequest)(project_schema_1.createProjectSchema), projectController.createProject.bind(projectController));
// Define parameterized routes AFTER specific routes
// GET /api/projects/:projectId (Handles fetching a single project) - Uncommented
router.get('/:projectId', projectController.getProject.bind(projectController));
// PATCH /api/projects/:projectId (Handles project update)
router.patch('/:projectId', (req, res, next) => {
    logger_1.default.info('[PATCH /api/projects/:id] Using updateProjectSchema. Keys:', Object.keys(project_schema_1.updateProjectSchema.shape));
    next();
}, (0, validate_middleware_1.validateRequest)(project_schema_1.updateProjectSchema), projectController.updateProject.bind(projectController));
// DELETE /api/projects/:projectId
router.delete('/:projectId', projectController.deleteProject.bind(projectController));
// GET /api/projects/:projectId/stats
router.get('/:projectId/stats', projectController.getProjectStats.bind(projectController));
// PUT /api/projects/:projectId/progress
router.put('/:projectId/progress', (0, validate_middleware_1.validateRequest)(projectValidator_1.validateUpdateProjectProgress), projectController.updateProjectProgress.bind(projectController));
// Mount nested file routes
router.use('/:projectId/files', projectFiles_routes_1.default);
exports.default = router;
