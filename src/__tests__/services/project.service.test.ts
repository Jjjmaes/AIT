import { Types } from 'mongoose';
import { Project, ProjectStatus, ProjectPriority, IProject } from '../../models/project.model';
import { File } from '../../models/file.model';
import { ProjectService, CreateProjectDTO, UpdateProjectDTO } from '../../services/project.service';
import { AppError, NotFoundError, ForbiddenError } from '../../utils/errors';
import { mockProjects } from '../../test/fixtures/projects';

// Mock the Project model and related models
jest.mock('../../models/project.model');
jest.mock('../../models/file.model');
jest.mock('../../models/segment.model');
jest.mock('../../utils/s3');

// Custom error type for MongoDB duplicate key error
interface MongoError extends Error {
  code?: number;
}

describe('ProjectService', () => {
  let projectService: ProjectService;
  const userId = new Types.ObjectId().toString();
  const projectId = new Types.ObjectId().toString();

  beforeEach(() => {
    projectService = new ProjectService();
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    it('should create a project successfully', async () => {
      const projectData: CreateProjectDTO = {
        name: 'Test Project',
        description: 'Test Description',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        managerId: new Types.ObjectId(userId),
        translationPromptTemplate: 'translation template',
        reviewPromptTemplate: 'review template'
      };

      const mockSave = jest.fn().mockResolvedValue({ ...projectData, _id: projectId });
      (Project as unknown as jest.Mock).mockImplementation(() => ({
        save: mockSave
      }));

      const result = await projectService.createProject(projectData);

      expect(Project).toHaveBeenCalledWith(projectData);
      expect(result).toHaveProperty('_id', projectId);
      expect(result.name).toBe(projectData.name);
    });

    it('should fail to create project with duplicate name', async () => {
      const mockError: MongoError = new Error('E11000 duplicate key error collection: test.projects index: name_1 dup key');
      mockError.name = 'MongoError';
      mockError.code = 11000;

      const mockSave = jest.fn().mockRejectedValue(mockError);
      (Project as unknown as jest.Mock).mockImplementation(() => ({
        save: mockSave
      }));

      await expect(projectService.createProject(mockProjects[0]))
        .rejects
        .toThrow();
    });
  });

  describe('getProjectById', () => {
    it('should return a project if it exists and user has access', async () => {
      const mockProject = {
        ...mockProjects[0],
        managerId: new Types.ObjectId(userId),
        _id: projectId
      };

      (Project.findById as jest.Mock).mockResolvedValue(mockProject);

      const result = await projectService.getProjectById(projectId, userId);

      expect(result).toEqual(mockProject);
      expect(Project.findById).toHaveBeenCalledWith(projectId);
    });

    it('should throw NotFoundError if project does not exist', async () => {
      (Project.findById as jest.Mock).mockResolvedValue(null);

      await expect(projectService.getProjectById(projectId, userId))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError if user has no access', async () => {
      const mockProject = {
        ...mockProjects[0],
        managerId: new Types.ObjectId(),
        _id: projectId
      };

      (Project.findById as jest.Mock).mockResolvedValue(mockProject);

      await expect(projectService.getProjectById(projectId, userId))
        .rejects.toThrow(ForbiddenError);
    });
  });

  describe('getUserProjects', () => {
    it('should return projects with pagination', async () => {
      const mockPaginatedProjects = {
        projects: mockProjects,
        total: 2,
        page: 1,
        limit: 10
      };

      (Project.countDocuments as jest.Mock).mockResolvedValue(2);
      (Project.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockProjects)
      });

      const result = await projectService.getUserProjects(userId);

      expect(result.total).toBe(2);
      expect(result.projects).toHaveLength(2);
      expect(Project.find).toHaveBeenCalledWith(expect.objectContaining({
        $or: [
          { manager: userId },
          { reviewers: userId }
        ]
      }));
    });

    it('should apply filters correctly', async () => {
      const filters = {
        status: ProjectStatus.IN_PROGRESS,
        priority: ProjectPriority.HIGH,
        search: 'test',
        limit: 5,
        page: 2
      };

      (Project.countDocuments as jest.Mock).mockResolvedValue(1);
      (Project.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockProjects[0]])
      });

      await projectService.getUserProjects(userId, filters);

      expect(Project.find).toHaveBeenCalledWith(expect.objectContaining({
        status: filters.status,
        priority: filters.priority,
        $or: [
          { name: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } }
        ]
      }));
    });

    it('should apply filters without search correctly', async () => {
      const filters = {
        status: ProjectStatus.IN_PROGRESS,
        priority: ProjectPriority.HIGH,
        limit: 5,
        page: 2
      };

      (Project.countDocuments as jest.Mock).mockResolvedValue(1);
      (Project.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockProjects[0]])
      });

      await projectService.getUserProjects(userId, filters);

      expect(Project.find).toHaveBeenCalledWith(expect.objectContaining({
        $or: [
          { manager: userId },
          { reviewers: userId }
        ],
        status: filters.status,
        priority: filters.priority
      }));
    });
  });

  describe('updateProject', () => {
    it('should update project successfully if user is manager', async () => {
      const updateData: UpdateProjectDTO = {
        name: 'Updated Project',
        description: 'Updated Description'
      };

      const mockProject = {
        ...mockProjects[0],
        managerId: new Types.ObjectId(userId),
        save: jest.fn().mockResolvedValue({ ...mockProjects[0], ...updateData })
      };

      (Project.findById as jest.Mock).mockResolvedValue(mockProject);

      const result = await projectService.updateProject(projectId, userId, updateData);

      expect(result.name).toBe(updateData.name);
      expect(result.description).toBe(updateData.description);
      expect(mockProject.save).toHaveBeenCalled();
    });

    it('should throw NotFoundError if project does not exist', async () => {
      (Project.findById as jest.Mock).mockResolvedValue(null);

      await expect(projectService.updateProject(projectId, userId, {}))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError if user is not manager', async () => {
      const mockProject = {
        ...mockProjects[0],
        managerId: new Types.ObjectId(),
      };

      (Project.findById as jest.Mock).mockResolvedValue(mockProject);

      await expect(projectService.updateProject(projectId, userId, {}))
        .rejects.toThrow(ForbiddenError);
    });

    it('should update project status successfully', async () => {
      const updateData: UpdateProjectDTO = {
        status: ProjectStatus.IN_PROGRESS
      };

      const mockProject = {
        ...mockProjects[0],
        managerId: new Types.ObjectId(userId),
        save: jest.fn().mockResolvedValue({ ...mockProjects[0], ...updateData })
      };

      (Project.findById as jest.Mock).mockResolvedValue(mockProject);

      const result = await projectService.updateProject(projectId, userId, updateData);

      expect(result.status).toBe(ProjectStatus.IN_PROGRESS);
      expect(mockProject.save).toHaveBeenCalled();
    });
  });

  describe('deleteProject', () => {
    it('should delete project and related data successfully', async () => {
      const mockProject = {
        ...mockProjects[0],
        managerId: new Types.ObjectId(userId),
      };

      const mockFiles = [
        { _id: new Types.ObjectId(), path: 'test/file1.txt' },
        { _id: new Types.ObjectId(), path: 'test/file2.txt' }
      ];

      (Project.findById as jest.Mock).mockResolvedValue(mockProject);
      (File.find as jest.Mock).mockResolvedValue(mockFiles);
      (Project.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });

      const result = await projectService.deleteProject(projectId, userId);

      expect(result).toEqual({ message: '项目删除成功' });
      expect(Project.deleteOne).toHaveBeenCalledWith({ _id: projectId });
    });

    it('should throw NotFoundError if project does not exist', async () => {
      (Project.findById as jest.Mock).mockResolvedValue(null);

      await expect(projectService.deleteProject(projectId, userId))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError if user is not manager', async () => {
      const mockProject = {
        ...mockProjects[0],
        managerId: new Types.ObjectId(),
      };

      (Project.findById as jest.Mock).mockResolvedValue(mockProject);

      await expect(projectService.deleteProject(projectId, userId))
        .rejects.toThrow(ForbiddenError);
    });
  });
}); 