// src/services/project.service.ts

import { Project, IProject, ProjectStatus, ProjectPriority } from '../models/project.model';
import { File, IFile, FileStatus, FileType } from '../models/file.model';
import { Segment, ISegment, SegmentStatus } from '../models/segment.model';
import mongoose, { Types } from 'mongoose';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import mime from 'mime-types';
import { uploadToS3, deleteFromS3, getFileContent } from '../utils/s3';
import { processFile } from '../utils/fileProcessor';

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
  async createProject(data: Partial<IProject>): Promise<IProject> {
    const project = new Project(data);
    return project.save();
  }

  /**
   * 获取单个项目信息
   */
  async getProjectById(projectId: string, userId: string): Promise<IProject> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    // 检查用户权限
    if (project.managerId.toString() !== userId && 
        !project.reviewers?.some(reviewer => reviewer.toString() === userId)) {
      throw new ForbiddenError('没有权限访问此项目');
    }

    return project;
  }

  /**
   * 获取用户关联的所有项目
   */
  async getUserProjects(
    userId: string, 
    filters: { 
      status?: ProjectStatus, 
      priority?: ProjectPriority,
      search?: string,
      limit?: number,
      page?: number
    } = {}
  ): Promise<{ projects: IProject[], total: number, page: number, limit: number }> {
    const { status, priority, search, limit = 10, page = 1 } = filters;
    
    // 构建查询条件
    const query: any = {
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
    const total = await Project.countDocuments(query);

    // 获取项目列表
    const projects = await Project.find(query)
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
  async updateProject(projectId: string, userId: string, data: UpdateProjectDTO): Promise<IProject> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    if (project.managerId.toString() !== userId) {
      throw new ForbiddenError('没有权限更新项目');
    }

    // 转换字符串ID为ObjectId
    const updateData: Partial<IProject> = {
      ...data,
      managerId: data.manager ? new mongoose.Types.ObjectId(data.manager) : undefined,
      reviewers: data.reviewers?.map(id => new mongoose.Types.ObjectId(id))
    };

    Object.assign(project, updateData);
    return project.save();
  }

  /**
   * 删除项目
   */
  async deleteProject(projectId: string, userId: string): Promise<{ message: string }> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    if (project.managerId.toString() !== userId) {
      throw new ForbiddenError('没有权限删除项目');
    }

    // 删除项目相关的文件
    const files = await File.find({ projectId });
    for (const file of files) {
      await deleteFromS3(file.path);
    }

    // 删除项目相关的段落
    await Segment.deleteMany({ fileId: { $in: files.map(f => f._id) } });
    await File.deleteMany({ projectId });
    await Project.deleteOne({ _id: projectId });

    return { message: '项目删除成功' };
  }

  /**
   * 上传项目文件
   */
  async uploadProjectFile(
    projectId: string,
    userId: string,
    fileData: {
      originalName: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      filePath: string;
    }
  ): Promise<IFile> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    if (project.managerId.toString() !== userId) {
      throw new ForbiddenError('没有权限上传文件');
    }

    // 确定文件类型
    const fileType = fileData.mimeType.split('/')[1] as FileType;
    if (!Object.values(FileType).includes(fileType)) {
      throw new Error('不支持的文件类型');
    }

    // 上传文件到 S3
    const key = `projects/${projectId}/${Date.now()}-${fileData.originalName}`;
    const fileUrl = await uploadToS3(fileData.filePath, key, fileData.mimeType);

    // 创建文件记录
    const newFile = new File({
      projectId,
      fileName: fileData.fileName,
      originalName: fileData.originalName,
      fileSize: fileData.fileSize,
      mimeType: fileData.mimeType,
      type: fileType,
      status: FileStatus.PENDING,
      path: key
    });

    return newFile.save();
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
      const segments = await processFile(fileContent, file.type);

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
        progress: {
          totalSegments: segments.length,
          translatedSegments: 0,
          reviewedSegments: 0
        }
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
  async getProjectFiles(
    projectId: string,
    userId: string
  ): Promise<IFile[]> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    if (project.managerId.toString() !== userId) {
      throw new ForbiddenError('没有权限查看项目文件');
    }

    return File.find({ projectId });
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
    const isReviewer = project.reviewers?.some((reviewer: Types.ObjectId) => 
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
      progress: {
        totalSegments: segments.length,
        translatedSegments: translatedCount,
        reviewedSegments: reviewedCount
      }
    });
  }

  /**
   * 更新项目进度
   */
  async updateProjectProgress(
    projectId: string,
    userId: string,
    updateData: {
      status?: ProjectStatus;
      progress?: {
        totalSegments?: number;
        translatedSegments?: number;
        reviewedSegments?: number;
      };
    }
  ): Promise<void> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    // 检查用户权限
    if (project.managerId.toString() !== userId) {
      throw new ForbiddenError('没有权限更新项目进度');
    }

    // 更新项目状态
    if (updateData.status) {
      project.status = updateData.status;
    }

    // 更新进度
    if (updateData.progress) {
      const { totalSegments, translatedSegments, reviewedSegments } = updateData.progress;
      
      if (totalSegments !== undefined) {
        project.progress.totalSegments = totalSegments;
      }
      if (translatedSegments !== undefined) {
        project.progress.translatedSegments = translatedSegments;
      }
      if (reviewedSegments !== undefined) {
        project.progress.reviewedSegments = reviewedSegments;
      }

      // 计算完成百分比
      if (project.progress.totalSegments > 0) {
        project.progress.completionPercentage = Math.round(
          (project.progress.translatedSegments / project.progress.totalSegments) * 100
        );
      }
    }

    await project.save();
  }
}

export const projectService = new ProjectService();