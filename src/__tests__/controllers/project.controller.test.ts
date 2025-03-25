import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import ProjectController from '../../controllers/project.controller';
import { projectService } from '../../services/project.service';
import { ProjectStatus, ProjectPriority } from '../../types/project.types';
import { NotFoundError, ForbiddenError, ValidationError, UnauthorizedError } from '../../utils/errors';
import { AuthRequest } from '../../middleware/auth.middleware';
import { Multer } from 'multer';

// Mock projectService
jest.mock('../../services/project.service');

describe('ProjectController', () => {
  let controller: ProjectController;
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  const mockUserId = new Types.ObjectId();
  const mockUser = {
    id: mockUserId.toString(),
    _id: mockUserId,
    email: 'test@example.com',
    username: 'testuser',
    role: 'translator'
  };

  beforeEach(() => {
    controller = new ProjectController();
    mockReq = {
      user: mockUser,
      params: {},
      query: {},
      body: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    const projectData = {
      name: 'Test Project',
      description: 'Test Description',
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      translationPromptTemplate: 'translation template',
      reviewPromptTemplate: 'review template'
    };

    it('should create a project successfully', async () => {
      mockReq.body = projectData;

      const mockProject = { 
        _id: new Types.ObjectId(),
        ...projectData,
        managerId: mockUser.id
      };

      (projectService.createProject as jest.Mock).mockResolvedValue(mockProject);

      await controller.createProject(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(projectService.createProject).toHaveBeenCalledWith({
        ...projectData,
        managerId: mockUser.id
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { project: mockProject }
      });
    });

    it('should handle unauthorized access', async () => {
      mockReq.user = undefined;

      await controller.createProject(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockNext.mock.calls[0]).toHaveLength(1);
      expect(mockNext.mock.calls[0][0]).toBeDefined();
    });

    it('should handle validation errors', async () => {
      mockReq.body = projectData;

      const error = new ValidationError('验证错误');
      (projectService.createProject as jest.Mock).mockRejectedValue(error);

      await controller.createProject(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getProjects', () => {
    it('should get projects successfully', async () => {
      mockReq.query = {
        status: ProjectStatus.IN_PROGRESS,
        priority: ProjectPriority.HIGH,
        search: 'test',
        page: '1',
        limit: '10'
      };

      const mockResult = {
        projects: [],
        total: 0,
        page: 1,
        limit: 10
      };

      (projectService.getUserProjects as jest.Mock).mockResolvedValue(mockResult);

      await controller.getProjects(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(projectService.getUserProjects).toHaveBeenCalledWith(
        mockUser.id,
        {
          status: ProjectStatus.IN_PROGRESS,
          priority: ProjectPriority.HIGH,
          search: 'test',
          page: 1,
          limit: 10
        }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult
      });
    });

    it('should handle unauthorized access', async () => {
      mockReq.user = undefined;

      await controller.getProjects(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockNext.mock.calls[0]).toHaveLength(1);
      expect(mockNext.mock.calls[0][0]).toBeDefined();
    });
  });

  describe('getProject', () => {
    const projectId = new Types.ObjectId().toString();

    it('should get a project successfully', async () => {
      mockReq.params = { projectId };

      const mockProject = {
        _id: projectId,
        name: 'Test Project'
      };

      (projectService.getProjectById as jest.Mock).mockResolvedValue(mockProject);

      await controller.getProject(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(projectService.getProjectById).toHaveBeenCalledWith(projectId, mockUser.id);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { project: mockProject }
      });
    });

    it('should handle not found error', async () => {
      mockReq.params = { projectId };

      const error = new NotFoundError('项目不存在');
      (projectService.getProjectById as jest.Mock).mockRejectedValue(error);

      await controller.getProject(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateProject', () => {
    const projectId = new Types.ObjectId().toString();
    const updateData = {
      name: 'Updated Project',
      description: 'Updated Description'
    };

    it('should update a project successfully', async () => {
      mockReq.params = { projectId };
      mockReq.body = updateData;

      const mockUpdatedProject = {
        _id: projectId,
        ...updateData
      };

      (projectService.updateProject as jest.Mock).mockResolvedValue(mockUpdatedProject);

      await controller.updateProject(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(projectService.updateProject).toHaveBeenCalledWith(projectId, mockUser.id, updateData);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { project: mockUpdatedProject }
      });
    });

    it('should handle forbidden error', async () => {
      mockReq.params = { projectId };
      mockReq.body = updateData;

      const error = new ForbiddenError('无权限操作此项目');
      (projectService.updateProject as jest.Mock).mockRejectedValue(error);

      await controller.updateProject(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteProject', () => {
    const projectId = new Types.ObjectId().toString();

    it('should delete a project successfully', async () => {
      mockReq.params = { projectId };

      const mockResult = { message: '项目删除成功' };
      (projectService.deleteProject as jest.Mock).mockResolvedValue(mockResult);

      await controller.deleteProject(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(projectService.deleteProject).toHaveBeenCalledWith(projectId, mockUser.id);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
        message: mockResult.message
      });
    });

    it('should handle not found error', async () => {
      mockReq.params = { projectId };

      const error = new NotFoundError('项目不存在');
      (projectService.deleteProject as jest.Mock).mockRejectedValue(error);

      await controller.deleteProject(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('uploadFile', () => {
    const projectId = new Types.ObjectId().toString();
    const mockFile = {
      fieldname: 'file',
      originalname: 'test.txt',
      encoding: '7bit',
      mimetype: 'text/plain',
      destination: '/uploads',
      filename: 'test-123.txt',
      path: '/uploads/test-123.txt',
      size: 1024,
      buffer: Buffer.from('test')
    } as Express.Multer.File;

    it('should upload a file successfully', async () => {
      mockReq.params = { projectId };
      mockReq.file = mockFile;

      const mockUploadedFile = {
        _id: new Types.ObjectId(),
        originalName: mockFile.originalname,
        fileName: mockFile.filename
      };

      (projectService.uploadProjectFile as jest.Mock).mockResolvedValue(mockUploadedFile);

      await controller.uploadFile(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(projectService.uploadProjectFile).toHaveBeenCalledWith(
        projectId,
        mockUser.id,
        {
          originalName: mockFile.originalname,
          fileName: mockFile.filename,
          fileSize: mockFile.size,
          mimeType: mockFile.mimetype,
          filePath: mockFile.path
        }
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { file: mockUploadedFile }
      });
    });

    it('should handle missing file error', async () => {
      mockReq.params = { projectId };
      mockReq.file = undefined;

      await controller.uploadFile(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.any(ValidationError)
      );
    });
  });

  describe('getProjectFiles', () => {
    it('should get project files successfully', async () => {
      mockReq.params = { projectId: 'project123' };
      const mockFiles = [{ id: 'file1' }, { id: 'file2' }];
      
      (projectService.getProjectFiles as jest.Mock).mockResolvedValue(mockFiles);

      await controller.getProjectFiles(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(projectService.getProjectFiles).toHaveBeenCalledWith('project123', mockUser.id);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { files: mockFiles }
      });
    });
  });

  describe('processFile', () => {
    it('should process a file successfully', async () => {
      mockReq.params = { fileId: 'file123' };
      
      await controller.processFile(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(projectService.processFile).toHaveBeenCalledWith('file123', mockUser.id);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '文件处理成功'
      });
    });
  });

  describe('getFileSegments', () => {
    it('should get file segments successfully', async () => {
      mockReq.params = { fileId: 'file123' };
      mockReq.query = { page: '1', limit: '10' };
      
      const mockSegments = {
        segments: [],
        total: 0,
        page: 1,
        limit: 10
      };

      (projectService.getFileSegments as jest.Mock).mockResolvedValue(mockSegments);

      await controller.getFileSegments(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(projectService.getFileSegments).toHaveBeenCalledWith('file123', mockUser.id, {
        status: undefined,
        page: 1,
        limit: 10
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockSegments
      });
    });
  });

  describe('updateFileProgress', () => {
    it('should update file progress successfully', async () => {
      mockReq.params = { fileId: 'file123' };
      
      await controller.updateFileProgress(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(projectService.updateFileProgress).toHaveBeenCalledWith('file123', mockUser.id);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '文件进度更新成功'
      });
    });
  });

  describe('updateProjectProgress', () => {
    it('should update project progress successfully', async () => {
      mockReq.params = { projectId: 'project123' };
      const progressData = {
        completionPercentage: 50,
        translatedWords: 100,
        totalWords: 200
      };
      mockReq.body = progressData;
      
      await controller.updateProjectProgress(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(projectService.updateProjectProgress).toHaveBeenCalledWith('project123', mockUser.id, progressData);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: '项目进度更新成功'
      });
    });
  });

  describe('getProjectStats', () => {
    it('should get project stats successfully', async () => {
      mockReq.params = { projectId: 'project123' };
      
      const mockProject = { id: 'project123', name: 'Test Project' };
      const mockFiles = [{ id: 'file1' }, { id: 'file2' }];
      
      (projectService.getProjectById as jest.Mock).mockResolvedValue(mockProject);
      (projectService.getProjectFiles as jest.Mock).mockResolvedValue(mockFiles);

      await controller.getProjectStats(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(projectService.getProjectById).toHaveBeenCalledWith('project123', mockUser.id);
      expect(projectService.getProjectFiles).toHaveBeenCalledWith('project123', mockUser.id);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          project: mockProject,
          files: mockFiles
        }
      });
    });
  });
});