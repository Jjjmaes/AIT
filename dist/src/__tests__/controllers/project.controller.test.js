"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const project_controller_1 = __importDefault(require("../../controllers/project.controller"));
const project_service_1 = require("../../services/project.service");
const project_model_1 = require("../../models/project.model");
const project_types_1 = require("../../types/project.types");
const errors_1 = require("../../utils/errors");
const user_1 = require("../../types/user");
// Mock projectService
jest.mock('../../services/project.service');
describe('ProjectController', () => {
    let controller;
    let mockReq;
    let mockRes;
    let mockNext;
    const mockUserId = new mongoose_1.Types.ObjectId();
    const mockUser = {
        id: mockUserId.toString(),
        _id: mockUserId,
        email: 'test@example.com',
        username: 'testuser',
        role: 'translator'
    };
    beforeEach(() => {
        controller = new project_controller_1.default();
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
        project_service_1.projectService.uploadProjectFile.mockResolvedValue({
            _id: new mongoose_1.Types.ObjectId(),
            originalName: 'test.txt',
            fileName: 'test-123.txt'
        });
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
                _id: new mongoose_1.Types.ObjectId(),
                ...projectData,
                managerId: mockUser.id
            };
            project_service_1.projectService.createProject.mockResolvedValue(mockProject);
            await controller.createProject(mockReq, mockRes, mockNext);
            expect(project_service_1.projectService.createProject).toHaveBeenCalledWith({
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
            await controller.createProject(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0]).toHaveLength(1);
            expect(mockNext.mock.calls[0][0]).toBeDefined();
        });
        it('should handle validation errors', async () => {
            mockReq.body = projectData;
            const error = new errors_1.ValidationError('验证错误');
            project_service_1.projectService.createProject.mockRejectedValue(error);
            await controller.createProject(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
    describe('getProjects', () => {
        it('should get projects successfully', async () => {
            mockReq.query = {
                status: project_model_1.ProjectStatus.IN_PROGRESS,
                priority: project_types_1.ProjectPriority.HIGH,
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
            project_service_1.projectService.getUserProjects.mockResolvedValue(mockResult);
            await controller.getProjects(mockReq, mockRes, mockNext);
            expect(project_service_1.projectService.getUserProjects).toHaveBeenCalledWith(mockUser.id, {
                status: project_model_1.ProjectStatus.IN_PROGRESS,
                priority: project_types_1.ProjectPriority.HIGH,
                search: 'test',
                page: 1,
                limit: 10
            });
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: mockResult
            });
        });
        it('should handle unauthorized access', async () => {
            mockReq.user = undefined;
            await controller.getProjects(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalled();
            expect(mockNext.mock.calls[0]).toHaveLength(1);
            expect(mockNext.mock.calls[0][0]).toBeDefined();
        });
    });
    describe('getProject', () => {
        const projectId = new mongoose_1.Types.ObjectId().toString();
        it('should get a project successfully', async () => {
            mockReq.params = { projectId };
            const mockProject = {
                _id: projectId,
                name: 'Test Project'
            };
            project_service_1.projectService.getProjectById.mockResolvedValue(mockProject);
            await controller.getProject(mockReq, mockRes, mockNext);
            expect(project_service_1.projectService.getProjectById).toHaveBeenCalledWith(projectId, mockUser.id);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: { project: mockProject }
            });
        });
        it('should handle not found error', async () => {
            mockReq.params = { projectId };
            const error = new errors_1.NotFoundError('项目不存在');
            project_service_1.projectService.getProjectById.mockRejectedValue(error);
            await controller.getProject(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
    describe('updateProject', () => {
        const projectId = new mongoose_1.Types.ObjectId().toString();
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
            project_service_1.projectService.updateProject.mockResolvedValue(mockUpdatedProject);
            await controller.updateProject(mockReq, mockRes, mockNext);
            expect(project_service_1.projectService.updateProject).toHaveBeenCalledWith(projectId, mockUser.id, updateData);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: { project: mockUpdatedProject }
            });
        });
        it('should handle forbidden error', async () => {
            mockReq.params = { projectId };
            mockReq.body = updateData;
            const error = new errors_1.ForbiddenError('无权限操作此项目');
            project_service_1.projectService.updateProject.mockRejectedValue(error);
            await controller.updateProject(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
    describe('deleteProject', () => {
        const projectId = new mongoose_1.Types.ObjectId().toString();
        it('should delete a project successfully', async () => {
            mockReq.params = { projectId };
            const mockResult = { message: '项目删除成功' };
            project_service_1.projectService.deleteProject.mockResolvedValue(mockResult);
            await controller.deleteProject(mockReq, mockRes, mockNext);
            expect(project_service_1.projectService.deleteProject).toHaveBeenCalledWith(projectId, mockUser.id);
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: mockResult,
                message: mockResult.message
            });
        });
        it('should handle not found error', async () => {
            mockReq.params = { projectId };
            const error = new errors_1.NotFoundError('项目不存在');
            project_service_1.projectService.deleteProject.mockRejectedValue(error);
            await controller.deleteProject(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
    describe('uploadFile', () => {
        const projectId = '67e28162d7784e08596a90d2';
        const mockUser = {
            id: '67e28162d7784e08596a90ce',
            email: 'test@example.com',
            role: user_1.UserRole.MANAGER
        };
        const mockReq = {
            user: mockUser,
            params: { projectId },
            query: {},
            body: {
                sourceLanguage: 'en',
                targetLanguage: 'zh',
                category: 'test',
                tags: JSON.stringify(['test'])
            },
            file: {
                fieldname: 'file',
                originalname: 'test.txt',
                encoding: '7bit',
                mimetype: 'text/plain',
                size: 1024,
                destination: '/uploads',
                filename: 'test-123.txt',
                path: '/uploads/test-123.txt',
                buffer: Buffer.from('test content'),
                stream: null
            }
        };
        const mockReqWithoutFile = {
            ...mockReq,
            file: undefined,
            body: {}
        };
        const mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            sendStatus: jest.fn(),
            links: jest.fn(),
            send: jest.fn(),
            jsonp: jest.fn(),
            sendFile: jest.fn(),
            download: jest.fn(),
            contentType: jest.fn(),
            type: jest.fn(),
            format: jest.fn(),
            attachment: jest.fn(),
            app: {},
            headersSent: false,
            locals: {},
            charset: 'utf-8',
            statusCode: 200,
            statusMessage: 'OK'
        };
        const mockNext = jest.fn();
        beforeEach(() => {
            jest.clearAllMocks();
            project_service_1.projectService.uploadProjectFile.mockResolvedValue({
                _id: 'file123',
                originalName: 'test.txt',
                fileName: 'test-123.txt'
            });
        });
        it('should upload a file successfully', async () => {
            await controller.uploadFile(mockReq, mockRes, mockNext);
            expect(project_service_1.projectService.uploadProjectFile).toHaveBeenCalledWith(projectId, mockUser.id, {
                originalName: 'test.txt',
                fileSize: 1024,
                mimeType: 'text/plain',
                filePath: '/uploads/test-123.txt',
                sourceLanguage: 'en',
                targetLanguage: 'zh',
                fileType: 'test'
            });
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                data: {
                    _id: 'file123',
                    originalName: 'test.txt',
                    fileName: 'test-123.txt'
                }
            });
        });
        it('should return 400 if no file is uploaded', async () => {
            await controller.uploadFile(mockReqWithoutFile, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: '请选择要上传的文件'
            }));
        });
    });
    describe('getProjectFiles', () => {
        it('should get project files successfully', async () => {
            mockReq.params = { projectId: 'project123' };
            const mockFiles = [{ id: 'file1' }, { id: 'file2' }];
            project_service_1.projectService.getProjectFiles.mockResolvedValue(mockFiles);
            await controller.getProjectFiles(mockReq, mockRes, mockNext);
            expect(project_service_1.projectService.getProjectFiles).toHaveBeenCalledWith('project123', mockUser.id);
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
            await controller.processFile(mockReq, mockRes, mockNext);
            expect(project_service_1.projectService.processFile).toHaveBeenCalledWith('file123', mockUser.id);
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
            project_service_1.projectService.getFileSegments.mockResolvedValue(mockSegments);
            await controller.getFileSegments(mockReq, mockRes, mockNext);
            expect(project_service_1.projectService.getFileSegments).toHaveBeenCalledWith('file123', mockUser.id, {
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
            await controller.updateFileProgress(mockReq, mockRes, mockNext);
            expect(project_service_1.projectService.updateFileProgress).toHaveBeenCalledWith('file123', mockUser.id);
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
            await controller.updateProjectProgress(mockReq, mockRes, mockNext);
            expect(project_service_1.projectService.updateProjectProgress).toHaveBeenCalledWith('project123', mockUser.id, progressData);
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
            project_service_1.projectService.getProjectById.mockResolvedValue(mockProject);
            project_service_1.projectService.getProjectFiles.mockResolvedValue(mockFiles);
            await controller.getProjectStats(mockReq, mockRes, mockNext);
            expect(project_service_1.projectService.getProjectById).toHaveBeenCalledWith('project123', mockUser.id);
            expect(project_service_1.projectService.getProjectFiles).toHaveBeenCalledWith('project123', mockUser.id);
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
