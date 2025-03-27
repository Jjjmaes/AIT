"use strict";
// src/services/project.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectService = exports.ProjectService = void 0;
const mongoose_1 = require("mongoose");
const project_model_1 = __importDefault(require("../models/project.model"));
const errors_1 = require("../utils/errors");
const project_types_1 = require("../types/project.types");
const logger_1 = __importDefault(require("../utils/logger"));
const file_model_1 = require("../models/file.model");
const segment_model_1 = require("../models/segment.model");
const fs_1 = __importDefault(require("fs"));
const util_1 = require("util");
const s3_1 = require("../utils/s3");
const fileProcessor_1 = require("../utils/fileProcessor");
const unlinkAsync = (0, util_1.promisify)(fs_1.default.unlink);
class ProjectService {
    /**
     * 创建新项目
     */
    async createProject(data) {
        try {
            const project = new project_model_1.default({
                ...data,
                status: project_types_1.ProjectStatus.PENDING,
                priority: data.priority || project_types_1.ProjectPriority.MEDIUM,
                progress: {
                    completionPercentage: 0,
                    translatedWords: 0,
                    totalWords: 0
                }
            });
            await project.save();
            logger_1.default.info(`Project created: ${project.id}`);
            return project;
        }
        catch (error) {
            if (error.code === 11000) {
                throw new errors_1.ConflictError('项目名称已存在');
            }
            throw error;
        }
    }
    /**
     * 获取用户的项目列表
     */
    async getUserProjects(userId, options) {
        const query = { managerId: userId };
        if (options.status) {
            query.status = options.status;
        }
        if (options.priority) {
            query.priority = options.priority;
        }
        if (options.search) {
            query.name = { $regex: options.search, $options: 'i' };
        }
        const page = options.page || 1;
        const limit = options.limit || 10;
        const skip = (page - 1) * limit;
        const [projects, total] = await Promise.all([
            project_model_1.default.find(query)
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit),
            project_model_1.default.countDocuments(query)
        ]);
        return {
            projects,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
    /**
     * 获取项目详情
     */
    async getProjectById(projectId, userId) {
        const project = await project_model_1.default.findOne({
            _id: new mongoose_1.Types.ObjectId(projectId),
            managerId: userId
        });
        if (!project) {
            throw new errors_1.NotFoundError('项目不存在或您没有权限访问');
        }
        const projectObj = project.toObject();
        const { toObject, save, deleteOne, ...cleanResult } = projectObj;
        return {
            ...cleanResult,
            _id: cleanResult._id.toString(),
            id: cleanResult.id
        };
    }
    /**
     * 更新项目信息
     */
    async updateProject(projectId, userId, updateData) {
        const project = await project_model_1.default.findOne({
            _id: new mongoose_1.Types.ObjectId(projectId),
            managerId: userId
        });
        if (!project) {
            throw new errors_1.NotFoundError('项目不存在或无权访问');
        }
        Object.assign(project, updateData);
        await project.save();
        logger_1.default.info(`Project updated: ${project.id}`);
        const result = project.toObject();
        const { toObject, save, ...cleanResult } = result;
        return cleanResult;
    }
    /**
     * 删除项目
     */
    async deleteProject(projectId, userId) {
        const project = await project_model_1.default.findOne({
            _id: new mongoose_1.Types.ObjectId(projectId),
            managerId: userId
        });
        if (!project) {
            throw new errors_1.NotFoundError('项目不存在或无权访问');
        }
        await project.deleteOne();
        await file_model_1.File.deleteMany({ projectId: new mongoose_1.Types.ObjectId(projectId) });
        logger_1.default.info(`Project deleted: ${project.id}`);
        return { success: true };
    }
    /**
     * 上传项目文件
     */
    async uploadProjectFile(projectId, userId, fileData) {
        const project = await project_model_1.default.findById(projectId);
        if (!project) {
            throw new errors_1.NotFoundError('项目不存在');
        }
        if (project.managerId.toString() !== userId) {
            throw new errors_1.ForbiddenError('无权访问此项目');
        }
        const fileType = fileData.mimeType.split('/')[1];
        if (!Object.values(file_model_1.FileType).includes(fileType)) {
            throw new errors_1.ValidationError('不支持的文件类型');
        }
        // 上传文件到 S3
        const key = `projects/${projectId}/${Date.now()}-${fileData.originalName}`;
        const s3Url = await (0, s3_1.uploadToS3)(fileData.filePath, key, fileData.mimeType);
        const file = await file_model_1.File.create({
            projectId: new mongoose_1.Types.ObjectId(projectId),
            fileName: fileData.originalName,
            originalName: fileData.originalName,
            fileSize: fileData.fileSize,
            mimeType: fileData.mimeType,
            type: fileType,
            status: file_model_1.FileStatus.PENDING,
            uploadedBy: new mongoose_1.Types.ObjectId(userId),
            storageUrl: s3Url,
            path: fileData.filePath,
            metadata: {
                sourceLanguage: fileData.sourceLanguage || project.sourceLanguage,
                targetLanguage: fileData.targetLanguage || project.targetLanguage,
                category: fileData.category,
                tags: fileData.tags
            }
        });
        logger_1.default.info(`File ${file.id} uploaded successfully to project ${projectId}`);
        return file;
    }
    /**
     * 处理文件
     */
    async processFile(fileId, userId) {
        const file = await file_model_1.File.findById(fileId);
        if (!file) {
            throw new errors_1.NotFoundError('文件不存在');
        }
        const project = await project_model_1.default.findById(file.projectId);
        if (!project) {
            throw new errors_1.NotFoundError('项目不存在');
        }
        if (project.managerId.toString() !== userId) {
            throw new errors_1.ForbiddenError('没有权限处理文件');
        }
        try {
            file.status = file_model_1.FileStatus.PROCESSING;
            file.processingStartedAt = new Date();
            await file.save();
            // 从 S3 获取文件内容
            const fileContent = await (0, s3_1.getFileContent)(file.path);
            // 处理文件
            const segments = await (0, fileProcessor_1.processFile)(fileContent, file.type);
            // 创建段落记录
            const segmentDocs = segments.map(segment => ({
                ...segment,
                fileId: file._id
            }));
            await segment_model_1.Segment.insertMany(segmentDocs);
            // 更新文件状态
            file.status = file_model_1.FileStatus.TRANSLATED;
            file.processingCompletedAt = new Date();
            file.segmentCount = segments.length;
            await file.save();
            // 更新项目进度
            await this.updateProjectProgress(project._id.toString(), userId, {
                completionPercentage: 0,
                translatedWords: 0,
                totalWords: 0
            });
        }
        catch (error) {
            const err = error;
            file.status = file_model_1.FileStatus.ERROR;
            file.error = err.message || '处理文件时发生错误';
            file.errorDetails = err.stack || '';
            await file.save();
            throw error;
        }
    }
    /**
     * 获取项目文件列表
     */
    async getProjectFiles(projectId, userId) {
        const project = await project_model_1.default.findById(projectId);
        if (!project) {
            throw new errors_1.NotFoundError('项目不存在');
        }
        if (project.managerId.toString() !== userId) {
            throw new errors_1.ForbiddenError('无权访问此项目');
        }
        const files = await file_model_1.File.find({ projectId: new mongoose_1.Types.ObjectId(projectId) });
        return files.map(file => file.toObject());
    }
    /**
     * 获取文件段落列表
     */
    async getFileSegments(fileId, userId, filters = {}) {
        const { status, page = 1, limit = 50 } = filters;
        // 获取文件信息
        const file = await file_model_1.File.findById(fileId);
        if (!file) {
            throw new errors_1.NotFoundError('文件不存在');
        }
        // 检查用户权限（通过项目关联）
        const project = await project_model_1.default.findById(file.projectId);
        if (!project) {
            throw new errors_1.NotFoundError('关联项目不存在');
        }
        const isManager = project.managerId.toString() === userId;
        const isReviewer = project.reviewers?.some(reviewer => reviewer.toString() === userId);
        if (!isManager && !isReviewer) {
            throw new errors_1.ForbiddenError('无权访问此文件的段落');
        }
        // 构建查询条件
        const query = { file: fileId };
        if (status) {
            query.status = status;
        }
        // 计算总数
        const total = await segment_model_1.Segment.countDocuments(query);
        // 获取段落列表
        const segments = await segment_model_1.Segment.find(query)
            .sort({ index: 1 })
            .skip((page - 1) * limit)
            .limit(limit);
        return {
            segments,
            total,
            page,
            limit
        };
    }
    /**
     * 更新文件进度
     */
    async updateFileProgress(fileId, userId) {
        const file = await file_model_1.File.findById(fileId);
        if (!file) {
            throw new errors_1.NotFoundError('文件不存在');
        }
        const project = await project_model_1.default.findById(file.projectId);
        if (!project) {
            throw new errors_1.NotFoundError('项目不存在');
        }
        if (project.managerId.toString() !== userId) {
            throw new errors_1.ForbiddenError('没有权限更新文件进度');
        }
        // 获取文件段落的统计信息
        const segments = await segment_model_1.Segment.find({ fileId });
        const translatedCount = segments.filter(s => s.status === segment_model_1.SegmentStatus.TRANSLATED).length;
        const reviewedCount = segments.filter(s => s.status === segment_model_1.SegmentStatus.COMPLETED).length;
        const totalCount = segments.length;
        // 更新文件进度
        file.progress = {
            total: totalCount,
            completed: reviewedCount,
            translated: translatedCount,
            percentage: totalCount > 0 ? (reviewedCount / totalCount) * 100 : 0
        };
        // 更新文件状态
        if (reviewedCount === totalCount) {
            file.status = file_model_1.FileStatus.COMPLETED;
        }
        else if (translatedCount > 0) {
            file.status = file_model_1.FileStatus.TRANSLATED;
        }
        await file.save();
        // 更新项目进度
        await this.updateProjectProgress(project._id.toString(), userId, {
            completionPercentage: 0,
            translatedWords: translatedCount,
            totalWords: totalCount
        });
    }
    /**
     * 更新项目进度
     */
    async updateProjectProgress(projectId, userId, data) {
        const project = await project_model_1.default.findById(projectId);
        if (!project) {
            throw new errors_1.NotFoundError('项目不存在');
        }
        if (project.managerId.toString() !== userId) {
            throw new errors_1.ForbiddenError('没有权限更新项目进度');
        }
        project.progress = {
            completionPercentage: data.completionPercentage,
            translatedWords: data.translatedWords,
            totalWords: data.totalWords
        };
        if (data.completionPercentage === 100) {
            project.status = project_types_1.ProjectStatus.COMPLETED;
        }
        else if (data.completionPercentage > 0) {
            project.status = project_types_1.ProjectStatus.IN_PROGRESS;
        }
        await project.save();
        logger_1.default.info(`Project progress updated: ${project.id}`);
        return project;
    }
}
exports.ProjectService = ProjectService;
exports.projectService = new ProjectService();
