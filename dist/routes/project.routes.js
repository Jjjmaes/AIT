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
const projectValidator_1 = require("../validators/projectValidator");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const projectController = new project_controller_1.default();
// 所有项目路由都需要认证
router.use(auth_middleware_1.authenticateJwt);
// 获取用户的项目列表
router.get('/', projectController.getProjects.bind(projectController));
// 创建新项目
router.post('/', (0, validate_middleware_1.validateRequest)(projectValidator_1.validateCreateProject), projectController.createProject.bind(projectController));
// 获取单个项目信息
router.get('/:projectId', projectController.getProject.bind(projectController));
// 更新项目信息
router.put('/:projectId', (0, validate_middleware_1.validateRequest)(projectValidator_1.validateUpdateProject), projectController.updateProject.bind(projectController));
// 删除项目
router.delete('/:projectId', projectController.deleteProject.bind(projectController));
// 获取项目统计信息
router.get('/:projectId/stats', projectController.getProjectStats.bind(projectController));
// 上传项目文件
const upload = (0, multer_1.default)({ dest: 'uploads/' });
router.post('/:projectId/files', upload.single('file'), projectController.uploadFile.bind(projectController));
// 获取项目文件列表
router.get('/:projectId/files', projectController.getProjectFiles.bind(projectController));
// 获取文件段落列表
router.get('/files/:fileId/segments', projectController.getFileSegments.bind(projectController));
// 更新项目进度
router.put('/:projectId/progress', (0, validate_middleware_1.validateRequest)(projectValidator_1.validateUpdateProjectProgress), projectController.updateProjectProgress.bind(projectController));
exports.default = router;
