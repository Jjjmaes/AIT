import { Types } from 'mongoose';
import { ProjectStatus, ProjectPriority, CreateProjectDto, UpdateProjectDto } from '../../types/project.types';
import Project from '../../models/project.model';
import { File, FileStatus, FileType, IFile } from '../../models/file.model';
import { ProjectService, UploadFileDto } from '../../services/project.service';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../../utils/errors';
import { mockProjects } from '../../test/fixtures/projects';
import * as s3Utils from '../../utils/s3';
import { processFile as processFileUtil } from '../../utils/fileProcessor';
import { Segment, SegmentStatus } from '../../models/segment.model';
import { ProjectProgressDto } from '../../types/project.types';
import * as fileUtils from '../../utils/fileUtils';

// Mock the models and utilities
jest.mock('../../models/project.model');
jest.mock('../../models/file.model');
jest.mock('../../models/segment.model');
jest.mock('../../utils/s3');
jest.mock('../../utils/fileProcessor', () => ({
  processFile: jest.fn()
}));
jest.mock('../../utils/fileUtils');

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
  sourceLanguage?: string;
  targetLanguage?: string;
  category?: string;
  tags?: string[];
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  segmentCount?: number;
  error?: string;
  errorDetails?: string;
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
    const mockFileData: UploadFileDto = {
      originalName: 'test.txt',
      fileSize: 1024,
      mimeType: 'text/txt',
      filePath: '/uploads/test.txt',
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      fileType: 'test'
    };

    const mockProject = {
      _id: new Types.ObjectId('67e289a55e7a3aed7505d9df'),
      name: 'Test Project',
      description: 'Test Description',
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      managerId: new Types.ObjectId(userId),
      reviewers: [],
      translationPromptTemplate: 'Test Template',
      reviewPromptTemplate: 'Test Template',
      status: ProjectStatus.PENDING,
      priority: ProjectPriority.MEDIUM,
      progress: {
        completionPercentage: 0,
        translatedWords: 0,
        totalWords: 0
      },
      save: jest.fn().mockResolvedValue(undefined),
      deleteOne: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnThis()
    };

    const mockFile: Partial<IFile> = {
      _id: new Types.ObjectId('67e287866fbba6a28e89ff26'),
      projectId: mockProject._id,
      fileName: 'test.txt',
      originalName: 'test.txt',
      fileSize: 1024,
      mimeType: 'text/txt',
      type: FileType.TXT,
      status: FileStatus.PENDING,
      uploadedBy: new Types.ObjectId(userId),
      storageUrl: 'https://test-bucket.s3.amazonaws.com/test.txt',
      path: `projects/${projectId}/12345-test.txt`,
      metadata: {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        category: 'test',
        tags: ['test']
      },
      translatedCount: 0,
      reviewedCount: 0,
      save: jest.fn().mockResolvedValue(undefined)
    };

    const mockSegments = [
      {
        _id: new Types.ObjectId(),
        fileId: new Types.ObjectId(fileId),
        sourceText: 'Hello',
        targetText: '',
        status: SegmentStatus.PENDING,
        index: 1
      }
    ];

    beforeEach(() => {
      jest.clearAllMocks();
      (s3Utils.uploadToS3 as jest.Mock).mockResolvedValue('https://test-bucket.s3.amazonaws.com/test.txt');
      (MockFile.create as jest.Mock).mockResolvedValue(mockFile);
      (MockProject.findById as jest.Mock).mockResolvedValue(mockProject);
    });

    it('should upload file successfully', async () => {
      MockProject.findById = jest.fn().mockResolvedValue(mockProject);
      const getFileTypeSpy = jest.spyOn(fileUtils, 'getFileTypeFromFilename').mockReturnValue(FileType.TXT);
      const uploadToS3Spy = jest.spyOn(s3Utils, 'uploadToS3').mockResolvedValue('https://test-bucket.s3.amazonaws.com/test.txt');
      MockFile.create = jest.fn().mockResolvedValue(mockFile);
      
      const result = await projectService.uploadProjectFile(projectId, userId, mockFileData);

      expect(result).toEqual(mockFile);
    });

    it('should use project default languages if not provided', async () => {
      MockProject.findById = jest.fn().mockResolvedValue(mockProject);
      const getFileTypeSpy = jest.spyOn(fileUtils, 'getFileTypeFromFilename').mockReturnValue(FileType.TXT);
      const uploadToS3Spy = jest.spyOn(s3Utils, 'uploadToS3').mockResolvedValue('https://test-bucket.s3.amazonaws.com/test.txt');
      MockFile.create = jest.fn().mockResolvedValue(mockFile);
      
      const fileDataWithoutLanguages = {
        ...mockFileData,
        sourceLanguage: '',
        targetLanguage: ''
      };

      const result = await projectService.uploadProjectFile(projectId, userId, fileDataWithoutLanguages);

      expect(result).toEqual(mockFile);
    });

    it('should throw error for unsupported file type', async () => {
      const fileDataWithUnsupportedType = {
        ...mockFileData,
        originalName: 'test.unsupported',
        mimeType: 'application/unsupported'
      };

      // 模拟验证失败
      (fileUtils.validateFileType as jest.Mock).mockImplementation(() => {
        throw new ValidationError('不支持的文件类型: test.unsupported (application/unsupported)');
      });

      await expect(projectService.uploadProjectFile(projectId, userId, fileDataWithUnsupportedType))
        .rejects
        .toThrow('不支持的文件类型');
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

  describe('processFile', () => {
    const mockProject = createMockProject({
      _id: new Types.ObjectId(projectId),
      managerId: userId,
      sourceLanguage: 'en',
      targetLanguage: 'zh'
    });

    const mockFile = createMockFile({
      _id: new Types.ObjectId(fileId),
      projectId: mockProject._id,
      type: FileType.TXT,
      status: FileStatus.PENDING
    });

    beforeEach(() => {
      jest.clearAllMocks();
      
      // Mock Project.findById
      (Project.findById as jest.Mock).mockImplementation((id) => {
        if (id.toString() === mockProject._id.toString() || id === mockProject._id.toString()) {
          return Promise.resolve(mockProject);
        }
        if (id.toString() === projectId || id === projectId) {
          return Promise.resolve(mockProject);
        }
        if (mockFile.projectId && (id.toString() === mockFile.projectId.toString() || id === mockFile.projectId.toString())) {
          return Promise.resolve(mockProject);
        }
        return Promise.resolve(null);
      });

      // Mock File.findById
      (File.findById as jest.Mock).mockImplementation((id) => {
        if (id === mockFile._id.toString()) {
          return Promise.resolve(mockFile);
        }
        return Promise.resolve(null);
      });

      // Mock processFileUtil
      (processFileUtil as jest.Mock).mockResolvedValue([
        { content: 'Test content 1', status: SegmentStatus.PENDING },
        { content: 'Test content 2', status: SegmentStatus.PENDING }
      ]);

      // Mock Segment.insertMany
      (Segment.insertMany as jest.Mock).mockResolvedValue([]);

      // Mock Segment.find
      (Segment.find as jest.Mock).mockResolvedValue([
        { status: SegmentStatus.TRANSLATED },
        { status: SegmentStatus.COMPLETED }
      ]);
    });

    it('should process file successfully', async () => {
      await projectService.processFile(fileId, userId);

      expect(File.findById).toHaveBeenCalledWith(fileId);
      expect(Project.findById).toHaveBeenCalledWith(projectId);
      expect(mockFile.save).toHaveBeenCalled();
      expect(mockProject.save).toHaveBeenCalled();
    });

    it('should throw error if project not found', async () => {
      (Project.findById as jest.Mock).mockResolvedValue(null);

      await expect(projectService.processFile(fileId, userId)).rejects.toThrow('项目不存在');
    });
  });

  describe('getFileSegments', () => {
    const mockFile = createMockFile({
      _id: new Types.ObjectId(fileId),
      projectId: new Types.ObjectId(projectId),
      uploadedBy: userId
    });

    const mockProject = createMockProject({
      _id: new Types.ObjectId(projectId),
      managerId: userId,
      id: projectId
    });

    const mockSegments = [
      {
        _id: new Types.ObjectId(),
        fileId: new Types.ObjectId(fileId),
        sourceText: 'Hello',
        targetText: '',
        status: SegmentStatus.PENDING,
        index: 1
      }
    ];

    beforeEach(() => {
      (MockFile.findById as jest.Mock).mockResolvedValue(mockFile);
      (MockProject.findById as jest.Mock).mockResolvedValue(mockProject);
      (Segment.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockSegments)
      });
      (Segment.countDocuments as jest.Mock).mockResolvedValue(1);
    });

    it('should return segments with pagination', async () => {
      const result = await projectService.getFileSegments(fileId, userId, {
        status: SegmentStatus.PENDING,
        page: 1,
        limit: 10
      });

      expect(result.segments).toEqual(mockSegments);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(Segment.find).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: fileId,
          status: SegmentStatus.PENDING
        })
      );
    });

    it('should throw NotFoundError if file does not exist', async () => {
      (MockFile.findById as jest.Mock).mockResolvedValue(null);

      await expect(projectService.getFileSegments(fileId, userId))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw ForbiddenError if user is not authorized', async () => {
      const mockProjectWithDifferentManager = createMockProject({
        ...mockProject,
        managerId: new Types.ObjectId().toString()
      });
      (MockProject.findById as jest.Mock).mockResolvedValue(mockProjectWithDifferentManager);

      await expect(projectService.getFileSegments(fileId, userId))
        .rejects
        .toThrow(ForbiddenError);
    });
  });

  describe('updateFileProgress', () => {
    const mockProject = createMockProject({
      _id: new Types.ObjectId(projectId),
      managerId: userId,
      sourceLanguage: 'en',
      targetLanguage: 'zh'
    });

    const mockFile = createMockFile({
      _id: new Types.ObjectId(fileId),
      projectId: mockProject._id,
      type: FileType.TXT,
      status: FileStatus.TRANSLATED,
      save: jest.fn().mockResolvedValue(undefined)
    });

    beforeEach(() => {
      (Project.findById as jest.Mock).mockImplementation((id) => {
        if (id.toString() === projectId) return mockProject;
        if (id.toString() === mockProject._id.toString()) return mockProject;
        return null;
      });
      (File.findById as jest.Mock).mockResolvedValue(mockFile);
      (Segment.find as jest.Mock).mockResolvedValue([
        { status: SegmentStatus.TRANSLATED },
        { status: SegmentStatus.COMPLETED }
      ]);
    });

    it('should update file progress successfully', async () => {
      await projectService.updateFileProgress(fileId, userId);

      expect(File.findById).toHaveBeenCalledWith(fileId);
      expect(Project.findById).toHaveBeenCalledWith(projectId);
      expect(mockFile.save).toHaveBeenCalled();
      expect(mockProject.save).toHaveBeenCalled();
    });

    it('should throw error if project not found', async () => {
      (Project.findById as jest.Mock).mockResolvedValue(null);

      await expect(projectService.updateFileProgress(fileId, userId)).rejects.toThrow('项目不存在');
    });
  });

  describe('updateProjectProgress', () => {
    const mockProject = createMockProject({
      _id: new Types.ObjectId(projectId),
      managerId: userId,
      id: projectId,
      status: ProjectStatus.IN_PROGRESS,
      save: jest.fn().mockResolvedValue(undefined)
    });

    const progressData: ProjectProgressDto = {
      completionPercentage: 50,
      translatedWords: 100,
      totalWords: 200
    };

    beforeEach(() => {
      (Project.findById as jest.Mock).mockResolvedValue(mockProject);
    });

    it('should update project progress successfully', async () => {
      const result = await projectService.updateProjectProgress(projectId, userId, progressData);

      expect(result.progress).toEqual(progressData);
      expect(result.status).toBe(ProjectStatus.IN_PROGRESS);
      expect(mockProject.save).toHaveBeenCalled();
    });

    it('should set project status to completed when progress is 100%', async () => {
      const completedProgress: ProjectProgressDto = {
        ...progressData,
        completionPercentage: 100
      };

      const result = await projectService.updateProjectProgress(projectId, userId, completedProgress);

      expect(result.progress).toEqual(completedProgress);
      expect(result.status).toBe(ProjectStatus.COMPLETED);
      expect(mockProject.save).toHaveBeenCalled();
    });

    it('should throw NotFoundError if project does not exist', async () => {
      (Project.findById as jest.Mock).mockResolvedValue(null);

      await expect(projectService.updateProjectProgress(projectId, userId, progressData))
        .rejects
        .toThrow(NotFoundError);
    });
  });
}); 