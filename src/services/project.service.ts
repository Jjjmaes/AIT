// src/services/project.service.ts

import Project, { IProject, ProjectStatus, ProjectPriority } from '../models/project.model';
import File, { IFile, FileStatus, FileType } from '../models/file.model';
import Segment, { ISegment, SegmentStatus } from '../models/segment.model';
import mongoose from 'mongoose';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import mime from 'mime-types';

const unlinkAsync = promisify(fs.unlink);

// 定义项目创建DTO
export interface CreateProjectDTO {
  name: string;
  description?: string;
  sourceLanguage: string;
  targetLanguage: string;
  manager?: string;
  reviewers?: string[];
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

class ProjectService {
  /**
   * 创建新项目
   */
  async createProject(
    userId: string, 
    projectData: CreateProjectDTO
  ): Promise<IProject> {
    try {
      // 设置默认值
      const manager = projectData.manager || userId;
      const reviewers = projectData.reviewers || [];
      
      // 确保创建者在审阅者列表中（如果不是管理者）
      if (manager !== userId && !reviewers.includes(userId)) {
        reviewers.push(userId);
      }

      const newProject = new Project({
        ...projectData,
        manager,
        reviewers,
        progress: {
          totalSegments: 0,
          translatedSegments: 0,
          reviewedSegments: 0
        },
        status: ProjectStatus.DRAFT,
        priority: projectData.priority || ProjectPriority.MEDIUM
      });

      await newProject.save();
      return newProject;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ValidationError('项目名称已存在');
      }
      throw error;
    }
  }

  /**
   * 获取单个项目信息
   */
  async getProjectById(
    projectId: string, 
    userId: string
  ): Promise<IProject> {
    const project = await Project.findById(projectId)
      .populate('manager', 'username email displayName')
      .populate('reviewers', 'username email displayName')
      .populate('translationPromptTemplate', 'name')
      .populate('reviewPromptTemplate', 'name');

    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    // 检查用户是否有权限查看项目
    const isManager = project.manager._id.toString() === userId;
    const isReviewer = project.reviewers.some(
      (user: any) => user._id.toString() === userId
    );

    if (!isManager && !isReviewer) {
      throw new ForbiddenError('无权访问此项目');
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
  async updateProject(
    projectId: string, 
    userId: string, 
    updateData: UpdateProjectDTO
  ): Promise<IProject> {
    const project = await Project.findById(projectId);

    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    // 检查用户是否有权限更新项目
    if (project.manager.toString() !== userId) {
      throw new ForbiddenError('只有项目管理者可以修改项目信息');
    }

    // 更新项目信息
    Object.assign(project, updateData);
    await project.save();

    return this.getProjectById(projectId, userId);
  }

  /**
   * 删除项目
   */
  async deleteProject(
    projectId: string, 
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const project = await Project.findById(projectId);

    if (!project) {
      throw new NotFoundError('项目不存在');
    }

    // 检查用户是否有权限删除项目
    if (project.manager.toString() !== userId) {
      throw new ForbiddenError('只有项目管理者可以删除项目');
    }

    // 已经有进度的项目不能删除，只能归档
    if (project.progress.totalSegments > 0) {
      project.status = ProjectStatus.ARCHIVED;
      await project.save();
      return { 
        success: true, 
        message: '项目已归档，因为已存在翻译进度，不能直接删除' 
      };
    }

    // 删除项目相关的文件和段落
    const files = await File.find({ project: projectId });
    
    // 删除物理文件
    for (const file of files) {
      if (fs.existsSync(file.path)) {
        await unlinkAsync(file.path);
      }
    }
    
    // 删除数据库记录
    await Segment.deleteMany({ file: { $in: files.map(f => f._id) } });
    await File.deleteMany({ project: projectId });
    await Project.findByIdAndDelete(projectId);

    return { 
      success: true,
      message: '项目已成功删除' 
    };
  }

  /**
   * 上传项目文件
   */
  async uploadProjectFile(
    projectId: string,
    userId: string,
    fileData: UploadFileDTO
  ): Promise<IFile> {
    // 检查项目是否存在
    const project = await Project.findById(projectId);

    if (!project) {
      // 删除上传的文件
      await unlinkAsync(fileData.filePath);
      throw new NotFoundError('项目不存在');
    }

    // 检查用户是否有权限上传文件
    const isManager = project.manager.toString() === userId;
    const isReviewer = project.reviewers.some(
      (id) => id.toString() === userId
    );

    if (!isManager && !isReviewer) {
      // 删除上传的文件
      await unlinkAsync(fileData.filePath);
      throw new ForbiddenError('无权访问此项目');
    }

    // 确定文件类型
    const fileExtension = path.extname(fileData.originalName).toLowerCase().substring(1);
    let fileType: FileType;
    
    switch (fileExtension) {
      case 'docx':
      case 'doc':
        fileType = FileType.DOCX;
        break;
      case 'txt':
        fileType = FileType.TXT;
        break;
      case 'html':
      case 'htm':
        fileType = FileType.HTML;
        break;
      case 'xml':
        fileType = FileType.XML;
        break;
      case 'json':
        fileType = FileType.JSON;
        break;
      case 'md':
        fileType = FileType.MARKDOWN;
        break;
      case 'csv':
        fileType = FileType.CSV;
        break;
      case 'xlsx':
      case 'xls':
        fileType = FileType.EXCEL;
        break;
      default:
        // 不支持的文件类型
        await unlinkAsync(fileData.filePath);
        throw new ValidationError(`不支持的文件类型: ${fileExtension}`);
    }

    // 创建文件记录
    const file = new File({
      name: fileData.fileName,
      originalName: fileData.originalName,
      project: projectId,
      path: fileData.filePath,
      type: fileType,
      size: fileData.fileSize,
      status: FileStatus.PENDING
    });

    await file.save();

    // 如果项目是草稿状态，更新为进行中
    if (project.status === ProjectStatus.DRAFT) {
      project.status = ProjectStatus.IN_PROGRESS;
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
  async processFile(fileId: string): Promise<void> {
    const file = await File.findById(fileId);

    if (!file) {
      throw new NotFoundError('文件不存在');
    }

    try {
      // 更新文件状态为处理中
      file.status = FileStatus.PROCESSING;
      file.processingStartedAt = new Date();
      await file.save();

      // 读取文件内容
      const fileContent = fs.readFileSync(file.path, 'utf8');

      // 简单地按段落分割文本（实际应用中需要更复杂的逻辑）
      const segments = fileContent
        .split(/\n\s*\n/)
        .filter((segment) => segment.trim().length > 0);

      // 创建段落记录
      const segmentPromises = segments.map((text, index) => {
        const segment = new Segment({
          file: file._id,
          index: index + 1,
          sourceText: text.trim(),
          status: SegmentStatus.PENDING
        });
        return segment.save();
      });

      await Promise.all(segmentPromises);

      // 更新文件状态和段落数量
      file.status = FileStatus.TRANSLATED;
      file.segmentCount = segments.length;
      file.processingCompletedAt = new Date();
      await file.save();

      // 更新项目统计
      const project = await Project.findById(file.project);
      if (project) {
        project.progress.totalSegments += segments.length;
        await project.save();
      }
    } catch (error) {
      // 处理错误
      file.status = FileStatus.ERROR;
      file.errorDetails = error instanceof Error ? error.message : String(error);
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
    // 检查项目是否存在以及用户权限
    await this.getProjectById(projectId, userId);

    // 获取文件列表
    return File.find({
      project: projectId
    }).sort({ createdAt: -1 });
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
    const project = await Project.findById(file.project);
    if (!project) {
      throw new NotFoundError('关联项目不存在');
    }

    const isManager = project.manager.toString() === userId;
    const isReviewer = project.reviewers.some(reviewer => 
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
   * 更新文件和项目进度统计
   */
  async updateFileProgress(fileId: string): Promise<void> {
    const file = await File.findById(fileId);
    if (!file) {
      throw new NotFoundError('文件不存在');
    }

    // 计算已翻译和已审阅的段落数量
    const translatedCount = await Segment.countDocuments({
      file: fileId,
      status: { $in: [SegmentStatus.TRANSLATED, SegmentStatus.REVIEWING, SegmentStatus.REVIEWED, SegmentStatus.COMPLETED] }
    });

    const reviewedCount = await Segment.countDocuments({
      file: fileId,
      status: { $in: [SegmentStatus.REVIEWED, SegmentStatus.COMPLETED] }
    });

    // 更新文件统计
    file.translatedCount = translatedCount;
    file.reviewedCount = reviewedCount;

    // 更新文件状态
    if (file.segmentCount > 0 && reviewedCount === file.segmentCount) {
      file.status = FileStatus.COMPLETED;
    } else if (translatedCount > 0) {
      file.status = reviewedCount > 0 ? FileStatus.REVIEWING : FileStatus.TRANSLATED;
    }

    await file.save();

    // 更新项目统计
    await this.updateProjectProgress(file.project.toString());
  }

  /**
   * 计算项目进度统计
   */
  async updateProjectProgress(
    projectId: string
  ): Promise<void> {
    // 获取项目所有文件
    const files = await File.find({
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
    await Project.findByIdAndUpdate(projectId, {
      'progress.totalSegments': totalSegments,
      'progress.translatedSegments': translatedSegments,
      'progress.reviewedSegments': reviewedSegments
    });

    // 更新项目状态
    const project = await Project.findById(projectId);
    if (project) {
      // 如果所有段落都已审校，更新项目状态为已完成
      if (totalSegments > 0 && reviewedSegments === totalSegments) {
        project.status = ProjectStatus.COMPLETED;
        await project.save();
      } else if (project.status === ProjectStatus.DRAFT && totalSegments > 0) {
        // 如果项目还是草稿状态但已有段落，更新为进行中
        project.status = ProjectStatus.IN_PROGRESS;
        await project.save();
      }
    }
  }
}

export default new ProjectService();