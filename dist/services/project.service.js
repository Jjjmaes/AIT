"use strict";
// src/services/project.service.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const project_model_1 = __importStar(require("../models/project.model"));
const file_model_1 = __importStar(require("../models/file.model"));
const segment_model_1 = __importStar(require("../models/segment.model"));
const errors_1 = require("../utils/errors");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const unlinkAsync = (0, util_1.promisify)(fs_1.default.unlink);
class ProjectService {
    /**
     * 创建新项目
     */
    async createProject(userId, projectData) {
        try {
            // 设置默认值
            const manager = projectData.manager || userId;
            const reviewers = projectData.reviewers || [];
            // 确保创建者在审阅者列表中（如果不是管理者）
            if (manager !== userId && !reviewers.includes(userId)) {
                reviewers.push(userId);
            }
            const newProject = new project_model_1.default({
                ...projectData,
                manager,
                reviewers,
                progress: {
                    totalSegments: 0,
                    translatedSegments: 0,
                    reviewedSegments: 0
                },
                status: project_model_1.ProjectStatus.DRAFT,
                priority: projectData.priority || project_model_1.ProjectPriority.MEDIUM
            });
            await newProject.save();
            return newProject;
        }
        catch (error) {
            if (error.code === 11000) {
                throw new errors_1.ValidationError('项目名称已存在');
            }
            throw error;
        }
    }
    /**
     * 获取单个项目信息
     */
    async getProjectById(projectId, userId) {
        const project = await project_model_1.default.findById(projectId)
            .populate('manager', 'username email displayName')
            .populate('reviewers', 'username email displayName')
            .populate('translationPromptTemplate', 'name')
            .populate('reviewPromptTemplate', 'name');
        if (!project) {
            throw new errors_1.NotFoundError('项目不存在');
        }
        // 检查用户是否有权限查看项目
        const isManager = project.manager._id.toString() === userId;
        const isReviewer = project.reviewers.some((user) => user._id.toString() === userId);
        if (!isManager && !isReviewer) {
            throw new errors_1.ForbiddenError('无权访问此项目');
        }
        return project;
    }
    /**
     * 获取用户关联的所有项目
     */
    async getUserProjects(userId, filters = {}) {
        const { status, priority, search, limit = 10, page = 1 } = filters;
        // 构建查询条件
        const query = {
            $or: [
                { manager: userId },
                { reviewers: userId }
            ]
        };
        if (status) {
            query.status = status;
        }
        if (priority) {
            query.priority = priority;
        }
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        // 计算总数
        const total = await project_model_1.default.countDocuments(query);
        // 获取项目列表
        const projects = await project_model_1.default.find(query)
            .populate('manager', 'username email displayName')
            .populate('reviewers', 'username email displayName')
            .populate('translationPromptTemplate', 'name')
            .populate('reviewPromptTemplate', 'name')
            .sort({ updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        return {
            projects,
            total,
            page,
            limit
        };
    }
    /**
     * 更新项目信息
     */
    async updateProject(projectId, userId, updateData) {
        const project = await project_model_1.default.findById(projectId);
        if (!project) {
            throw new errors_1.NotFoundError('项目不存在');
        }
        // 检查用户是否有权限更新项目
        if (project.manager.toString() !== userId) {
            throw new errors_1.ForbiddenError('只有项目管理者可以修改项目信息');
        }
        // 更新项目信息
        Object.assign(project, updateData);
        await project.save();
        return this.getProjectById(projectId, userId);
    }
    /**
     * 删除项目
     */
    async deleteProject(projectId, userId) {
        const project = await project_model_1.default.findById(projectId);
        if (!project) {
            throw new errors_1.NotFoundError('项目不存在');
        }
        // 检查用户是否有权限删除项目
        if (project.manager.toString() !== userId) {
            throw new errors_1.ForbiddenError('只有项目管理者可以删除项目');
        }
        // 已经有进度的项目不能删除，只能归档
        if (project.progress.totalSegments > 0) {
            project.status = project_model_1.ProjectStatus.ARCHIVED;
            await project.save();
            return {
                success: true,
                message: '项目已归档，因为已存在翻译进度，不能直接删除'
            };
        }
        // 删除项目相关的文件和段落
        const files = await file_model_1.default.find({ project: projectId });
        // 删除物理文件
        for (const file of files) {
            if (fs_1.default.existsSync(file.path)) {
                await unlinkAsync(file.path);
            }
        }
        // 删除数据库记录
        await segment_model_1.default.deleteMany({ file: { $in: files.map(f => f._id) } });
        await file_model_1.default.deleteMany({ project: projectId });
        await project_model_1.default.findByIdAndDelete(projectId);
        return {
            success: true,
            message: '项目已成功删除'
        };
    }
    /**
     * 上传项目文件
     */
    async uploadProjectFile(projectId, userId, fileData) {
        // 检查项目是否存在
        const project = await project_model_1.default.findById(projectId);
        if (!project) {
            // 删除上传的文件
            await unlinkAsync(fileData.filePath);
            throw new errors_1.NotFoundError('项目不存在');
        }
        // 检查用户是否有权限上传文件
        const isManager = project.manager.toString() === userId;
        const isReviewer = project.reviewers.some((id) => id.toString() === userId);
        if (!isManager && !isReviewer) {
            // 删除上传的文件
            await unlinkAsync(fileData.filePath);
            throw new errors_1.ForbiddenError('无权访问此项目');
        }
        // 确定文件类型
        const fileExtension = path_1.default.extname(fileData.originalName).toLowerCase().substring(1);
        let fileType;
        switch (fileExtension) {
            case 'docx':
            case 'doc':
                fileType = file_model_1.FileType.DOCX;
                break;
            case 'txt':
                fileType = file_model_1.FileType.TXT;
                break;
            case 'html':
            case 'htm':
                fileType = file_model_1.FileType.HTML;
                break;
            case 'xml':
                fileType = file_model_1.FileType.XML;
                break;
            case 'json':
                fileType = file_model_1.FileType.JSON;
                break;
            case 'md':
                fileType = file_model_1.FileType.MARKDOWN;
                break;
            case 'csv':
                fileType = file_model_1.FileType.CSV;
                break;
            case 'xlsx':
            case 'xls':
                fileType = file_model_1.FileType.EXCEL;
                break;
            default:
                // 不支持的文件类型
                await unlinkAsync(fileData.filePath);
                throw new errors_1.ValidationError(`不支持的文件类型: ${fileExtension}`);
        }
        // 创建文件记录
        const file = new file_model_1.default({
            name: fileData.fileName,
            originalName: fileData.originalName,
            project: projectId,
            path: fileData.filePath,
            type: fileType,
            size: fileData.fileSize,
            status: file_model_1.FileStatus.PENDING
        });
        await file.save();
        // 如果项目是草稿状态，更新为进行中
        if (project.status === project_model_1.ProjectStatus.DRAFT) {
            project.status = project_model_1.ProjectStatus.IN_PROGRESS;
            await project.save();
        }
        // 注意：实际应用中这里应该使用队列系统(如Bull)来处理文件分段
        // 为了简化演示，我们这里只返回文件信息
        // this.processFile(file._id);
        return file;
    }
    /**
     * 处理文件分段（简化版，实际应用中会更复杂）
     */
    async processFile(fileId) {
        const file = await file_model_1.default.findById(fileId);
        if (!file) {
            throw new errors_1.NotFoundError('文件不存在');
        }
        try {
            // 更新文件状态为处理中
            file.status = file_model_1.FileStatus.PROCESSING;
            file.processingStartedAt = new Date();
            await file.save();
            // 读取文件内容
            const fileContent = fs_1.default.readFileSync(file.path, 'utf8');
            // 简单地按段落分割文本（实际应用中需要更复杂的逻辑）
            const segments = fileContent
                .split(/\n\s*\n/)
                .filter((segment) => segment.trim().length > 0);
            // 创建段落记录
            const segmentPromises = segments.map((text, index) => {
                const segment = new segment_model_1.default({
                    file: file._id,
                    index: index + 1,
                    sourceText: text.trim(),
                    status: segment_model_1.SegmentStatus.PENDING
                });
                return segment.save();
            });
            await Promise.all(segmentPromises);
            // 更新文件状态和段落数量
            file.status = file_model_1.FileStatus.TRANSLATED;
            file.segmentCount = segments.length;
            file.processingCompletedAt = new Date();
            await file.save();
            // 更新项目统计
            const project = await project_model_1.default.findById(file.project);
            if (project) {
                project.progress.totalSegments += segments.length;
                await project.save();
            }
        }
        catch (error) {
            // 处理错误
            file.status = file_model_1.FileStatus.ERROR;
            file.errorDetails = error instanceof Error ? error.message : String(error);
            await file.save();
            throw error;
        }
    }
    /**
     * 获取项目文件列表
     */
    async getProjectFiles(projectId, userId) {
        // 检查项目是否存在以及用户权限
        await this.getProjectById(projectId, userId);
        // 获取文件列表
        return file_model_1.default.find({
            project: projectId
        }).sort({ createdAt: -1 });
    }
    /**
     * 获取文件段落列表
     */
    async getFileSegments(fileId, userId, filters = {}) {
        const { status, page = 1, limit = 50 } = filters;
        // 获取文件信息
        const file = await file_model_1.default.findById(fileId);
        if (!file) {
            throw new errors_1.NotFoundError('文件不存在');
        }
        // 检查用户权限（通过项目关联）
        const project = await project_model_1.default.findById(file.project);
        if (!project) {
            throw new errors_1.NotFoundError('关联项目不存在');
        }
        const isManager = project.manager.toString() === userId;
        const isReviewer = project.reviewers.some(reviewer => reviewer.toString() === userId);
        if (!isManager && !isReviewer) {
            throw new errors_1.ForbiddenError('无权访问此文件的段落');
        }
        // 构建查询条件
        const query = { file: fileId };
        if (status) {
            query.status = status;
        }
        // 计算总数
        const total = await segment_model_1.default.countDocuments(query);
        // 获取段落列表
        const segments = await segment_model_1.default.find(query)
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
     * 更新文件和项目进度统计
     */
    async updateFileProgress(fileId) {
        const file = await file_model_1.default.findById(fileId);
        if (!file) {
            throw new errors_1.NotFoundError('文件不存在');
        }
        // 计算已翻译和已审阅的段落数量
        const translatedCount = await segment_model_1.default.countDocuments({
            file: fileId,
            status: { $in: [segment_model_1.SegmentStatus.TRANSLATED, segment_model_1.SegmentStatus.REVIEWING, segment_model_1.SegmentStatus.REVIEWED, segment_model_1.SegmentStatus.COMPLETED] }
        });
        const reviewedCount = await segment_model_1.default.countDocuments({
            file: fileId,
            status: { $in: [segment_model_1.SegmentStatus.REVIEWED, segment_model_1.SegmentStatus.COMPLETED] }
        });
        // 更新文件统计
        file.translatedCount = translatedCount;
        file.reviewedCount = reviewedCount;
        // 更新文件状态
        if (file.segmentCount > 0 && reviewedCount === file.segmentCount) {
            file.status = file_model_1.FileStatus.COMPLETED;
        }
        else if (translatedCount > 0) {
            file.status = reviewedCount > 0 ? file_model_1.FileStatus.REVIEWING : file_model_1.FileStatus.TRANSLATED;
        }
        await file.save();
        // 更新项目统计
        await this.updateProjectProgress(file.project.toString());
    }
    /**
     * 计算项目进度统计
     */
    async updateProjectProgress(projectId) {
        // 获取项目所有文件
        const files = await file_model_1.default.find({
            project: projectId
        });
        // 计算总段落数、已翻译段落数和已审校段落数
        let totalSegments = 0;
        let translatedSegments = 0;
        let reviewedSegments = 0;
        for (const file of files) {
            totalSegments += file.segmentCount;
            translatedSegments += file.translatedCount;
            reviewedSegments += file.reviewedCount;
        }
        // 更新项目进度
        await project_model_1.default.findByIdAndUpdate(projectId, {
            'progress.totalSegments': totalSegments,
            'progress.translatedSegments': translatedSegments,
            'progress.reviewedSegments': reviewedSegments
        });
        // 更新项目状态
        const project = await project_model_1.default.findById(projectId);
        if (project) {
            // 如果所有段落都已审校，更新项目状态为已完成
            if (totalSegments > 0 && reviewedSegments === totalSegments) {
                project.status = project_model_1.ProjectStatus.COMPLETED;
                await project.save();
            }
            else if (project.status === project_model_1.ProjectStatus.DRAFT && totalSegments > 0) {
                // 如果项目还是草稿状态但已有段落，更新为进行中
                project.status = project_model_1.ProjectStatus.IN_PROGRESS;
                await project.save();
            }
        }
    }
}
exports.default = new ProjectService();
