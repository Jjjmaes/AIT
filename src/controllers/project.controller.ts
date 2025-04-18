// src/controllers/project.controller.ts

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { ValidationError, UnauthorizedError } from '../utils/errors';
import multer from 'multer';
import { 
    ProjectService as ProjectServiceClass, 
    projectService, 
    CreateProjectDto, 
    UpdateProjectDto, 
    UploadFileDto
} from '../services/project.service';
import { validateRequest } from '../middleware/validate.middleware';
import { createProjectSchema, updateProjectSchema, projectProgressSchema } from '../schemas/project.schema';
import { fileUploadConfig } from '../config/upload.config';
import logger from '../utils/logger';
import { ProjectStatus } from '../models/project.model';
import { SegmentStatus } from '../models/segment.model';
import { FileStatus, IFile } from '../models/file.model';
import { Types } from 'mongoose';
import { IProjectProgress } from '../types/project.types';

export const upload = multer(fileUploadConfig);

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
        const errorMessage = JSON.stringify(validationResult.error.flatten());
        throw new ValidationError(errorMessage);
      }
      const validatedData = validationResult.data;

      logger.info(`User ${userId} creating new project with data: ${JSON.stringify(validatedData)}`);

      const createDto: CreateProjectDto = {
        ...validatedData,
        manager: new Types.ObjectId(userId),
        reviewers: validatedData.reviewers?.map(id => new Types.ObjectId(id)),
        defaultTranslationPromptTemplate: validatedData.defaultTranslationPromptTemplate 
            ? new Types.ObjectId(validatedData.defaultTranslationPromptTemplate) 
            : undefined,
        defaultReviewPromptTemplate: validatedData.defaultReviewPromptTemplate 
            ? new Types.ObjectId(validatedData.defaultReviewPromptTemplate) 
            : undefined,
        translationPromptTemplate: validatedData.translationPromptTemplate 
            ? new Types.ObjectId(validatedData.translationPromptTemplate) 
            : undefined,
        reviewPromptTemplate: validatedData.reviewPromptTemplate 
            ? new Types.ObjectId(validatedData.reviewPromptTemplate) 
            : undefined,
        deadline: validatedData.deadline ? new Date(validatedData.deadline) : undefined,
      };

      const project = await projectService.createProject(createDto);
      
      logger.info(`Project ${project.id} created successfully by user ${userId}`);
      
      res.status(201).json({
        success: true,
        data: { project }
      });
    } catch (error) {
      logger.error(`Error in createProject controller:`, error);
      next(error);
    }
  }

  /**
   * 获取项目列表
   */
  async getProjects(req: AuthRequest, res: Response, next: NextFunction) {
    logger.info(`[ProjectController.getProjects] Entered function for user ID (from auth): ${req.user?.id}`);
    try {
      const userId = req.user?.id;
      if (!userId) {
        logger.warn('[ProjectController.getProjects] Reached controller but req.user.id is missing!');
        throw new UnauthorizedError('未授权的访问 - 内部错误');
      }

      const { status, priority, search, page, limit } = req.query;
      
      const result = await projectService.getUserProjects(userId, {
        status: status as ProjectStatus,
        priority: priority ? parseInt(priority as string, 10) : undefined,
        search: search as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined
      });
      
      logger.info(`[ProjectController.getProjects] Service returned result for user ${userId}:`, result);
      if (result && result.projects) {
        logger.info(`[ProjectController.getProjects] Found ${result.projects.length} projects.`);
      } else {
        logger.warn('[ProjectController.getProjects] Service result is missing projects array or is invalid.');
      }
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`[ProjectController.getProjects] Error caught:`, error);
      next(error);
    }
  }

  /**
   * 获取单个项目信息
   */
  async getProject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const userRoles = req.user?.role ? [req.user.role] : [];
      if (!userId) {
        throw new UnauthorizedError('未授权的访问');
      }

      const { projectId } = req.params;
      
      const project = await projectService.getProjectById(projectId, userId, userRoles);
      
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
      const { projectId } = req.params;

      const validationResult = updateProjectSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errorMessage = JSON.stringify(validationResult.error.flatten());
        throw new ValidationError(errorMessage);
      }
      const validatedData = validationResult.data;

      logger.info(`User ${userId} updating project ${projectId} with data: ${JSON.stringify(validatedData)}`);

      const updateDto: UpdateProjectDto = {};
      if (validatedData.name !== undefined) updateDto.name = validatedData.name;
      if (validatedData.description !== undefined) updateDto.description = validatedData.description;
      if (validatedData.languagePairs !== undefined) updateDto.languagePairs = validatedData.languagePairs;
      if (validatedData.manager !== undefined) updateDto.manager = new Types.ObjectId(validatedData.manager);
      if (validatedData.reviewers !== undefined) {
        updateDto.reviewers = validatedData.reviewers.map(id => new Types.ObjectId(id));
      }
      if (validatedData.defaultTranslationPromptTemplate !== undefined) {
        updateDto.defaultTranslationPromptTemplate = new Types.ObjectId(validatedData.defaultTranslationPromptTemplate);
      }
      if (validatedData.defaultReviewPromptTemplate !== undefined) {
        updateDto.defaultReviewPromptTemplate = new Types.ObjectId(validatedData.defaultReviewPromptTemplate);
      }
      if (validatedData.translationPromptTemplate !== undefined) {
        updateDto.translationPromptTemplate = new Types.ObjectId(validatedData.translationPromptTemplate);
      }
      if (validatedData.reviewPromptTemplate !== undefined) {
        updateDto.reviewPromptTemplate = new Types.ObjectId(validatedData.reviewPromptTemplate);
      }
      if (validatedData.deadline !== undefined) {
        updateDto.deadline = validatedData.deadline ? new Date(validatedData.deadline) : undefined;
      }
      if (validatedData.priority !== undefined) updateDto.priority = validatedData.priority;
      if (validatedData.domain !== undefined) updateDto.domain = validatedData.domain;
      if (validatedData.industry !== undefined) updateDto.industry = validatedData.industry;
      if (validatedData.status !== undefined) updateDto.status = validatedData.status;
      
      if (Object.keys(updateDto).length === 0) {
        logger.warn(`No valid fields provided for updating project ${projectId}`);
        return res.status(400).json({ success: false, message: '没有提供可更新的字段' });
      }

      const project = await projectService.updateProject(projectId, userId, updateDto);
      
      logger.info(`Project ${projectId} updated successfully by user ${userId}`);
      
      res.status(200).json({
        success: true,
        data: { project }
      });
    } catch (error) {
      logger.error(`Error in updateProject controller:`, error);
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
    const methodName = 'getProjectFiles'; // For logging
    const { projectId } = req.params; // Get projectId outside try for catch block access
    let userIdForLog: string | undefined = req.user?.id; // Get userId outside for logging
    
    try {
      const userId = userIdForLog; // Assign inside try for consistency
      const userRoles = req.user?.role ? [req.user.role] : [];
      
      // Log entry and parameters
      logger.debug(`[Controller/${methodName}] ENTER - ProjectId: ${projectId}, UserId: ${userId}, Roles: ${JSON.stringify(userRoles)}`);

      if (!userId) {
        logger.warn(`[Controller/${methodName}] Unauthorized access attempt - no userId.`);
        throw new UnauthorizedError('未授权的访问');
      }
      
      const files = await projectService.getProjectFiles(projectId, userId, userRoles);
      
      // Log before sending response
      logger.debug(`[Controller/${methodName}] SUCCESS - Found ${files.length} files. Sending response.`);
      // logger.debug(`[Controller/${methodName}] Files data:`, files); // Optional: Log full file data if needed
      
      res.status(200).json({
        success: true,
        data: { files }
      });
    } catch (error) {
      // Log the error without referencing userId (which is out of scope)
      logger.error(`[ProjectController.getProjects] Error caught:`, error);
      next(error);
    }
  }

  /**
   * 处理文件
   */
  async processFile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const userRoles = req.user?.role ? [req.user.role] : [];
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
      const userRoles = req.user?.role ? [req.user.role] : [];
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
      const userRoles = req.user?.role ? [req.user.role] : [];
      if (!userId) {
        throw new UnauthorizedError('未授权的访问');
      }
      const { fileId } = req.params;

      await projectService.updateFileProgress(fileId, userId);

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
      const userRoles = req.user?.role ? [req.user.role] : [];

      if (!userId) {
        throw new UnauthorizedError('未授权的访问');
      }
      const { projectId } = req.params;

      const validationResult = projectProgressSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new ValidationError(JSON.stringify(validationResult.error.flatten()));
      }

      const project = await projectService.updateProjectProgress(projectId, userId, validationResult.data);

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
      
      res.status(501).json({
        success: false,
        message: 'Project stats endpoint not implemented yet.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取近期项目
   */
  async getRecentProjects(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new UnauthorizedError('未授权的访问');
      }
      
      // Optional limit from query, default to 5
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;

      const projects = await projectService.getRecentProjects(userId, limit);
      
      res.status(200).json({
        success: true,
        // Match the structure DashboardPage expects
        data: { projects } 
      });
    } catch (error) {
      logger.error(`[ProjectController.getRecentProjects] Error caught:`, error);
      next(error);
    }
  }
}