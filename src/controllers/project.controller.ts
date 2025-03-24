// src/controllers/project.controller.ts

import { Request, Response, NextFunction } from 'express';
import projectService, { CreateProjectDTO, UpdateProjectDTO } from '../services/project.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { ValidationError } from '../utils/errors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ProjectStatus, ProjectPriority } from '../models/project.model';
import { SegmentStatus } from '../models/segment.model';
import { FileStatus, FileType } from '../models/file.model';
import { ApiError } from '../utils/apiError';

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    
    // 确保上传目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// 文件类型过滤
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // 获取文件扩展名
  const ext = path.extname(file.originalname).toLowerCase().substring(1);
  
  // 允许的文件类型
  const allowedTypes = Object.values(FileType);
  
  if (allowedTypes.includes(ext as FileType)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${ext}`));
  }
};

export const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

export default class ProjectController {
  /**
   * 创建新项目
   */
  async createProject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '未授权的访问'
        });
      }
      const projectData: CreateProjectDTO = req.body;
      
      const project = await projectService.createProject(userId, projectData);
      
      res.status(201).json({
        success: true,
        data: {
          project
        }
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
        return res.status(401).json({
          success: false,
          message: '未授权的访问'
        });
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
        return res.status(401).json({
          success: false,
          message: '未授权的访问'
        });
      }
      const { projectId } = req.params;
      
      const project = await projectService.getProjectById(projectId, userId);
      
      res.status(200).json({
        success: true,
        data: {
          project
        }
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
        return res.status(401).json({
          success: false,
          message: '未授权的访问'
        });
      }
      const { projectId } = req.params;
      const updateData: UpdateProjectDTO = req.body;
      
      const project = await projectService.updateProject(projectId, userId, updateData);
      
      res.status(200).json({
        success: true,
        data: {
          project
        }
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
        return res.status(401).json({
          success: false,
          message: '未授权的访问'
        });
      }
      const { projectId } = req.params;
      
      const result = await projectService.deleteProject(projectId, userId);
      
      res.status(200).json({
        success: true,
        message: result.message,
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
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '未授权的访问'
        });
      }
      const { projectId } = req.params;
      
      if (!req.file) {
        throw new ApiError(400, '请上传文件');
      }

      const fileData = {
        originalName: req.file.originalname,
        fileName: req.file.filename,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        filePath: req.file.path
      };
      
      const file = await projectService.uploadProjectFile(projectId, userId, fileData);
      
      res.status(201).json({
        success: true,
        data: {
          file
        }
      });
    } catch (error) {
      // 如果发生错误，删除上传的文件
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
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
        return res.status(401).json({
          success: false,
          message: '未授权的访问'
        });
      }
      const { projectId } = req.params;
      
      const files = await projectService.getProjectFiles(projectId, userId);
      
      res.status(200).json({
        success: true,
        data: {
          files
        }
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
      const { fileId } = req.params;
      
      await projectService.processFile(fileId);
      
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
        return res.status(401).json({
          success: false,
          message: '未授权的访问'
        });
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
      const { fileId } = req.params;
      
      await projectService.updateFileProgress(fileId);
      
      res.status(200).json({
        success: true,
        message: '文件进度已更新'
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
      const { projectId } = req.params;
      
      await projectService.updateProjectProgress(projectId);
      
      res.status(200).json({
        success: true,
        message: '项目进度已更新'
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
        return res.status(401).json({
          success: false,
          message: '未授权的访问'
        });
      }
      const { projectId } = req.params;
      
      // 获取项目详情
      const project = await projectService.getProjectById(projectId, userId);
      
      // 获取项目文件
      const files = await projectService.getProjectFiles(projectId, userId);
      
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
    } catch (error) {
      next(error);
    }
  }
}