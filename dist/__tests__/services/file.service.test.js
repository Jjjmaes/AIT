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
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const file_service_1 = require("../../services/file.service");
const file_model_1 = require("../../models/file.model");
const segment_model_1 = require("../../models/segment.model");
const errors_1 = require("../../utils/errors");
const s3Utils = __importStar(require("../../utils/s3"));
const fileProcessor_1 = require("../../utils/fileProcessor");
// Mock the models and utilities
jest.mock('../../models/file.model');
jest.mock('../../models/segment.model');
jest.mock('../../utils/s3');
jest.mock('../../utils/fileProcessor');
const MockFile = file_model_1.File;
const MockSegment = segment_model_1.Segment;
describe('FileService', () => {
    let fileService;
    const mockFileId = '67e27da644c3afaaa928c8fa';
    const mockProjectId = '67e27da644c3afaaa928c8fb';
    const mockUserId = '67e27da644c3afaaa928c8fc';
    const mockFile = {
        _id: mockFileId,
        projectId: mockProjectId,
        fileName: 'test.txt',
        originalName: 'test.txt',
        fileSize: 1024,
        mimeType: 'text/plain',
        type: file_model_1.FileType.TXT,
        status: file_model_1.FileStatus.PENDING,
        uploadedBy: mockUserId,
        storageUrl: 'https://test-bucket.s3.amazonaws.com/test.txt',
        path: `files/${mockProjectId}/12345-test.txt`,
        metadata: {
            sourceLanguage: 'en',
            targetLanguage: 'zh',
            category: 'test',
            tags: ['test']
        },
        error: '',
        errorDetails: '',
        segmentCount: 0,
        translatedCount: 0,
        reviewedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockResolvedValue(this),
        deleteOne: jest.fn().mockResolvedValue({}),
        toObject: () => ({
            _id: mockFileId,
            projectId: mockProjectId,
            fileName: 'test.txt',
            originalName: 'test.txt',
            fileSize: 1024,
            mimeType: 'text/plain',
            type: file_model_1.FileType.TXT,
            status: file_model_1.FileStatus.PENDING,
            uploadedBy: mockUserId,
            storageUrl: 'https://test-bucket.s3.amazonaws.com/test.txt',
            path: `files/${mockProjectId}/12345-test.txt`,
            metadata: {
                sourceLanguage: 'en',
                targetLanguage: 'zh',
                category: 'test',
                tags: ['test']
            }
        })
    };
    const mockSegment = {
        _id: new mongoose_1.Types.ObjectId(),
        fileId: mockFile._id,
        content: 'Test content',
        order: 1,
        status: segment_model_1.SegmentStatus.PENDING,
        originalLength: 12,
        translatedLength: 0,
        metadata: {}
    };
    beforeEach(() => {
        fileService = new file_service_1.FileService();
        jest.clearAllMocks();
        s3Utils.uploadToS3.mockResolvedValue('https://test-bucket.s3.amazonaws.com/test.txt');
        file_model_1.File.create.mockResolvedValue(mockFile);
        file_model_1.File.findById.mockResolvedValue(mockFile);
    });
    describe('uploadFile', () => {
        const mockFileId = '67e27da644c3afaaa928c8fa';
        const mockProjectId = '67e27da644c3afaaa928c8fb';
        const mockUserId = '67e27da644c3afaaa928c8fc';
        const mockFileData = {
            originalName: 'test.txt',
            fileSize: 1024,
            mimeType: 'text/plain',
            filePath: '/uploads/test.txt',
            sourceLanguage: 'en',
            targetLanguage: 'zh',
            category: 'test',
            tags: ['test']
        };
        const mockFile = {
            _id: mockFileId,
            projectId: mockProjectId,
            fileName: 'test.txt',
            originalName: 'test.txt',
            fileSize: 1024,
            mimeType: 'text/plain',
            type: file_model_1.FileType.TXT,
            status: file_model_1.FileStatus.PENDING,
            uploadedBy: mockUserId,
            storageUrl: 'https://test-bucket.s3.amazonaws.com/test.txt',
            path: `files/${mockProjectId}/12345-test.txt`,
            metadata: {
                sourceLanguage: 'en',
                targetLanguage: 'zh',
                category: 'test',
                tags: ['test']
            },
            save: jest.fn().mockResolvedValue(this),
            toObject: () => ({
                _id: mockFileId,
                projectId: mockProjectId,
                fileName: 'test.txt',
                originalName: 'test.txt',
                fileSize: 1024,
                mimeType: 'text/plain',
                type: file_model_1.FileType.TXT,
                status: file_model_1.FileStatus.PENDING,
                uploadedBy: mockUserId,
                storageUrl: 'https://test-bucket.s3.amazonaws.com/test.txt',
                path: `files/${mockProjectId}/12345-test.txt`,
                metadata: {
                    sourceLanguage: 'en',
                    targetLanguage: 'zh',
                    category: 'test',
                    tags: ['test']
                }
            })
        };
        beforeEach(() => {
            jest.clearAllMocks();
            s3Utils.uploadToS3.mockResolvedValue('https://test-bucket.s3.amazonaws.com/test.txt');
            file_model_1.File.create.mockResolvedValue(mockFile);
            file_model_1.File.findById.mockResolvedValue(mockFile);
        });
        it('should upload file successfully', async () => {
            const result = await fileService.uploadFile(mockProjectId, mockUserId, mockFileData);
            expect(s3Utils.uploadToS3).toHaveBeenCalledWith(mockFileData.filePath, expect.stringContaining(mockFileData.originalName), mockFileData.mimeType);
            expect(file_model_1.File.create).toHaveBeenCalledWith(expect.objectContaining({
                projectId: new mongoose_1.Types.ObjectId(mockProjectId),
                fileName: expect.any(String),
                originalName: mockFileData.originalName,
                fileSize: mockFileData.fileSize,
                mimeType: mockFileData.mimeType,
                type: file_model_1.FileType.TXT,
                status: file_model_1.FileStatus.PENDING,
                uploadedBy: new mongoose_1.Types.ObjectId(mockUserId),
                storageUrl: expect.any(String),
                path: expect.any(String),
                metadata: {
                    sourceLanguage: mockFileData.sourceLanguage,
                    targetLanguage: mockFileData.targetLanguage,
                    category: mockFileData.category,
                    tags: mockFileData.tags
                }
            }));
            expect(result).toEqual(expect.objectContaining({
                _id: mockFileId,
                projectId: mockProjectId,
                fileName: 'test.txt'
            }));
        });
        it('should handle upload errors', async () => {
            s3Utils.uploadToS3.mockRejectedValue(new Error('Upload failed'));
            await expect(fileService.uploadFile(mockProjectId, mockUserId, mockFileData))
                .rejects
                .toThrow('Upload failed');
        });
        it('should throw error for unsupported file type', async () => {
            const unsupportedFileData = {
                ...mockFileData,
                originalName: 'test.xyz'
            };
            await expect(fileService.uploadFile(mockProjectId, mockUserId, unsupportedFileData)).rejects.toThrow(errors_1.ValidationError);
        });
    });
    describe('getFileById', () => {
        it('should return file details', async () => {
            file_model_1.File.findById.mockResolvedValue(mockFile);
            const result = await fileService.getFileById(mockFileId);
            expect(file_model_1.File.findById).toHaveBeenCalledWith(mockFileId);
            expect(result).toMatchObject({
                _id: mockFileId,
                projectId: mockProjectId,
                fileName: 'test.txt'
            });
        });
        it('should throw NotFoundError if file not found', async () => {
            file_model_1.File.findById.mockResolvedValue(null);
            await expect(fileService.getFileById(mockFileId)).rejects.toThrow(errors_1.NotFoundError);
        });
    });
    describe('processFile', () => {
        const mockSegments = [
            {
                content: 'Test content 1',
                originalLength: 15,
                translatedLength: 0,
                status: segment_model_1.SegmentStatus.PENDING
            },
            {
                content: 'Test content 2',
                originalLength: 15,
                translatedLength: 0,
                status: segment_model_1.SegmentStatus.PENDING
            }
        ];
        it('should process file successfully', async () => {
            file_model_1.File.findById.mockResolvedValue(mockFile);
            s3Utils.getFileContent.mockResolvedValue('Test content');
            fileProcessor_1.processFile.mockResolvedValue(mockSegments);
            segment_model_1.Segment.create.mockResolvedValue(mockSegments);
            const result = await fileService.processFile(mockFileId);
            expect(s3Utils.getFileContent).toHaveBeenCalledWith(mockFile.path);
            expect(fileProcessor_1.processFile).toHaveBeenCalledWith('Test content', file_model_1.FileType.TXT, expect.any(Object));
            expect(segment_model_1.Segment.create).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({
                    fileId: mockFile._id,
                    content: expect.any(String),
                    status: segment_model_1.SegmentStatus.PENDING
                })
            ]));
            expect(mockFile.save).toHaveBeenCalled();
            expect(result).toEqual(mockSegments);
        });
        it('should handle processing errors', async () => {
            const mockFileWithError = {
                ...mockFile,
                status: file_model_1.FileStatus.PENDING,
                save: jest.fn()
            };
            file_model_1.File.findById.mockResolvedValue(mockFileWithError);
            const mockError = new Error('Processing failed');
            fileProcessor_1.processFile.mockRejectedValue(mockError);
            await expect(fileService.processFile(mockFileId)).rejects.toThrow(mockError);
            expect(mockFileWithError.status).toBe(file_model_1.FileStatus.ERROR);
            expect(mockFileWithError.error).toBe('Processing failed');
            expect(mockFileWithError.errorDetails).toBe(mockError.stack);
            expect(mockFileWithError.save).toHaveBeenCalled();
        });
    });
    describe('deleteFile', () => {
        it('should delete file successfully', async () => {
            file_model_1.File.findById.mockResolvedValue(mockFile);
            s3Utils.deleteFromS3.mockResolvedValue(undefined);
            segment_model_1.Segment.deleteMany.mockResolvedValue({ deletedCount: 1 });
            const result = await fileService.deleteFile(mockFileId);
            expect(s3Utils.deleteFromS3).toHaveBeenCalledWith(mockFile.path);
            expect(mockFile.deleteOne).toHaveBeenCalled();
            expect(segment_model_1.Segment.deleteMany).toHaveBeenCalledWith({ fileId: mockFile._id });
            expect(result).toBe(true);
        });
        it('should throw NotFoundError if file not found', async () => {
            file_model_1.File.findById.mockResolvedValue(null);
            await expect(fileService.deleteFile(mockFileId)).rejects.toThrow(errors_1.NotFoundError);
        });
    });
    describe('exportFile', () => {
        const mockSegments = [
            {
                content: 'Test content 1',
                translation: '测试内容 1',
                metadata: { path: 'test1' }
            },
            {
                content: 'Test content 2',
                translation: '测试内容 2',
                metadata: { path: 'test2' }
            }
        ];
        it('should export file as text', async () => {
            file_model_1.File.findById.mockResolvedValue(mockFile);
            const mockQuery = {
                sort: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockSegments)
            };
            segment_model_1.Segment.find.mockReturnValue(mockQuery);
            s3Utils.uploadToS3.mockResolvedValue('https://test-bucket.s3.amazonaws.com/export.txt');
            const result = await fileService.exportFile(mockFileId, {
                format: 'txt',
                includeReview: true,
                includeMetadata: false
            });
            expect(segment_model_1.Segment.find).toHaveBeenCalledWith({ fileId: mockFileId });
            expect(mockQuery.sort).toHaveBeenCalledWith({ order: 1 });
            expect(mockQuery.exec).toHaveBeenCalled();
            expect(s3Utils.uploadToS3).toHaveBeenCalled();
            expect(result).toBe('https://test-bucket.s3.amazonaws.com/export.txt');
        });
        it('should export file as JSON', async () => {
            file_model_1.File.findById.mockResolvedValue(mockFile);
            const mockQuery = {
                sort: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockSegments)
            };
            segment_model_1.Segment.find.mockReturnValue(mockQuery);
            s3Utils.uploadToS3.mockResolvedValue('https://test-bucket.s3.amazonaws.com/export.json');
            const result = await fileService.exportFile(mockFileId, {
                format: 'json',
                includeReview: true,
                includeMetadata: true
            });
            expect(segment_model_1.Segment.find).toHaveBeenCalledWith({ fileId: mockFileId });
            expect(mockQuery.sort).toHaveBeenCalledWith({ order: 1 });
            expect(mockQuery.exec).toHaveBeenCalled();
            expect(s3Utils.uploadToS3).toHaveBeenCalled();
            expect(result).toBe('https://test-bucket.s3.amazonaws.com/export.json');
        });
    });
    describe('getFileSegments', () => {
        const mockFile = {
            _id: new mongoose_1.Types.ObjectId(mockFileId),
            projectId: new mongoose_1.Types.ObjectId(mockProjectId),
            uploadedBy: mockUserId
        };
        const mockSegments = [
            {
                _id: new mongoose_1.Types.ObjectId(),
                fileId: new mongoose_1.Types.ObjectId(mockFileId),
                sourceText: 'Hello',
                targetText: '',
                status: segment_model_1.SegmentStatus.PENDING,
                index: 1
            }
        ];
        beforeEach(() => {
            MockFile.findById.mockResolvedValue(mockFile);
            MockSegment.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue(mockSegments)
            });
            MockSegment.countDocuments.mockResolvedValue(1);
        });
        it('should return segments with pagination', async () => {
            const result = await fileService.getFileSegments(mockFileId, {
                status: segment_model_1.SegmentStatus.PENDING,
                page: 1,
                limit: 10
            });
            expect(result.segments).toEqual(mockSegments);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(10);
            expect(MockSegment.find).toHaveBeenCalledWith(expect.objectContaining({
                fileId: mockFileId,
                status: segment_model_1.SegmentStatus.PENDING
            }));
        });
        it('should throw NotFoundError if file does not exist', async () => {
            MockFile.findById.mockResolvedValue(null);
            await expect(fileService.getFileSegments(mockFileId))
                .rejects
                .toThrow(errors_1.NotFoundError);
        });
    });
    describe('updateFileProgress', () => {
        const mockFile = {
            _id: new mongoose_1.Types.ObjectId(mockFileId),
            projectId: new mongoose_1.Types.ObjectId(mockProjectId),
            uploadedBy: mockUserId,
            save: jest.fn().mockResolvedValue(undefined)
        };
        const mockSegments = [
            {
                _id: new mongoose_1.Types.ObjectId(),
                fileId: new mongoose_1.Types.ObjectId(mockFileId),
                status: segment_model_1.SegmentStatus.TRANSLATED
            },
            {
                _id: new mongoose_1.Types.ObjectId(),
                fileId: new mongoose_1.Types.ObjectId(mockFileId),
                status: segment_model_1.SegmentStatus.COMPLETED
            }
        ];
        beforeEach(() => {
            MockFile.findById.mockResolvedValue(mockFile);
            MockSegment.find.mockResolvedValue(mockSegments);
        });
        it('should update file progress successfully', async () => {
            await fileService.updateFileProgress(mockFileId);
            expect(MockSegment.find).toHaveBeenCalledWith({ fileId: mockFileId });
            expect(mockFile.save).toHaveBeenCalled();
        });
        it('should throw NotFoundError if file does not exist', async () => {
            MockFile.findById.mockResolvedValue(null);
            await expect(fileService.updateFileProgress(mockFileId))
                .rejects
                .toThrow(errors_1.NotFoundError);
        });
    });
});
