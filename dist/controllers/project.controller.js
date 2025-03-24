"use strict";
// src/controllers/project.controller.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const project_service_1 = __importDefault(require("../services/project.service"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const file_model_1 = require("../models/file.model");
const apiError_1 = require("../utils/apiError");
// 配置文件上传
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path_1.default.join(__dirname, '../../uploads');
        // 确保上传目录存在
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${(0, uuid_1.v4)()}${path_1.default.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});
// 文件类型过滤
const fileFilter = (req, file, cb) => {
    // 获取文件扩展名
    const ext = path_1.default.extname(file.originalname).toLowerCase().substring(1);
    // 允许的文件类型
    const allowedTypes = Object.values(file_model_1.FileType);
    if (allowedTypes.includes(ext)) {
        cb(null, true);
    }
    else {
        cb(new Error(`不支持的文件类型: ${ext}`));
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});
class ProjectController {
    /**
     * 创建新项目
     */
    async createProject(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: '未授权的访问'
                });
            }
            const projectData = req.body;
            const project = await project_service_1.default.createProject(userId, projectData);
            res.status(201).json({
                success: true,
                data: {
                    project
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 获取项目列表
     */
    async getProjects(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: '未授权的访问'
                });
            }
            const { status, priority, search, page, limit } = req.query;
            const result = await project_service_1.default.getUserProjects(userId, {
                status: status,
                priority: priority,
                search: search,
                page: page ? parseInt(page) : undefined,
                limit: limit ? parseInt(limit) : undefined
            });
            res.status(200).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 获取单个项目信息
     */
    async getProject(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: '未授权的访问'
                });
            }
            const { projectId } = req.params;
            const project = await project_service_1.default.getProjectById(projectId, userId);
            res.status(200).json({
                success: true,
                data: {
                    project
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 更新项目信息
     */
    async updateProject(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: '未授权的访问'
                });
            }
            const { projectId } = req.params;
            const updateData = req.body;
            const project = await project_service_1.default.updateProject(projectId, userId, updateData);
            res.status(200).json({
                success: true,
                data: {
                    project
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 删除项目
     */
    async deleteProject(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: '未授权的访问'
                });
            }
            const { projectId } = req.params;
            const result = await project_service_1.default.deleteProject(projectId, userId);
            res.status(200).json({
                success: true,
                message: result.message,
                data: result
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 上传项目文件
     */
    async uploadFile(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: '未授权的访问'
                });
            }
            const { projectId } = req.params;
            if (!req.file) {
                throw new apiError_1.ApiError(400, '请上传文件');
            }
            const fileData = {
                originalName: req.file.originalname,
                fileName: req.file.filename,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                filePath: req.file.path
            };
            const file = await project_service_1.default.uploadProjectFile(projectId, userId, fileData);
            res.status(201).json({
                success: true,
                data: {
                    file
                }
            });
        }
        catch (error) {
            // 如果发生错误，删除上传的文件
            if (req.file && fs_1.default.existsSync(req.file.path)) {
                fs_1.default.unlinkSync(req.file.path);
            }
            next(error);
        }
    }
    /**
     * 获取项目文件列表
     */
    async getProjectFiles(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: '未授权的访问'
                });
            }
            const { projectId } = req.params;
            const files = await project_service_1.default.getProjectFiles(projectId, userId);
            res.status(200).json({
                success: true,
                data: {
                    files
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 处理文件
     */
    async processFile(req, res, next) {
        try {
            const { fileId } = req.params;
            await project_service_1.default.processFile(fileId);
            res.status(200).json({
                success: true,
                message: '文件处理成功'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 获取文件段落列表
     */
    async getFileSegments(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: '未授权的访问'
                });
            }
            const { fileId } = req.params;
            const { status, page, limit } = req.query;
            const result = await project_service_1.default.getFileSegments(fileId, userId, {
                status: status,
                page: page ? parseInt(page) : undefined,
                limit: limit ? parseInt(limit) : undefined
            });
            res.status(200).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 更新文件进度
     */
    async updateFileProgress(req, res, next) {
        try {
            const { fileId } = req.params;
            await project_service_1.default.updateFileProgress(fileId);
            res.status(200).json({
                success: true,
                message: '文件进度已更新'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 更新项目进度
     */
    async updateProjectProgress(req, res, next) {
        try {
            const { projectId } = req.params;
            await project_service_1.default.updateProjectProgress(projectId);
            res.status(200).json({
                success: true,
                message: '项目进度已更新'
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 获取项目统计信息
     */
    async getProjectStats(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: '未授权的访问'
                });
            }
            const { projectId } = req.params;
            // 获取项目详情
            const project = await project_service_1.default.getProjectById(projectId, userId);
            // 获取项目文件
            const files = await project_service_1.default.getProjectFiles(projectId, userId);
            // 计算统计信息
            const stats = {
                totalFiles: files.length,
                totalSegments: project.progress.totalSegments,
                translatedSegments: project.progress.translatedSegments,
                reviewedSegments: project.progress.reviewedSegments,
                translationProgress: project.progress.totalSegments > 0
                    ? Math.round((project.progress.translatedSegments / project.progress.totalSegments) * 100)
                    : 0,
                reviewProgress: project.progress.totalSegments > 0
                    ? Math.round((project.progress.reviewedSegments / project.progress.totalSegments) * 100)
                    : 0,
                fileStats: files.map(file => ({
                    id: file._id,
                    name: file.originalName,
                    type: file.type,
                    status: file.status,
                    segmentCount: file.segmentCount,
                    translatedCount: file.translatedCount,
                    reviewedCount: file.reviewedCount,
                    progress: file.segmentCount > 0
                        ? Math.round((file.reviewedCount / file.segmentCount) * 100)
                        : 0
                }))
            };
            res.status(200).json({
                success: true,
                data: {
                    stats
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.default = ProjectController;
