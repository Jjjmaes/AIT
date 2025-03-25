import { Types } from 'mongoose';
import { ProjectStatus, ProjectPriority, CreateProjectDto, UpdateProjectDto } from '../../types/project.types';
import Project from '../../models/project.model';
import { File, FileType, FileStatus } from '../../models/file.model';
import { ProjectService } from '../../services/project.service';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../../utils/errors';
import { mockProjects } from '../../test/fixtures/projects';
import * as s3Utils from '../../utils/s3';

// Mock the models and utilities
jest.mock('../../models/project.model');
jest.mock('../../models/file.model');
jest.mock('../../models/segment.model');
jest.mock('../../utils/s3');

const MockProject = Project as jest.MockedClass<typeof Project>;
const MockFile = File as jest.MockedClass<typeof File>;

// Custom error type for MongoDB duplicate key error
interface MongoError extends Error {
  code?: number;
}

interface BaseMockDocument<T> {
  _id: Types.ObjectId;
  id: string;
  toObject: () => T & { toObject?: () => T; save?: () => Promise<void> };
  save?: () => Promise<void>;
  deleteOne?: () => Promise<void>;
}

interface MockProjectDocument extends BaseMockDocument<any> {
  name?: string;
  description?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  managerId?: string;
  translationPromptTemplate?: string;
  reviewPromptTemplate?: string;
  priority?: ProjectPriority;
  deadline?: Date;
  status?: ProjectStatus;
  progress?: {
    completionPercentage: number;
    translatedWords: number;
    totalWords: number;
  };
  reviewers?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

interface MockFileDocument extends BaseMockDocument<any> {
  projectId?: Types.ObjectId;
  originalName?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  filePath?: string;
  type?: FileType;
  status?: FileStatus;
  uploadedBy?: string;
}

// Factory functions for creating mock objects
function createMockProject(data: Partial<MockProjectDocument> = {}): MockProjectDocument {
  const defaultProject: MockProjectDocument = {
    _id: new Types.ObjectId(),
    id: new Types.ObjectId().toString(),
    toObject: function() {
      const { toObject, save, deleteOne, ...rest } = this;
      return {
        ...rest,
        _id: rest._id.toString(),
        id: rest.id
      };
    },
    save: jest.fn().mockResolvedValue(undefined),
    deleteOne: jest.fn().mockResolvedValue(undefined)
  };
  return { ...defaultProject, ...data };
}

function createMockFile(data: Partial<MockFileDocument> = {}): MockFileDocument {
  const defaultFile: MockFileDocument = {
    _id: new Types.ObjectId(),
    id: new Types.ObjectId().toString(),
    toObject: function() {
      const { toObject, save, deleteOne, ...rest } = this;
      return {
        ...rest,
        _id: rest._id.toString(),
        id: rest.id,
        projectId: rest.projectId?.toString()
      };
    },
    save: jest.fn().mockResolvedValue(undefined),
    deleteOne: jest.fn().mockResolvedValue(undefined)
  };
  return { ...defaultFile, ...data };
}

describe('ProjectService', () => {
  let projectService: ProjectService;
  const userId = new Types.ObjectId().toString();
  const projectId = new Types.ObjectId().toString();
  const fileId = new Types.ObjectId().toString();

  beforeEach(() => {
    projectService = new ProjectService();
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    it('should create a project successfully', async () => {
      const projectData: CreateProjectDto = {
        name: 'Test Project',
        description: 'Test Description',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        managerId: userId,
        translationPromptTemplate: 'translation template',
        reviewPromptTemplate: 'review template',
        priority: ProjectPriority.HIGH,
        deadline: new Date('2024-12-31')
      };

      const expectedProject = {
        _id: new Types.ObjectId(projectId),
        ...projectData,
        status: ProjectStatus.PENDING,
        progress: {
          completionPercentage: 0,
          translatedWords: 0,
          totalWords: 0
        },
        reviewers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        id: projectId,
        save: jest.fn().mockResolvedValue(undefined),
        toObject: () => ({
          ...projectData,
          _id: new Types.ObjectId(projectId),
          id: projectId,
          status: ProjectStatus.PENDING,
          progress: {
            completionPercentage: 0,
            translatedWords: 0,
            totalWords: 0
          },
          reviewers: [],
          createdAt: new Date(),
          updatedAt: new Date()
        })
      };

      (MockProject as unknown as jest.Mock).mockImplementation(() => expectedProject);

      const result = await projectService.createProject(projectData);

      expect(MockProject).toHaveBeenCalledWith(expect.objectContaining({
        ...projectData,
        status: ProjectStatus.PENDING,
        progress: {
          completionPercentage: 0,
          translatedWords: 0,
          totalWords: 0
        }
      }));
      expect(result).toEqual(expect.objectContaining({
        id: projectId,
        name: projectData.name,
        description: projectData.description,
        priority: projectData.priority,
        deadline: projectData.deadline,
        managerId: userId
      }));
    });

    it('should fail to create project with duplicate name', async () => {
      const mockError: MongoError = new Error('E11000 duplicate key error collection: test.projects index: name_1 dup key');
      mockError.name = 'MongoServerError';
      mockError.code = 11000;

      const mockSave = jest.fn().mockRejectedValue(mockError);
      (MockProject as unknown as jest.Mock).mockImplementation(() => ({
        save: mockSave
      }));

      await expect(projectService.createProject({
        ...mockProjects[0],
        managerId: userId
      } as CreateProjectDto))
        .rejects
        .toThrow(ConflictError);
    });

    it('should fail to create project with invalid data', async () => {
      const invalidData = {
        name: '',
        description: '',
        sourceLanguage: '',
        targetLanguage: '',
        managerId: userId,
        translationPromptTemplate: '',
        reviewPromptTemplate: ''
      };

      const mockError = new ValidationError('验证失败');
      const mockSave = jest.fn().mockRejectedValue(mockError);
      (MockProject as unknown as jest.Mock).mockImplementation(() => ({
        save: mockSave
      }));

      await expect(projectService.createProject(invalidData as CreateProjectDto))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('getProjectById', () => {
    it('should return a project if it exists and user has access', async () => {
      const createdAt = new Date('2024-01-01T00:00:00.000Z');
      const updatedAt = new Date('2024-01-01T00:00:00.000Z');
      const mockProject = createMockProject({
        _id: new Types.ObjectId(projectId),
        name: 'Test Project',
        description: 'Test Description',
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        managerId: userId,
        translationPromptTemplate: 'translation template',
        reviewPromptTemplate: 'review template',
        priority: ProjectPriority.HIGH,
        deadline: new Date('2024-12-31'),
        status: ProjectStatus.PENDING,
        progress: {
          completionPercentage: 0,
          translatedWords: 0,
          totalWords: 0
        },
        reviewers: [],
        createdAt,
        updatedAt,
        id: projectId
      });

      MockProject.findOne = jest.fn().mockResolvedValue(mockProject);

      const result = await projectService.getProjectById(projectId, userId);

      const { toObject, save, deleteOne, ...expectedResult } = mockProject;
      expect(result).toEqual({
        ...expectedResult,
        _id: expectedResult._id.toString(),
        id: expectedResult.id
      });
      expect(MockProject.findOne).toHaveBeenCalledWith({
        _id: new Types.ObjectId(projectId),
        managerId: userId
      });
    });

    it('should throw NotFoundError if project does not exist', async () => {
      MockProject.findOne = jest.fn().mockResolvedValue(null);

      await expect(projectService.getProjectById(projectId, userId))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('uploadProjectFile', () => {
    const mockFileData = {
      originalName: 'test.txt',
      fileName: 'test-123.txt',
      fileSize: 1024,
      mimeType: 'text/txt',
      filePath: '/tmp/test-123.txt'
    };

    it('should upload file successfully', async () => {
      const mockProject = createMockProject({
        _id: new Types.ObjectId(projectId),
        managerId: userId,
        id: projectId
      });

      MockProject.findById = jest.fn().mockResolvedValue(mockProject);

      const mockUploadedFile = createMockFile({
        _id: new Types.ObjectId(fileId),
        ...mockFileData,
        projectId: new Types.ObjectId(projectId),
        status: FileStatus.PENDING,
        type: FileType.TXT,
        uploadedBy: userId,
        id: fileId,
        save: jest.fn().mockResolvedValue(undefined)
      });

      (MockFile as unknown as jest.Mock).mockImplementation(() => mockUploadedFile);
      jest.spyOn(s3Utils, 'uploadToS3').mockResolvedValue('https://test-bucket.s3.amazonaws.com/test-123.txt');

      const result = await projectService.uploadProjectFile(projectId, userId, mockFileData);

      const { toObject, save, deleteOne, ...expectedResult } = mockUploadedFile;
      expect(result).toEqual({
        ...expectedResult,
        _id: expectedResult._id.toString(),
        id: expectedResult.id,
        projectId: expectedResult.projectId?.toString()
      });
      expect(s3Utils.uploadToS3).toHaveBeenCalled();
      expect(MockFile).toHaveBeenCalledWith(expect.objectContaining({
        ...mockFileData,
        projectId: new Types.ObjectId(projectId),
        uploadedBy: userId,
        status: FileStatus.PENDING
      }));
    });

    it('should throw ValidationError for unsupported file type', async () => {
      const mockProject = {
        _id: new Types.ObjectId(projectId),
        managerId: userId,
        id: projectId
      };

      MockProject.findById = jest.fn().mockResolvedValue(mockProject);

      const unsupportedFileData = {
        ...mockFileData,
        mimeType: 'application/pdf'
      };

      await expect(projectService.uploadProjectFile(projectId, userId, unsupportedFileData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw NotFoundError if project does not exist', async () => {
      MockProject.findById = jest.fn().mockResolvedValue(null);

      await expect(projectService.uploadProjectFile(projectId, userId, mockFileData))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw ForbiddenError if user is not project manager', async () => {
      const mockProject = {
        _id: new Types.ObjectId(projectId),
        managerId: new Types.ObjectId().toString(),
        id: projectId
      };

      MockProject.findById = jest.fn().mockResolvedValue(mockProject);

      await expect(projectService.uploadProjectFile(projectId, userId, mockFileData))
        .rejects
        .toThrow(ForbiddenError);
    });
  });

  describe('getUserProjects', () => {
    it('should return projects with pagination', async () => {
      const mockPaginatedProjects = {
        projects: mockProjects.map(project => ({
          ...project,
          _id: new Types.ObjectId(),
          managerId: userId,
          id: new Types.ObjectId().toString(),
          toObject: () => ({
            ...project,
            _id: new Types.ObjectId(),
            managerId: userId,
            id: new Types.ObjectId().toString()
          })
        })),
        pagination: {
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1
        }
      };

      MockProject.countDocuments = jest.fn().mockResolvedValue(2);
      MockProject.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockPaginatedProjects.projects)
      });

      const result = await projectService.getUserProjects(userId, {});

      expect(result.pagination.total).toBe(2);
      expect(result.projects).toHaveLength(2);
      expect(MockProject.find).toHaveBeenCalledWith({ managerId: userId });
    });

    it('should apply filters correctly', async () => {
      const filters = {
        status: ProjectStatus.IN_PROGRESS,
        priority: ProjectPriority.HIGH,
        search: 'test',
        limit: 5,
        page: 2
      };

      const mockFilteredProjects = [
        {
          ...mockProjects[0],
          _id: new Types.ObjectId(),
          managerId: userId,
          id: new Types.ObjectId().toString(),
          toObject: () => ({
            ...mockProjects[0],
            _id: new Types.ObjectId(),
            managerId: userId,
            id: new Types.ObjectId().toString()
          })
        }
      ];

      MockProject.countDocuments = jest.fn().mockResolvedValue(1);
      MockProject.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockFilteredProjects)
      });

      const result = await projectService.getUserProjects(userId, filters);

      expect(result.pagination.total).toBe(1);
      expect(result.projects).toHaveLength(1);
      expect(MockProject.find).toHaveBeenCalledWith(expect.objectContaining({
        managerId: userId,
        status: filters.status,
        priority: filters.priority,
        name: { $regex: filters.search, $options: 'i' }
      }));
    });
  });

  describe('updateProject', () => {
    it('should update project successfully if user is manager', async () => {
      const updateData: UpdateProjectDto = {
        name: 'Updated Project',
        description: 'Updated Description',
        status: ProjectStatus.IN_PROGRESS,
        priority: ProjectPriority.HIGH,
        deadline: new Date('2024-12-31'),
        translationPromptTemplate: 'updated translation template',
        reviewPromptTemplate: 'updated review template'
      };

      const mockProject: MockProjectDocument = {
        _id: new Types.ObjectId(projectId),
        ...updateData,
        managerId: userId,
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        id: projectId,
        save: jest.fn().mockResolvedValue(undefined),
        toObject: () => ({
          _id: new Types.ObjectId(projectId),
          ...updateData,
          managerId: userId,
          sourceLanguage: 'en',
          targetLanguage: 'zh',
          id: projectId
        })
      };

      MockProject.findOne = jest.fn().mockResolvedValue(mockProject);

      const result = await projectService.updateProject(projectId, userId, updateData);

      const { toObject, save, ...expectedResult } = mockProject.toObject();
      expect(result).toEqual(expectedResult);
      expect(mockProject.save).toHaveBeenCalled();
      expect(MockProject.findOne).toHaveBeenCalledWith({
        _id: new Types.ObjectId(projectId),
        managerId: userId
      });
    });

    it('should throw ForbiddenError if user is not project manager', async () => {
      const updateData: UpdateProjectDto = {
        name: 'Updated Project',
        description: 'Updated Description',
        status: ProjectStatus.IN_PROGRESS,
        priority: ProjectPriority.HIGH,
        deadline: new Date('2024-12-31'),
        translationPromptTemplate: 'updated translation template',
        reviewPromptTemplate: 'updated review template'
      };

      MockProject.findOne = jest.fn().mockResolvedValue(null);

      await expect(projectService.updateProject(projectId, userId, updateData))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('deleteProject', () => {
    it('should delete project successfully if user is manager', async () => {
      const mockProject = {
        _id: new Types.ObjectId(projectId),
        managerId: userId,
        id: projectId,
        deleteOne: jest.fn().mockResolvedValue(undefined)
      };

      MockProject.findOne = jest.fn().mockResolvedValue(mockProject);
      MockFile.deleteMany = jest.fn().mockResolvedValue(undefined);

      const result = await projectService.deleteProject(projectId, userId);

      expect(result).toEqual({ success: true });
      expect(mockProject.deleteOne).toHaveBeenCalled();
      expect(MockFile.deleteMany).toHaveBeenCalledWith({ projectId: new Types.ObjectId(projectId) });
    });

    it('should throw ForbiddenError if user is not project manager', async () => {
      MockProject.findOne = jest.fn().mockResolvedValue(null);

      await expect(projectService.deleteProject(projectId, userId))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('getProjectFiles', () => {
    it('should return files if user has access', async () => {
      const mockProject = createMockProject({
        _id: new Types.ObjectId(projectId),
        managerId: userId,
        id: projectId
      });

      const mockFiles = [
        createMockFile({
          _id: new Types.ObjectId(),
          originalName: 'test1.txt',
          projectId: new Types.ObjectId(projectId),
          status: FileStatus.PENDING,
          type: FileType.TXT,
          id: new Types.ObjectId().toString()
        }),
        createMockFile({
          _id: new Types.ObjectId(),
          originalName: 'test2.txt',
          projectId: new Types.ObjectId(projectId),
          status: FileStatus.COMPLETED,
          type: FileType.TXT,
          id: new Types.ObjectId().toString()
        })
      ];

      MockProject.findById = jest.fn().mockResolvedValue(mockProject);
      MockFile.find = jest.fn().mockResolvedValue(mockFiles);

      const result = await projectService.getProjectFiles(projectId, userId);

      const expectedFiles = mockFiles.map(file => {
        const { toObject, save, deleteOne, ...cleanResult } = file;
        return {
          ...cleanResult,
          _id: cleanResult._id.toString(),
          id: cleanResult.id,
          projectId: cleanResult.projectId?.toString()
        };
      });
      expect(result).toEqual(expectedFiles);
      expect(MockProject.findById).toHaveBeenCalledWith(projectId);
      expect(MockFile.find).toHaveBeenCalledWith({ projectId: new Types.ObjectId(projectId) });
    });

    it('should throw NotFoundError if project does not exist', async () => {
      MockProject.findById = jest.fn().mockResolvedValue(null);

      await expect(projectService.getProjectFiles(projectId, userId))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw ForbiddenError if user is not project manager', async () => {
      const mockProject = {
        _id: new Types.ObjectId(projectId),
        managerId: new Types.ObjectId().toString(),
        id: projectId
      };

      MockProject.findById = jest.fn().mockResolvedValue(mockProject);

      await expect(projectService.getProjectFiles(projectId, userId))
        .rejects
        .toThrow(ForbiddenError);
    });
  });
}); 