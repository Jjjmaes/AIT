// src/services/project.service.ts

import { Types } from 'mongoose';
import Project, { IProject } from '../models/project.model';
import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from '../utils/errors';
import { 
  CreateProjectDto, 
  UpdateProjectDto, 
  ProjectProgressDto,
  ProjectStatus,
  ProjectPriority
} from '../types/project.types';
import logger from '../utils/logger';
import { File, IFile, FileStatus, FileType } from '../models/file.model';
import { Segment, ISegment, SegmentStatus } from '../models/segment.model';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import mime from 'mime-types';
import { uploadToS3, deleteFromS3, getFileContent } from '../utils/s3';
import { processFile as processFileUtil } from '../utils/fileProcessor';

const unlinkAsync = promisify(fs.unlink);

// 定义项目创建DTO
export interface CreateProjectDTO {
  name: string;
  description?: string;
  sourceLanguage: string;
  targetLanguage: string;
  managerId: Types.ObjectId;
  reviewers?: Types.ObjectId[];
  translationPromptTemplate: string;
  reviewPromptTemplate: string;
  deadline?: Date;
  priority?: ProjectPriority;
}

// 定义项目更新DTO
export interface UpdateProjectDTO {
  name?: string;
  description?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  manager?: string;
  reviewers?: string[];
  translationPromptTemplate?: string;
  reviewPromptTemplate?: string;
  deadline?: Date;
  priority?: ProjectPriority;
  status?: ProjectStatus;
}

// 定义文件上传DTO
export interface UploadFileDTO {
  originalName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
}

export class ProjectService {
  /**
   * 创建新项目
   */
  async createProject(data: CreateProjectDto): Promise<IProject> {
    try {
      const project = new Project({
        ...data,
        status: ProjectStatus.PENDING,
        priority: data.priority || ProjectPriority.MEDIUM,
        progress: {
          completionPercentage: 0,
          translatedWords: 0,
          totalWords: 0
        }
      });

      await project.save();
      logger.info(`Project created: ${project.id}`);
      return project;
    } catch (error) {
      if ((error as any).code === 11000) {
        throw new ConflictError('项目名称已存在');
      }
      throw error;
    }
  }

  /**
   * 获取用户的项目列表
   */
  async getUserProjects(userId: string, options: {
    status?: ProjectStatus;
    priority?: ProjectPriority;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const query: any = { managerId: userId };
    
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
      Project.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Project.countDocuments(query)
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
  async getProjectById(projectId: string, userId: string): Promise<any> {
    const project = await Project.findOne({
      _id: new Types.ObjectId(projectId),
      managerId: userId
    });

    if (!project) {
      throw new NotFoundError('项目不存在或您没有权限访问');
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
  async updateProject(projectId: string, userId: string, updateData: UpdateProjectDto) {
    const project = await Project.findOne({
      _id: new Types.ObjectId(projectId),
      managerId: userId
    });

    if (!project) {
      throw new NotFoundError('项目不存在或无权访问');
    }

    Object.assign(project, updateData);
    await project.save();
    logger.info(`Project updated: ${project.id}`);

    const result = project.toObject();
    const { toObject, save, ...cleanResult } = result;
    return cleanResult;
  }

  /**
   * 删除项目
   */
  async deleteProject(projectId: string, userId: string) {
    const project = await Project.findOne({
      _id: new Types.ObjectId(projectId),
      managerId: userId
    });

    if (!project) {
      throw new NotFoundError('项目不存在或无权访问');
    }

    await project.deleteOne();
    await File.deleteMany({ projectId: new Types.ObjectId(projectId) });
    logger.info(`Project deleted: ${project.id}`);

    return { success: true };
  }

  /**
   * 上传项目文件
   */
  async uploadProjectFile(projectId: string, userId: string, fileData: any) {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    if (project.managerId.toString() !== userId) {
      throw new ForbiddenError('无权访问此项目');
    }

    const fileType = fileData.mimeType.split('/')[1] as FileType;
    if (!Object.values(FileType).includes(fileType)) {
      throw new ValidationError('不支持的文件类型');
    }

    // 上传文件到 S3
    const key = `projects/${projectId}/${Date.now()}-${fileData.originalName}`;
    const s3Url = await uploadToS3(fileData.filePath, key, fileData.mimeType);

    const file = new File({
      ...fileData,
      projectId: new Types.ObjectId(projectId),
      uploadedBy: userId,
      status: FileStatus.PENDING,
      type: fileType,
      s3Url
    });

    await file.save();
    logger.info(`File ${file.id} uploaded successfully to project ${projectId}`);

    const result = file.toObject();
    const { toObject, ...cleanResult } = result;
    return cleanResult;
  }

  /**
   * 处理文件
   */
  async processFile(fileId: string, userId: string): Promise<void> {
    const file = await File.findById(fileId);
    if (!file) {
      throw new NotFoundError('文件不存在');
    }

    const project = await Project.findById(file.projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    if (project.managerId.toString() !== userId) {
      throw new ForbiddenError('没有权限处理文件');
    }

    try {
      file.status = FileStatus.PROCESSING;
      file.processingStartedAt = new Date();
      await file.save();

      // 从 S3 获取文件内容
      const fileContent = await getFileContent(file.path);

      // 处理文件
      const segments = await processFileUtil(fileContent, file.type);

      // 创建段落记录
      const segmentDocs = segments.map(segment => ({
        ...segment,
        fileId: file._id
      }));
      await Segment.insertMany(segmentDocs);

      // 更新文件状态
      file.status = FileStatus.TRANSLATED;
      file.processingCompletedAt = new Date();
      file.segmentCount = segments.length;
      await file.save();

      // 更新项目进度
      await this.updateProjectProgress(project._id.toString(), userId, {
        completionPercentage: 0,
        translatedWords: 0,
        totalWords: 0
      });
    } catch (error) {
      const err = error as Error;
      file.status = FileStatus.ERROR;
      file.error = err.message || '处理文件时发生错误';
      file.errorDetails = err.stack || '';
      await file.save();
      throw error;
    }
  }

  /**
   * 获取项目文件列表
   */
  async getProjectFiles(projectId: string, userId: string) {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    if (project.managerId.toString() !== userId) {
      throw new ForbiddenError('无权访问此项目');
    }

    const files = await File.find({ projectId: new Types.ObjectId(projectId) });
    return files.map(file => {
      const result = file.toObject();
      const { toObject, ...cleanResult } = result;
      return cleanResult;
    });
  }

  /**
   * 获取文件段落列表
   */
  async getFileSegments(
    fileId: string,
    userId: string,
    filters: {
      status?: SegmentStatus,
      page?: number,
      limit?: number
    } = {}
  ): Promise<{ segments: ISegment[], total: number, page: number, limit: number }> {
    const { status, page = 1, limit = 50 } = filters;

    // 获取文件信息
    const file = await File.findById(fileId);

    if (!file) {
      throw new NotFoundError('文件不存在');
    }

    // 检查用户权限（通过项目关联）
    const project = await Project.findById(file.projectId);
    if (!project) {
      throw new NotFoundError('关联项目不存在');
    }

    const isManager = project.managerId.toString() === userId;
    const isReviewer = project.reviewers?.some(reviewer => 
      reviewer.toString() === userId
    );

    if (!isManager && !isReviewer) {
      throw new ForbiddenError('无权访问此文件的段落');
    }

    // 构建查询条件
    const query: any = { file: fileId };

    if (status) {
      query.status = status;
    }

    // 计算总数
    const total = await Segment.countDocuments(query);

    // 获取段落列表
    const segments = await Segment.find(query)
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
  async updateFileProgress(fileId: string, userId: string): Promise<void> {
    const file = await File.findById(fileId);
    if (!file) {
      throw new NotFoundError('文件不存在');
    }

    const project = await Project.findById(file.projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    if (project.managerId.toString() !== userId) {
      throw new ForbiddenError('没有权限更新文件进度');
    }

    // 获取文件段落的统计信息
    const segments = await Segment.find({ fileId });
    const translatedCount = segments.filter(s => s.status === SegmentStatus.TRANSLATED).length;
    const reviewedCount = segments.filter(s => s.status === SegmentStatus.COMPLETED).length;

    // 更新项目进度
    await this.updateProjectProgress(project._id.toString(), userId, {
      completionPercentage: 0,
      translatedWords: translatedCount,
      totalWords: segments.length
    });
  }

  /**
   * 更新项目进度
   */
  async updateProjectProgress(projectId: string, userId: string, data: ProjectProgressDto): Promise<IProject> {
    const project = await Project.findOne({
      _id: projectId,
      managerId: userId
    });

    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    project.progress = {
      completionPercentage: data.completionPercentage,
      translatedWords: data.translatedWords,
      totalWords: data.totalWords
    };

    if (data.completionPercentage === 100) {
      project.status = ProjectStatus.COMPLETED;
    } else if (data.completionPercentage > 0) {
      project.status = ProjectStatus.IN_PROGRESS;
    }

    await project.save();
    logger.info(`Project progress updated: ${project.id}`);
    return project;
  }
}

export const projectService = new ProjectService();