"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const project_types_1 = require("../../types/project.types");
const project_model_1 = __importDefault(require("../../models/project.model"));
const file_model_1 = require("../../models/file.model");
const project_service_1 = require("../../services/project.service");
const errors_1 = require("../../utils/errors");
const projects_1 = require("../../test/fixtures/projects");
const s3Utils = __importStar(require("../../utils/s3"));
const fileProcessor_1 = require("../../utils/fileProcessor");
const segment_model_1 = require("../../models/segment.model");
// Mock the models and utilities
jest.mock('../../models/project.model');
jest.mock('../../models/file.model');
jest.mock('../../models/segment.model');
jest.mock('../../utils/s3');
jest.mock('../../utils/fileProcessor', () => ({
    processFile: jest.fn()
}));
const MockProject = project_model_1.default;
const MockFile = file_model_1.File;
// Factory functions for creating mock objects
function createMockProject(data = {}) {
    const defaultProject = {
        _id: new mongoose_1.Types.ObjectId(),
        id: new mongoose_1.Types.ObjectId().toString(),
        toObject: function () {
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
function createMockFile(data = {}) {
    const defaultFile = {
        _id: new mongoose_1.Types.ObjectId(),
        id: new mongoose_1.Types.ObjectId().toString(),
        toObject: function () {
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
    let projectService;
    const userId = new mongoose_1.Types.ObjectId().toString();
    const projectId = new mongoose_1.Types.ObjectId().toString();
    const fileId = new mongoose_1.Types.ObjectId().toString();
    beforeEach(() => {
        projectService = new project_service_1.ProjectService();
        jest.clearAllMocks();
    });
    describe('createProject', () => {
        it('should create a project successfully', async () => {
            const projectData = {
                name: 'Test Project',
                description: 'Test Description',
                sourceLanguage: 'en',
                targetLanguage: 'zh',
                managerId: userId,
                translationPromptTemplate: 'translation template',
                reviewPromptTemplate: 'review template',
                priority: project_types_1.ProjectPriority.HIGH,
                deadline: new Date('2024-12-31')
            };
            const expectedProject = {
                _id: new mongoose_1.Types.ObjectId(projectId),
                ...projectData,
                status: project_types_1.ProjectStatus.PENDING,
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
                    _id: new mongoose_1.Types.ObjectId(projectId),
                    id: projectId,
                    status: project_types_1.ProjectStatus.PENDING,
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
            MockProject.mockImplementation(() => expectedProject);
            const result = await projectService.createProject(projectData);
            expect(MockProject).toHaveBeenCalledWith(expect.objectContaining({
                ...projectData,
                status: project_types_1.ProjectStatus.PENDING,
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
            const mockError = new Error('E11000 duplicate key error collection: test.projects index: name_1 dup key');
            mockError.name = 'MongoServerError';
            mockError.code = 11000;
            const mockSave = jest.fn().mockRejectedValue(mockError);
            MockProject.mockImplementation(() => ({
                save: mockSave
            }));
            await expect(projectService.createProject({
                ...projects_1.mockProjects[0],
                managerId: userId
            }))
                .rejects
                .toThrow(errors_1.ConflictError);
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
            const mockError = new errors_1.ValidationError('验证失败');
            const mockSave = jest.fn().mockRejectedValue(mockError);
            MockProject.mockImplementation(() => ({
                save: mockSave
            }));
            await expect(projectService.createProject(invalidData))
                .rejects
                .toThrow(errors_1.ValidationError);
        });
    });
    describe('getProjectById', () => {
        it('should return a project if it exists and user has access', async () => {
            const createdAt = new Date('2024-01-01T00:00:00.000Z');
            const updatedAt = new Date('2024-01-01T00:00:00.000Z');
            const mockProject = createMockProject({
                _id: new mongoose_1.Types.ObjectId(projectId),
                name: 'Test Project',
                description: 'Test Description',
                sourceLanguage: 'en',
                targetLanguage: 'zh',
                managerId: userId,
                translationPromptTemplate: 'translation template',
                reviewPromptTemplate: 'review template',
                priority: project_types_1.ProjectPriority.HIGH,
                deadline: new Date('2024-12-31'),
                status: project_types_1.ProjectStatus.PENDING,
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
                _id: new mongoose_1.Types.ObjectId(projectId),
                managerId: userId
            });
        });
        it('should throw NotFoundError if project does not exist', async () => {
            MockProject.findOne = jest.fn().mockResolvedValue(null);
            await expect(projectService.getProjectById(projectId, userId))
                .rejects
                .toThrow(errors_1.NotFoundError);
        });
    });
    describe('uploadProjectFile', () => {
        const mockFileData = {
            originalName: 'test.txt',
            fileSize: 1024,
            mimeType: 'text/txt',
            filePath: '/uploads/test.txt',
            sourceLanguage: 'en',
            targetLanguage: 'zh',
            category: 'test',
            tags: ['test']
        };
        const mockProject = {
            _id: new mongoose_1.Types.ObjectId('67e289a55e7a3aed7505d9df'),
            name: 'Test Project',
            description: 'Test Description',
            sourceLanguage: 'en',
            targetLanguage: 'zh',
            managerId: new mongoose_1.Types.ObjectId(userId),
            reviewers: [],
            translationPromptTemplate: 'Test Template',
            reviewPromptTemplate: 'Test Template',
            status: project_types_1.ProjectStatus.PENDING,
            priority: project_types_1.ProjectPriority.MEDIUM,
            progress: {
                completionPercentage: 0,
                translatedWords: 0,
                totalWords: 0
            },
            save: jest.fn().mockResolvedValue(undefined),
            deleteOne: jest.fn().mockResolvedValue(undefined),
            toObject: jest.fn().mockReturnThis()
        };
        const mockFile = {
            _id: new mongoose_1.Types.ObjectId('67e287866fbba6a28e89ff26'),
            projectId: mockProject._id,
            fileName: 'test.txt',
            originalName: 'test.txt',
            fileSize: 1024,
            mimeType: 'text/txt',
            type: file_model_1.FileType.TXT,
            status: file_model_1.FileStatus.PENDING,
            uploadedBy: new mongoose_1.Types.ObjectId(userId),
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
                _id: new mongoose_1.Types.ObjectId(),
                fileId: new mongoose_1.Types.ObjectId(fileId),
                sourceText: 'Hello',
                targetText: '',
                status: segment_model_1.SegmentStatus.PENDING,
                index: 1
            }
        ];
        beforeEach(() => {
            jest.clearAllMocks();
            s3Utils.uploadToS3.mockResolvedValue('https://test-bucket.s3.amazonaws.com/test.txt');
            MockFile.create.mockResolvedValue(mockFile);
            MockProject.findById.mockResolvedValue(mockProject);
        });
        it('should upload file successfully', async () => {
            const result = await projectService.uploadProjectFile(projectId, userId, mockFileData);
            expect(s3Utils.uploadToS3).toHaveBeenCalledWith(mockFileData.filePath, expect.stringContaining(mockFileData.originalName), mockFileData.mimeType);
            expect(MockFile.create).toHaveBeenCalledWith(expect.objectContaining({
                projectId: new mongoose_1.Types.ObjectId(projectId),
                fileName: mockFileData.originalName,
                originalName: mockFileData.originalName,
                fileSize: mockFileData.fileSize,
                mimeType: mockFileData.mimeType,
                type: file_model_1.FileType.TXT,
                status: file_model_1.FileStatus.PENDING,
                uploadedBy: new mongoose_1.Types.ObjectId(userId),
                storageUrl: 'https://test-bucket.s3.amazonaws.com/test.txt',
                path: expect.stringContaining(`projects/${projectId}/`),
                metadata: {
                    sourceLanguage: mockFileData.sourceLanguage,
                    targetLanguage: mockFileData.targetLanguage,
                    category: mockFileData.category,
                    tags: mockFileData.tags
                }
            }));
            expect(result).toEqual({
                _id: mockFile._id,
                projectId: mockProject._id,
                fileName: mockFileData.originalName,
                originalName: mockFileData.originalName,
                fileSize: mockFileData.fileSize,
                mimeType: mockFileData.mimeType,
                type: file_model_1.FileType.TXT,
                status: file_model_1.FileStatus.PENDING,
                uploadedBy: new mongoose_1.Types.ObjectId(userId),
                storageUrl: 'https://test-bucket.s3.amazonaws.com/test.txt',
                path: expect.stringContaining(`projects/${projectId}/`),
                metadata: {
                    sourceLanguage: mockFileData.sourceLanguage,
                    targetLanguage: mockFileData.targetLanguage,
                    category: mockFileData.category,
                    tags: mockFileData.tags
                },
                translatedCount: 0,
                reviewedCount: 0,
                save: expect.any(Function)
            });
        });
        it('should use project default languages if not provided', async () => {
            const fileDataWithoutLanguages = {
                ...mockFileData,
                sourceLanguage: undefined,
                targetLanguage: undefined
            };
            const result = await projectService.uploadProjectFile(projectId, userId, fileDataWithoutLanguages);
            expect(MockFile.create).toHaveBeenCalledWith(expect.objectContaining({
                projectId: new mongoose_1.Types.ObjectId(projectId),
                fileName: fileDataWithoutLanguages.originalName,
                originalName: fileDataWithoutLanguages.originalName,
                fileSize: fileDataWithoutLanguages.fileSize,
                mimeType: fileDataWithoutLanguages.mimeType,
                type: file_model_1.FileType.TXT,
                status: file_model_1.FileStatus.PENDING,
                uploadedBy: new mongoose_1.Types.ObjectId(userId),
                storageUrl: 'https://test-bucket.s3.amazonaws.com/test.txt',
                path: expect.stringContaining(`projects/${projectId}/`),
                metadata: {
                    sourceLanguage: mockProject.sourceLanguage,
                    targetLanguage: mockProject.targetLanguage,
                    category: fileDataWithoutLanguages.category,
                    tags: fileDataWithoutLanguages.tags
                }
            }));
            expect(result).toEqual({
                _id: mockFile._id,
                projectId: mockProject._id,
                fileName: fileDataWithoutLanguages.originalName,
                originalName: fileDataWithoutLanguages.originalName,
                fileSize: fileDataWithoutLanguages.fileSize,
                mimeType: fileDataWithoutLanguages.mimeType,
                type: file_model_1.FileType.TXT,
                status: file_model_1.FileStatus.PENDING,
                uploadedBy: new mongoose_1.Types.ObjectId(userId),
                storageUrl: 'https://test-bucket.s3.amazonaws.com/test.txt',
                path: expect.stringContaining(`projects/${projectId}/`),
                metadata: {
                    sourceLanguage: mockProject.sourceLanguage,
                    targetLanguage: mockProject.targetLanguage,
                    category: fileDataWithoutLanguages.category,
                    tags: fileDataWithoutLanguages.tags
                },
                translatedCount: 0,
                reviewedCount: 0,
                save: expect.any(Function)
            });
        });
        it('should throw error for unsupported file type', async () => {
            const fileDataWithUnsupportedType = {
                ...mockFileData,
                originalName: 'test.unsupported',
                mimeType: 'application/unsupported'
            };
            await expect(projectService.uploadProjectFile(projectId, userId, fileDataWithUnsupportedType))
                .rejects
                .toThrow('不支持的文件类型');
        });
    });
    describe('getUserProjects', () => {
        it('should return projects with pagination', async () => {
            const mockPaginatedProjects = {
                projects: projects_1.mockProjects.map(project => ({
                    ...project,
                    _id: new mongoose_1.Types.ObjectId(),
                    managerId: userId,
                    id: new mongoose_1.Types.ObjectId().toString(),
                    toObject: () => ({
                        ...project,
                        _id: new mongoose_1.Types.ObjectId(),
                        managerId: userId,
                        id: new mongoose_1.Types.ObjectId().toString()
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
                status: project_types_1.ProjectStatus.IN_PROGRESS,
                priority: project_types_1.ProjectPriority.HIGH,
                search: 'test',
                limit: 5,
                page: 2
            };
            const mockFilteredProjects = [
                {
                    ...projects_1.mockProjects[0],
                    _id: new mongoose_1.Types.ObjectId(),
                    managerId: userId,
                    id: new mongoose_1.Types.ObjectId().toString(),
                    toObject: () => ({
                        ...projects_1.mockProjects[0],
                        _id: new mongoose_1.Types.ObjectId(),
                        managerId: userId,
                        id: new mongoose_1.Types.ObjectId().toString()
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
            const updateData = {
                name: 'Updated Project',
                description: 'Updated Description',
                status: project_types_1.ProjectStatus.IN_PROGRESS,
                priority: project_types_1.ProjectPriority.HIGH,
                deadline: new Date('2024-12-31'),
                translationPromptTemplate: 'updated translation template',
                reviewPromptTemplate: 'updated review template'
            };
            const mockProject = {
                _id: new mongoose_1.Types.ObjectId(projectId),
                ...updateData,
                managerId: userId,
                sourceLanguage: 'en',
                targetLanguage: 'zh',
                id: projectId,
                save: jest.fn().mockResolvedValue(undefined),
                toObject: () => ({
                    _id: new mongoose_1.Types.ObjectId(projectId),
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
                _id: new mongoose_1.Types.ObjectId(projectId),
                managerId: userId
            });
        });
        it('should throw ForbiddenError if user is not project manager', async () => {
            const updateData = {
                name: 'Updated Project',
                description: 'Updated Description',
                status: project_types_1.ProjectStatus.IN_PROGRESS,
                priority: project_types_1.ProjectPriority.HIGH,
                deadline: new Date('2024-12-31'),
                translationPromptTemplate: 'updated translation template',
                reviewPromptTemplate: 'updated review template'
            };
            MockProject.findOne = jest.fn().mockResolvedValue(null);
            await expect(projectService.updateProject(projectId, userId, updateData))
                .rejects
                .toThrow(errors_1.NotFoundError);
        });
    });
    describe('deleteProject', () => {
        it('should delete project successfully if user is manager', async () => {
            const mockProject = {
                _id: new mongoose_1.Types.ObjectId(projectId),
                managerId: userId,
                id: projectId,
                deleteOne: jest.fn().mockResolvedValue(undefined)
            };
            MockProject.findOne = jest.fn().mockResolvedValue(mockProject);
            MockFile.deleteMany = jest.fn().mockResolvedValue(undefined);
            const result = await projectService.deleteProject(projectId, userId);
            expect(result).toEqual({ success: true });
            expect(mockProject.deleteOne).toHaveBeenCalled();
            expect(MockFile.deleteMany).toHaveBeenCalledWith({ projectId: new mongoose_1.Types.ObjectId(projectId) });
        });
        it('should throw ForbiddenError if user is not project manager', async () => {
            MockProject.findOne = jest.fn().mockResolvedValue(null);
            await expect(projectService.deleteProject(projectId, userId))
                .rejects
                .toThrow(errors_1.NotFoundError);
        });
    });
    describe('getProjectFiles', () => {
        it('should return files if user has access', async () => {
            const mockProject = createMockProject({
                _id: new mongoose_1.Types.ObjectId(projectId),
                managerId: userId,
                id: projectId
            });
            const mockFiles = [
                createMockFile({
                    _id: new mongoose_1.Types.ObjectId(),
                    originalName: 'test1.txt',
                    projectId: new mongoose_1.Types.ObjectId(projectId),
                    status: file_model_1.FileStatus.PENDING,
                    type: file_model_1.FileType.TXT,
                    id: new mongoose_1.Types.ObjectId().toString()
                }),
                createMockFile({
                    _id: new mongoose_1.Types.ObjectId(),
                    originalName: 'test2.txt',
                    projectId: new mongoose_1.Types.ObjectId(projectId),
                    status: file_model_1.FileStatus.COMPLETED,
                    type: file_model_1.FileType.TXT,
                    id: new mongoose_1.Types.ObjectId().toString()
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
            expect(MockFile.find).toHaveBeenCalledWith({ projectId: new mongoose_1.Types.ObjectId(projectId) });
        });
        it('should throw NotFoundError if project does not exist', async () => {
            MockProject.findById = jest.fn().mockResolvedValue(null);
            await expect(projectService.getProjectFiles(projectId, userId))
                .rejects
                .toThrow(errors_1.NotFoundError);
        });
        it('should throw ForbiddenError if user is not project manager', async () => {
            const mockProject = {
                _id: new mongoose_1.Types.ObjectId(projectId),
                managerId: new mongoose_1.Types.ObjectId().toString(),
                id: projectId
            };
            MockProject.findById = jest.fn().mockResolvedValue(mockProject);
            await expect(projectService.getProjectFiles(projectId, userId))
                .rejects
                .toThrow(errors_1.ForbiddenError);
        });
    });
    describe('processFile', () => {
        const mockProject = createMockProject({
            _id: new mongoose_1.Types.ObjectId(projectId),
            managerId: userId,
            sourceLanguage: 'en',
            targetLanguage: 'zh'
        });
        const mockFile = createMockFile({
            _id: new mongoose_1.Types.ObjectId(fileId),
            projectId: mockProject._id,
            type: file_model_1.FileType.TXT,
            status: file_model_1.FileStatus.PENDING
        });
        beforeEach(() => {
            jest.clearAllMocks();
            // Mock Project.findById
            project_model_1.default.findById.mockImplementation((id) => {
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
            file_model_1.File.findById.mockImplementation((id) => {
                if (id === mockFile._id.toString()) {
                    return Promise.resolve(mockFile);
                }
                return Promise.resolve(null);
            });
            // Mock processFileUtil
            fileProcessor_1.processFile.mockResolvedValue([
                { content: 'Test content 1', status: segment_model_1.SegmentStatus.PENDING },
                { content: 'Test content 2', status: segment_model_1.SegmentStatus.PENDING }
            ]);
            // Mock Segment.insertMany
            segment_model_1.Segment.insertMany.mockResolvedValue([]);
            // Mock Segment.find
            segment_model_1.Segment.find.mockResolvedValue([
                { status: segment_model_1.SegmentStatus.TRANSLATED },
                { status: segment_model_1.SegmentStatus.COMPLETED }
            ]);
        });
        it('should process file successfully', async () => {
            await projectService.processFile(fileId, userId);
            expect(file_model_1.File.findById).toHaveBeenCalledWith(fileId);
            expect(project_model_1.default.findById).toHaveBeenCalledWith(projectId);
            expect(mockFile.save).toHaveBeenCalled();
            expect(mockProject.save).toHaveBeenCalled();
        });
        it('should throw error if project not found', async () => {
            project_model_1.default.findById.mockResolvedValue(null);
            await expect(projectService.processFile(fileId, userId)).rejects.toThrow('项目不存在');
        });
    });
    describe('getFileSegments', () => {
        const mockFile = createMockFile({
            _id: new mongoose_1.Types.ObjectId(fileId),
            projectId: new mongoose_1.Types.ObjectId(projectId),
            uploadedBy: userId
        });
        const mockProject = createMockProject({
            _id: new mongoose_1.Types.ObjectId(projectId),
            managerId: userId,
            id: projectId
        });
        const mockSegments = [
            {
                _id: new mongoose_1.Types.ObjectId(),
                fileId: new mongoose_1.Types.ObjectId(fileId),
                sourceText: 'Hello',
                targetText: '',
                status: segment_model_1.SegmentStatus.PENDING,
                index: 1
            }
        ];
        beforeEach(() => {
            MockFile.findById.mockResolvedValue(mockFile);
            MockProject.findById.mockResolvedValue(mockProject);
            segment_model_1.Segment.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockSegments)
            });
            segment_model_1.Segment.countDocuments.mockResolvedValue(1);
        });
        it('should return segments with pagination', async () => {
            const result = await projectService.getFileSegments(fileId, userId, {
                status: segment_model_1.SegmentStatus.PENDING,
                page: 1,
                limit: 10
            });
            expect(result.segments).toEqual(mockSegments);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(10);
            expect(segment_model_1.Segment.find).toHaveBeenCalledWith(expect.objectContaining({
                fileId: fileId,
                status: segment_model_1.SegmentStatus.PENDING
            }));
        });
        it('should throw NotFoundError if file does not exist', async () => {
            MockFile.findById.mockResolvedValue(null);
            await expect(projectService.getFileSegments(fileId, userId))
                .rejects
                .toThrow(errors_1.NotFoundError);
        });
        it('should throw ForbiddenError if user is not authorized', async () => {
            const mockProjectWithDifferentManager = createMockProject({
                ...mockProject,
                managerId: new mongoose_1.Types.ObjectId().toString()
            });
            MockProject.findById.mockResolvedValue(mockProjectWithDifferentManager);
            await expect(projectService.getFileSegments(fileId, userId))
                .rejects
                .toThrow(errors_1.ForbiddenError);
        });
    });
    describe('updateFileProgress', () => {
        const mockProject = createMockProject({
            _id: new mongoose_1.Types.ObjectId(projectId),
            managerId: userId,
            sourceLanguage: 'en',
            targetLanguage: 'zh'
        });
        const mockFile = createMockFile({
            _id: new mongoose_1.Types.ObjectId(fileId),
            projectId: mockProject._id,
            type: file_model_1.FileType.TXT,
            status: file_model_1.FileStatus.TRANSLATED,
            save: jest.fn().mockResolvedValue(undefined)
        });
        beforeEach(() => {
            project_model_1.default.findById.mockImplementation((id) => {
                if (id.toString() === projectId)
                    return mockProject;
                if (id.toString() === mockProject._id.toString())
                    return mockProject;
                return null;
            });
            file_model_1.File.findById.mockResolvedValue(mockFile);
            segment_model_1.Segment.find.mockResolvedValue([
                { status: segment_model_1.SegmentStatus.TRANSLATED },
                { status: segment_model_1.SegmentStatus.COMPLETED }
            ]);
        });
        it('should update file progress successfully', async () => {
            await projectService.updateFileProgress(fileId, userId);
            expect(file_model_1.File.findById).toHaveBeenCalledWith(fileId);
            expect(project_model_1.default.findById).toHaveBeenCalledWith(projectId);
            expect(mockFile.save).toHaveBeenCalled();
            expect(mockProject.save).toHaveBeenCalled();
        });
        it('should throw error if project not found', async () => {
            project_model_1.default.findById.mockResolvedValue(null);
            await expect(projectService.updateFileProgress(fileId, userId)).rejects.toThrow('项目不存在');
        });
    });
    describe('updateProjectProgress', () => {
        const mockProject = createMockProject({
            _id: new mongoose_1.Types.ObjectId(projectId),
            managerId: userId,
            id: projectId,
            status: project_types_1.ProjectStatus.IN_PROGRESS,
            save: jest.fn().mockResolvedValue(undefined)
        });
        const progressData = {
            completionPercentage: 50,
            translatedWords: 100,
            totalWords: 200
        };
        beforeEach(() => {
            project_model_1.default.findById.mockResolvedValue(mockProject);
        });
        it('should update project progress successfully', async () => {
            const result = await projectService.updateProjectProgress(projectId, userId, progressData);
            expect(result.progress).toEqual(progressData);
            expect(result.status).toBe(project_types_1.ProjectStatus.IN_PROGRESS);
            expect(mockProject.save).toHaveBeenCalled();
        });
        it('should set project status to completed when progress is 100%', async () => {
            const completedProgress = {
                ...progressData,
                completionPercentage: 100
            };
            const result = await projectService.updateProjectProgress(projectId, userId, completedProgress);
            expect(result.progress).toEqual(completedProgress);
            expect(result.status).toBe(project_types_1.ProjectStatus.COMPLETED);
            expect(mockProject.save).toHaveBeenCalled();
        });
        it('should throw NotFoundError if project does not exist', async () => {
            project_model_1.default.findById.mockResolvedValue(null);
            await expect(projectService.updateProjectProgress(projectId, userId, progressData))
                .rejects
                .toThrow(errors_1.NotFoundError);
        });
    });
});
