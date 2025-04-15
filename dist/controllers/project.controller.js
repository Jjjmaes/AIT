"use strict";
// src/controllers/project.controller.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const errors_1 = require("../utils/errors");
const multer_1 = __importDefault(require("multer"));
const project_service_1 = require("../services/project.service");
const project_schema_1 = require("../schemas/project.schema");
const upload_config_1 = require("../config/upload.config");
const logger_1 = __importDefault(require("../utils/logger"));
const mongoose_1 = require("mongoose");
exports.upload = (0, multer_1.default)(upload_config_1.fileUploadConfig);
const projectService = new project_service_1.ProjectService();
class ProjectController {
    /**
     * 创建新项目
     */
    async createProject(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                throw new errors_1.UnauthorizedError('未授权的访问');
            }
            const validationResult = project_schema_1.createProjectSchema.safeParse(req.body);
            if (!validationResult.success) {
                const errorMessage = JSON.stringify(validationResult.error.flatten());
                throw new errors_1.ValidationError(errorMessage);
            }
            const validatedData = validationResult.data;
            logger_1.default.info(`User ${userId} creating new project with data: ${JSON.stringify(validatedData)}`);
            const createDto = {
                ...validatedData,
                manager: new mongoose_1.Types.ObjectId(userId),
                reviewers: validatedData.reviewers?.map(id => new mongoose_1.Types.ObjectId(id)),
                defaultTranslationPromptTemplate: validatedData.defaultTranslationPromptTemplate
                    ? new mongoose_1.Types.ObjectId(validatedData.defaultTranslationPromptTemplate)
                    : undefined,
                defaultReviewPromptTemplate: validatedData.defaultReviewPromptTemplate
                    ? new mongoose_1.Types.ObjectId(validatedData.defaultReviewPromptTemplate)
                    : undefined,
                translationPromptTemplate: validatedData.translationPromptTemplate
                    ? new mongoose_1.Types.ObjectId(validatedData.translationPromptTemplate)
                    : undefined,
                reviewPromptTemplate: validatedData.reviewPromptTemplate
                    ? new mongoose_1.Types.ObjectId(validatedData.reviewPromptTemplate)
                    : undefined,
                deadline: validatedData.deadline ? new Date(validatedData.deadline) : undefined,
            };
            const project = await projectService.createProject(createDto);
            logger_1.default.info(`Project ${project.id} created successfully by user ${userId}`);
            res.status(201).json({
                success: true,
                data: { project }
            });
        }
        catch (error) {
            logger_1.default.error(`Error in createProject controller:`, error);
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
                throw new errors_1.UnauthorizedError('未授权的访问');
            }
            const { status, priority, search, page, limit } = req.query;
            const result = await projectService.getUserProjects(userId, {
                status: status,
                priority: priority ? parseInt(priority, 10) : undefined,
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
            const userRoles = req.user?.role ? [req.user.role] : [];
            if (!userId) {
                throw new errors_1.UnauthorizedError('未授权的访问');
            }
            const { projectId } = req.params;
            const project = await projectService.getProjectById(projectId, userId, userRoles);
            res.status(200).json({
                success: true,
                data: { project }
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
                throw new errors_1.UnauthorizedError('未授权的访问');
            }
            const { projectId } = req.params;
            const validationResult = project_schema_1.updateProjectSchema.safeParse(req.body);
            if (!validationResult.success) {
                const errorMessage = JSON.stringify(validationResult.error.flatten());
                throw new errors_1.ValidationError(errorMessage);
            }
            const validatedData = validationResult.data;
            logger_1.default.info(`User ${userId} updating project ${projectId} with data: ${JSON.stringify(validatedData)}`);
            const updateDto = {};
            if (validatedData.name !== undefined)
                updateDto.name = validatedData.name;
            if (validatedData.description !== undefined)
                updateDto.description = validatedData.description;
            if (validatedData.languagePairs !== undefined)
                updateDto.languagePairs = validatedData.languagePairs;
            if (validatedData.manager !== undefined)
                updateDto.manager = new mongoose_1.Types.ObjectId(validatedData.manager);
            if (validatedData.reviewers !== undefined) {
                updateDto.reviewers = validatedData.reviewers.map(id => new mongoose_1.Types.ObjectId(id));
            }
            if (validatedData.defaultTranslationPromptTemplate !== undefined) {
                updateDto.defaultTranslationPromptTemplate = new mongoose_1.Types.ObjectId(validatedData.defaultTranslationPromptTemplate);
            }
            if (validatedData.defaultReviewPromptTemplate !== undefined) {
                updateDto.defaultReviewPromptTemplate = new mongoose_1.Types.ObjectId(validatedData.defaultReviewPromptTemplate);
            }
            if (validatedData.translationPromptTemplate !== undefined) {
                updateDto.translationPromptTemplate = new mongoose_1.Types.ObjectId(validatedData.translationPromptTemplate);
            }
            if (validatedData.reviewPromptTemplate !== undefined) {
                updateDto.reviewPromptTemplate = new mongoose_1.Types.ObjectId(validatedData.reviewPromptTemplate);
            }
            if (validatedData.deadline !== undefined) {
                updateDto.deadline = validatedData.deadline ? new Date(validatedData.deadline) : undefined;
            }
            if (validatedData.priority !== undefined)
                updateDto.priority = validatedData.priority;
            if (validatedData.domain !== undefined)
                updateDto.domain = validatedData.domain;
            if (validatedData.industry !== undefined)
                updateDto.industry = validatedData.industry;
            if (validatedData.status !== undefined)
                updateDto.status = validatedData.status;
            if (Object.keys(updateDto).length === 0) {
                logger_1.default.warn(`No valid fields provided for updating project ${projectId}`);
                return res.status(400).json({ success: false, message: '没有提供可更新的字段' });
            }
            const project = await projectService.updateProject(projectId, userId, updateDto);
            logger_1.default.info(`Project ${projectId} updated successfully by user ${userId}`);
            res.status(200).json({
                success: true,
                data: { project }
            });
        }
        catch (error) {
            logger_1.default.error(`Error in updateProject controller:`, error);
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
                throw new errors_1.UnauthorizedError('未授权的访问');
            }
            const { projectId } = req.params;
            logger_1.default.info(`User ${userId} deleting project ${projectId}`);
            const result = await projectService.deleteProject(projectId, userId);
            logger_1.default.info(`Project ${projectId} deleted successfully by user ${userId}`);
            res.status(200).json({
                success: true,
                message: '项目删除成功',
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
            const { projectId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                return next(new errors_1.UnauthorizedError('请先登录'));
            }
            if (!req.file) {
                return next(new errors_1.ValidationError('请选择要上传的文件'));
            }
            const { originalname, path, size, mimetype } = req.file;
            const { sourceLanguage, targetLanguage, category, tags } = req.body;
            // 转换文件数据为DTO
            const fileData = {
                originalName: originalname,
                filePath: path,
                fileSize: size,
                mimeType: mimetype,
                sourceLanguage,
                targetLanguage,
                fileType: category
            };
            const uploadedFile = await projectService.uploadProjectFile(projectId, userId, fileData);
            res.status(201).json({
                success: true,
                data: uploadedFile
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * 获取项目文件列表
     */
    async getProjectFiles(req, res, next) {
        try {
            const userId = req.user?.id;
            const userRoles = req.user?.role ? [req.user.role] : [];
            if (!userId) {
                throw new errors_1.UnauthorizedError('未授权的访问');
            }
            const { projectId } = req.params;
            const files = await projectService.getProjectFiles(projectId, userId, userRoles);
            res.status(200).json({
                success: true,
                data: { files }
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
            const userId = req.user?.id;
            const userRoles = req.user?.role ? [req.user.role] : [];
            if (!userId) {
                throw new errors_1.UnauthorizedError('未授权的访问');
            }
            const { fileId } = req.params;
            logger_1.default.info(`User ${userId} processing file ${fileId}`);
            await projectService.processFile(fileId, userId);
            logger_1.default.info(`File ${fileId} processed successfully`);
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
            const userRoles = req.user?.role ? [req.user.role] : [];
            if (!userId) {
                throw new errors_1.UnauthorizedError('未授权的访问');
            }
            const { fileId } = req.params;
            const { status, page, limit } = req.query;
            const result = await projectService.getFileSegments(fileId, userId, {
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
            const userId = req.user?.id;
            const userRoles = req.user?.role ? [req.user.role] : [];
            if (!userId) {
                throw new errors_1.UnauthorizedError('未授权的访问');
            }
            const { fileId } = req.params;
            await projectService.updateFileProgress(fileId, userId);
            res.status(200).json({
                success: true,
                message: '文件进度更新成功'
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
            const userId = req.user?.id;
            const userRoles = req.user?.role ? [req.user.role] : [];
            if (!userId) {
                throw new errors_1.UnauthorizedError('未授权的访问');
            }
            const { projectId } = req.params;
            const validationResult = project_schema_1.projectProgressSchema.safeParse(req.body);
            if (!validationResult.success) {
                throw new errors_1.ValidationError(JSON.stringify(validationResult.error.flatten()));
            }
            const project = await projectService.updateProjectProgress(projectId, userId, validationResult.data);
            res.status(200).json({
                success: true,
                message: '项目进度更新成功'
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
                throw new errors_1.UnauthorizedError('未授权的访问');
            }
            const { projectId } = req.params;
            res.status(501).json({
                success: false,
                message: 'Project stats endpoint not implemented yet.'
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.default = ProjectController;
