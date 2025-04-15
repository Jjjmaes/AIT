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
// 获取用户的项目列表
router.get('/', projectController.getProjects.bind(projectController));
// 创建新项目 - Log the schema before using it
router.post('/', (req, res, next) => {
    // Log the structure of the schema being used for validation
    logger_1.default.info('[POST /api/projects] Using createProjectSchema. Keys:', Object.keys(project_schema_1.createProjectSchema.shape));
    // Log if manager is marked as optional in the schema being used
    // Accessing internal Zod details can be fragile, but useful for debugging
    try {
        const managerFieldDef = project_schema_1.createProjectSchema.shape.manager;
        // @ts-ignore - Accessing internal property for debugging
        logger_1.default.info('[POST /api/projects] createProjectSchema.shape.manager.isOptional:', managerFieldDef?._def?.isOptional);
    }
    catch (e) {
        logger_1.default.warn('Could not inspect manager optionality');
    }
    next();
}, (0, validate_middleware_1.validateRequest)(project_schema_1.createProjectSchema), projectController.createProject.bind(projectController));
// 获取单个项目信息
router.get('/:projectId', projectController.getProject.bind(projectController));
// 更新项目信息 - Log the schema before using it
router.patch('/:projectId', (req, res, next) => {
    logger_1.default.info('[PATCH /api/projects/:id] Using updateProjectSchema. Keys:', Object.keys(project_schema_1.updateProjectSchema.shape));
    next();
}, (0, validate_middleware_1.validateRequest)(project_schema_1.updateProjectSchema), projectController.updateProject.bind(projectController));
// If PUT is required (replace entire resource):
// router.put('/:projectId', validateRequest(updateProjectSchema), projectController.updateProject.bind(projectController));
// 删除项目
router.delete('/:projectId', projectController.deleteProject.bind(projectController));
// 获取项目统计信息
router.get('/:projectId/stats', projectController.getProjectStats.bind(projectController));
// 更新项目进度 - Use the specific validator
router.put('/:projectId/progress', (0, validate_middleware_1.validateRequest)(projectValidator_1.validateUpdateProjectProgress), projectController.updateProjectProgress.bind(projectController));
// Mount project file routes correctly under /:projectId/files
// This router will now handle requests like GET /api/projects/123/files/
// or POST /api/projects/123/files/
router.use('/:projectId/files', projectFiles_routes_1.default);
exports.default = router;
