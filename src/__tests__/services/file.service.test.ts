import { Types } from 'mongoose';
import { FileService } from '../../services/file.service';
import { File, FileType, FileStatus } from '../../models/file.model';
import { Segment, SegmentStatus } from '../../models/segment.model';
import { NotFoundError, ValidationError } from '../../utils/errors';
import * as s3Utils from '../../utils/s3';
import { processFile } from '../../utils/fileProcessor';
import { UploadFileDTO } from '../../types/file';

// Mock the models and utilities
jest.mock('../../models/file.model');
jest.mock('../../models/segment.model');
jest.mock('../../utils/s3');
jest.mock('../../utils/fileProcessor');

const MockFile = File as jest.MockedClass<typeof File>;
const MockSegment = Segment as jest.MockedClass<typeof Segment>;

describe('FileService', () => {
  let fileService: FileService;
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
    type: FileType.TXT,
    status: FileStatus.PENDING,
    uploadedBy: mockUserId,
    storageUrl: 'https://test-bucket.s3.amazonaws.com/test.txt',
    path: '/uploads/test.txt',
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
      type: FileType.TXT,
      status: FileStatus.PENDING,
      uploadedBy: mockUserId,
      storageUrl: 'https://test-bucket.s3.amazonaws.com/test.txt',
      path: '/uploads/test.txt',
      metadata: {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        category: 'test',
        tags: ['test']
      }
    })
  };

  const mockSegment = {
    _id: new Types.ObjectId(),
    fileId: mockFile._id,
    content: 'Test content',
    order: 1,
    status: SegmentStatus.PENDING,
    originalLength: 12,
    translatedLength: 0,
    metadata: {}
  };

  beforeEach(() => {
    fileService = new FileService();
    jest.clearAllMocks();
    (s3Utils.uploadToS3 as jest.Mock).mockResolvedValue('https://test-bucket.s3.amazonaws.com/test.txt');
    (File.create as jest.Mock).mockResolvedValue(mockFile);
    (File.findById as jest.Mock).mockResolvedValue(mockFile);
  });

  describe('uploadFile', () => {
    const mockFileId = '67e27da644c3afaaa928c8fa';
    const mockProjectId = '67e27da644c3afaaa928c8fb';
    const mockUserId = '67e27da644c3afaaa928c8fc';

    const mockFileData: UploadFileDTO = {
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
      type: FileType.TXT,
      status: FileStatus.PENDING,
      uploadedBy: mockUserId,
      storageUrl: 'https://test-bucket.s3.amazonaws.com/test.txt',
      path: '/uploads/test.txt',
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
        type: FileType.TXT,
        status: FileStatus.PENDING,
        uploadedBy: mockUserId,
        storageUrl: 'https://test-bucket.s3.amazonaws.com/test.txt',
        path: '/uploads/test.txt',
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
      (s3Utils.uploadToS3 as jest.Mock).mockResolvedValue('https://test-bucket.s3.amazonaws.com/test.txt');
      (File.create as jest.Mock).mockResolvedValue(mockFile);
      (File.findById as jest.Mock).mockResolvedValue(mockFile);
    });

    it('should upload file successfully', async () => {
      const result = await fileService.uploadFile(mockProjectId, mockUserId, mockFileData);

      expect(s3Utils.uploadToS3).toHaveBeenCalledWith(
        mockFileData.filePath,
        expect.stringContaining(mockFileData.originalName),
        mockFileData.mimeType
      );
      expect(File.create).toHaveBeenCalledWith(expect.objectContaining({
        projectId: new Types.ObjectId(mockProjectId),
        fileName: expect.any(String),
        originalName: mockFileData.originalName,
        fileSize: mockFileData.fileSize,
        mimeType: mockFileData.mimeType,
        type: FileType.TXT,
        status: FileStatus.PENDING,
        uploadedBy: new Types.ObjectId(mockUserId),
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
      (s3Utils.uploadToS3 as jest.Mock).mockRejectedValue(new Error('Upload failed'));

      await expect(fileService.uploadFile(mockProjectId, mockUserId, mockFileData))
        .rejects
        .toThrow('Upload failed');
    });

    it('should throw error for unsupported file type', async () => {
      const unsupportedFileData = {
        ...mockFileData,
        originalName: 'test.xyz'
      };

      await expect(
        fileService.uploadFile(mockProjectId, mockUserId, unsupportedFileData)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getFileById', () => {
    it('should return file details', async () => {
      (File.findById as jest.Mock).mockResolvedValue(mockFile);

      const result = await fileService.getFileById(mockFileId);

      expect(File.findById).toHaveBeenCalledWith(mockFileId);
      expect(result).toMatchObject({
        _id: mockFileId,
        projectId: mockProjectId,
        fileName: 'test.txt'
      });
    });

    it('should throw NotFoundError if file not found', async () => {
      (File.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        fileService.getFileById(mockFileId)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('processFile', () => {
    const mockSegments = [
      {
        content: 'Test content 1',
        originalLength: 15,
        translatedLength: 0,
        status: SegmentStatus.PENDING
      },
      {
        content: 'Test content 2',
        originalLength: 15,
        translatedLength: 0,
        status: SegmentStatus.PENDING
      }
    ];

    it('should process file successfully', async () => {
      (File.findById as jest.Mock).mockResolvedValue(mockFile);
      (s3Utils.getFileContent as jest.Mock).mockResolvedValue('Test content');
      (processFile as jest.Mock).mockResolvedValue(mockSegments);
      (Segment.create as jest.Mock).mockResolvedValue(mockSegments);

      const result = await fileService.processFile(mockFileId);

      expect(s3Utils.getFileContent).toHaveBeenCalledWith(mockFile.path);
      expect(processFile).toHaveBeenCalledWith(
        'Test content',
        FileType.TXT,
        expect.any(Object)
      );
      expect(Segment.create).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            fileId: mockFile._id,
            content: expect.any(String),
            status: SegmentStatus.PENDING
          })
        ])
      );
      expect(mockFile.save).toHaveBeenCalled();
      expect(result).toEqual(mockSegments);
    });

    it('should handle processing errors', async () => {
      const mockFileWithError = {
        ...mockFile,
        status: FileStatus.PENDING,
        save: jest.fn()
      };
      (File.findById as jest.Mock).mockResolvedValue(mockFileWithError);
      const mockError = new Error('Processing failed');
      (processFile as jest.Mock).mockRejectedValue(mockError);

      await expect(
        fileService.processFile(mockFileId)
      ).rejects.toThrow(mockError);

      expect(mockFileWithError.status).toBe(FileStatus.ERROR);
      expect(mockFileWithError.error).toBe('Processing failed');
      expect(mockFileWithError.errorDetails).toBe(mockError.stack);
      expect(mockFileWithError.save).toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      (File.findById as jest.Mock).mockResolvedValue(mockFile);
      (s3Utils.deleteFromS3 as jest.Mock).mockResolvedValue(undefined);
      (Segment.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 1 });

      const result = await fileService.deleteFile(mockFileId);

      expect(s3Utils.deleteFromS3).toHaveBeenCalledWith(mockFile.path);
      expect(mockFile.deleteOne).toHaveBeenCalled();
      expect(Segment.deleteMany).toHaveBeenCalledWith({ fileId: mockFile._id });
      expect(result).toBe(true);
    });

    it('should throw NotFoundError if file not found', async () => {
      (File.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        fileService.deleteFile(mockFileId)
      ).rejects.toThrow(NotFoundError);
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
      (File.findById as jest.Mock).mockResolvedValue(mockFile);
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSegments)
      };
      (Segment.find as jest.Mock).mockReturnValue(mockQuery);
      (s3Utils.uploadToS3 as jest.Mock).mockResolvedValue('https://test-bucket.s3.amazonaws.com/export.txt');

      const result = await fileService.exportFile(mockFileId, {
        format: 'txt',
        includeReview: true,
        includeMetadata: false
      });

      expect(Segment.find).toHaveBeenCalledWith({ fileId: mockFileId });
      expect(mockQuery.sort).toHaveBeenCalledWith({ order: 1 });
      expect(mockQuery.exec).toHaveBeenCalled();
      expect(s3Utils.uploadToS3).toHaveBeenCalled();
      expect(result).toBe('https://test-bucket.s3.amazonaws.com/export.txt');
    });

    it('should export file as JSON', async () => {
      (File.findById as jest.Mock).mockResolvedValue(mockFile);
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSegments)
      };
      (Segment.find as jest.Mock).mockReturnValue(mockQuery);
      (s3Utils.uploadToS3 as jest.Mock).mockResolvedValue('https://test-bucket.s3.amazonaws.com/export.json');

      const result = await fileService.exportFile(mockFileId, {
        format: 'json',
        includeReview: true,
        includeMetadata: true
      });

      expect(Segment.find).toHaveBeenCalledWith({ fileId: mockFileId });
      expect(mockQuery.sort).toHaveBeenCalledWith({ order: 1 });
      expect(mockQuery.exec).toHaveBeenCalled();
      expect(s3Utils.uploadToS3).toHaveBeenCalled();
      expect(result).toBe('https://test-bucket.s3.amazonaws.com/export.json');
    });
  });

  describe('getFileSegments', () => {
    const mockFile = {
      _id: new Types.ObjectId(mockFileId),
      projectId: new Types.ObjectId(mockProjectId),
      uploadedBy: mockUserId
    };

    const mockSegments = [
      {
        _id: new Types.ObjectId(),
        fileId: new Types.ObjectId(mockFileId),
        sourceText: 'Hello',
        targetText: '',
        status: SegmentStatus.PENDING,
        index: 1
      }
    ];

    beforeEach(() => {
      (MockFile.findById as jest.Mock).mockResolvedValue(mockFile);
      (MockSegment.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockSegments)
      });
      (MockSegment.countDocuments as jest.Mock).mockResolvedValue(1);
    });

    it('should return segments with pagination', async () => {
      const result = await fileService.getFileSegments(mockFileId, {
        status: SegmentStatus.PENDING,
        page: 1,
        limit: 10
      });

      expect(result.segments).toEqual(mockSegments);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(MockSegment.find).toHaveBeenCalledWith(
        expect.objectContaining({
          file: mockFileId,
          status: SegmentStatus.PENDING
        })
      );
    });

    it('should throw NotFoundError if file does not exist', async () => {
      (MockFile.findById as jest.Mock).mockResolvedValue(null);

      await expect(fileService.getFileSegments(mockFileId))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('updateFileProgress', () => {
    const mockFile = {
      _id: new Types.ObjectId(mockFileId),
      projectId: new Types.ObjectId(mockProjectId),
      uploadedBy: mockUserId,
      save: jest.fn().mockResolvedValue(undefined)
    };

    const mockSegments = [
      {
        _id: new Types.ObjectId(),
        fileId: new Types.ObjectId(mockFileId),
        status: SegmentStatus.TRANSLATED
      },
      {
        _id: new Types.ObjectId(),
        fileId: new Types.ObjectId(mockFileId),
        status: SegmentStatus.COMPLETED
      }
    ];

    beforeEach(() => {
      (MockFile.findById as jest.Mock).mockResolvedValue(mockFile);
      (MockSegment.find as jest.Mock).mockResolvedValue(mockSegments);
    });

    it('should update file progress successfully', async () => {
      await fileService.updateFileProgress(mockFileId);

      expect(MockSegment.find).toHaveBeenCalledWith({ fileId: mockFileId });
      expect(mockFile.save).toHaveBeenCalled();
    });

    it('should throw NotFoundError if file does not exist', async () => {
      (MockFile.findById as jest.Mock).mockResolvedValue(null);

      await expect(fileService.updateFileProgress(mockFileId))
        .rejects
        .toThrow(NotFoundError);
    });
  });
}); 