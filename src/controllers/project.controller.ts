// src/controllers/project.controller.ts

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { ValidationError, UnauthorizedError } from '../utils/errors';
import multer from 'multer';
import { ProjectService } from '../services/project.service';
import { validateRequest } from '../middleware/validate.middleware';
import { createProjectSchema, updateProjectSchema, projectProgressSchema } from '../schemas/project.schema';
import { fileUploadConfig } from '../config/upload.config';
import logger from '../utils/logger';
import { 
  ProjectStatus, 
  ProjectPriority, 
  CreateProjectDto, 
  UpdateProjectDto,
  ProjectProgressDto 
} from '../types/project.types';
import { SegmentStatus } from '../models/segment.model';
import { FileStatus, IFile } from '../models/file.model';
import { UploadFileDto } from '../services/project.service';
import { Types } from 'mongoose';

export const upload = multer(fileUploadConfig);

const projectService = new ProjectService();

export default class ProjectController {
  /**
   * 创建新项目
   */
  async createProject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('未授权的访问');
      }

      const validationResult = createProjectSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new ValidationError(validationResult.error.errors[0].message);
      }

      logger.info(`User ${userId} creating new project`);
      
      const projectData: CreateProjectDto = {
        ...validationResult.data,
        managerId: userId
      };
      
      const project = await projectService.createProject(projectData);
      
      logger.info(`Project ${project.id} created successfully by user ${userId}`);
      
      res.status(201).json({
        success: true,
        data: { project }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取项目列表
   */
  async getProjects(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('未授权的访问');
      }

      const { status, priority, search, page, limit } = req.query;
      
      const result = await projectService.getUserProjects(userId, {
        status: status as ProjectStatus,
        priority: priority as ProjectPriority,
        search: search as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined
      });
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取单个项目信息
   */
  async getProject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('未授权的访问');
      }

      const { projectId } = req.params;
      
      const project = await projectService.getProjectById(projectId, userId);
      
      res.status(200).json({
        success: true,
        data: { project }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新项目信息
   */
  async updateProject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('未授权的访问');
      }

      const validationResult = updateProjectSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new ValidationError(validationResult.error.errors[0].message);
      }

      const { projectId } = req.params;
      const updateData: UpdateProjectDto = validationResult.data;
      
      logger.info(`User ${userId} updating project ${projectId}`);
      
      const project = await projectService.updateProject(projectId, userId, updateData);
      
      logger.info(`Project ${projectId} updated successfully by user ${userId}`);
      
      res.status(200).json({
        success: true,
        data: { project }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 删除项目
   */
  async deleteProject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('未授权的访问');
      }

      const { projectId } = req.params;
      
      logger.info(`User ${userId} deleting project ${projectId}`);
      
      const result = await projectService.deleteProject(projectId, userId);
      
      logger.info(`Project ${projectId} deleted successfully by user ${userId}`);
      
      res.status(200).json({
        success: true,
        message: '项目删除成功',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 上传项目文件
   */
  async uploadFile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return next(new UnauthorizedError('请先登录'));
      }

      if (!req.file) {
        return next(new ValidationError('请选择要上传的文件'));
      }

      const { originalname, path, size, mimetype } = req.file;
      const { sourceLanguage, targetLanguage, category, tags } = req.body;

      // 转换文件数据为DTO
      const fileData: UploadFileDto = {
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
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取项目文件列表
   */
  async getProjectFiles(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('未授权的访问');
      }

      const { projectId } = req.params;
      
      const files = await projectService.getProjectFiles(projectId, userId);
      
      res.status(200).json({
        success: true,
        data: { files }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 处理文件
   */
  async processFile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('未授权的访问');
      }

      const { fileId } = req.params;
      
      logger.info(`User ${userId} processing file ${fileId}`);
      
      await projectService.processFile(fileId, userId);
      
      logger.info(`File ${fileId} processed successfully`);
      
      res.status(200).json({
        success: true,
        message: '文件处理成功'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取文件段落列表
   */
  async getFileSegments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('未授权的访问');
      }

      const { fileId } = req.params;
      const { status, page, limit } = req.query;
      
      const result = await projectService.getFileSegments(fileId, userId, {
        status: status as SegmentStatus,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined
      });
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新文件进度
   */
  async updateFileProgress(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('未授权的访问');
      }

      const { fileId } = req.params;
      
      logger.info(`User ${userId} updating file progress for file ${fileId}`);
      
      await projectService.updateFileProgress(fileId, userId);
      
      logger.info(`File ${fileId} progress updated successfully`);
      
      res.status(200).json({
        success: true,
        message: '文件进度更新成功'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新项目进度
   */
  async updateProjectProgress(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('未授权的访问');
      }

      const validationResult = projectProgressSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new ValidationError(validationResult.error.errors[0].message);
      }

      const { projectId } = req.params;
      const progressData: ProjectProgressDto = validationResult.data;
      
      logger.info(`User ${userId} updating progress for project ${projectId}`);
      
      await projectService.updateProjectProgress(projectId, userId, progressData);
      
      logger.info(`Project ${projectId} progress updated successfully`);
      
      res.status(200).json({
        success: true,
        message: '项目进度更新成功'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取项目统计信息
   */
  async getProjectStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('未授权的访问');
      }

      const { projectId } = req.params;
      
      const project = await projectService.getProjectById(projectId, userId);
      const files = await projectService.getProjectFiles(projectId, userId);
      
      res.status(200).json({
        success: true,
        data: {
          project,
          files
        }
      });
    } catch (error) {
      next(error);
    }
  }
}