import { Types } from 'mongoose';
import { FileStatus, FileType, File } from '../../models/file.model';
import { SegmentStatus, Segment } from '../../models/segment.model';
import { NotFoundError, ValidationError } from '../../utils/errors';
import fileService from '../../services/file.service';
import { processFile } from '../../utils/fileProcessor';
import { uploadToS3, getFileContent, deleteFromS3 } from '../../utils/s3';

// Mock dependencies
jest.mock('../../utils/fileProcessor');
jest.mock('../../utils/s3');
jest.mock('../../models/file.model');
jest.mock('../../models/segment.model');

describe('FileService', () => {
  const mockProjectId = new Types.ObjectId().toString();
  const mockUserId = new Types.ObjectId().toString();
  const mockFileId = new Types.ObjectId().toString();

  const mockFile = {
    _id: new Types.ObjectId(mockFileId),
    projectId: new Types.ObjectId(mockProjectId),
    fileName: 'test.txt',
    originalName: 'test.txt',
    fileSize: 1024,
    mimeType: 'text/plain',
    type: FileType.TXT,
    status: FileStatus.PENDING,
    uploadedBy: new Types.ObjectId(mockUserId),
    storageUrl: 'https://test-bucket.s3.amazonaws.com/test.txt',
    path: 'files/test.txt',
    error: '',
    errorDetails: '',
    save: jest.fn(),
    deleteOne: jest.fn(),
    toObject: jest.fn().mockReturnValue({
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
      path: 'files/test.txt'
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
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    const mockFileData = {
      originalName: 'test.txt',
      fileSize: 1024,
      mimeType: 'text/plain',
      filePath: '/tmp/test.txt',
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      category: 'test',
      tags: ['test']
    };

    it('should upload file successfully', async () => {
      // Mock dependencies
      (uploadToS3 as jest.Mock).mockResolvedValue('https://test-bucket.s3.amazonaws.com/test.txt');
      (File as any).mockImplementation(() => mockFile);

      const result = await fileService.uploadFile(mockFileData, mockProjectId, mockUserId);

      expect(uploadToS3).toHaveBeenCalledWith(
        mockFileData.filePath,
        expect.stringContaining('files/'),
        mockFileData.mimeType
      );
      expect(mockFile.save).toHaveBeenCalled();
      expect(result).toMatchObject({
        projectId: mockProjectId,
        fileName: expect.any(String),
        originalName: mockFileData.originalName,
        fileSize: mockFileData.fileSize,
        mimeType: mockFileData.mimeType,
        type: FileType.TXT,
        status: FileStatus.PENDING,
        uploadedBy: mockUserId
      });
    });

    it('should throw error for unsupported file type', async () => {
      const invalidFileData = {
        ...mockFileData,
        originalName: 'test.xyz'
      };

      await expect(
        fileService.uploadFile(invalidFileData, mockProjectId, mockUserId)
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
      // Mock dependencies
      (File.findById as jest.Mock).mockResolvedValue(mockFile);
      (getFileContent as jest.Mock).mockResolvedValue('Test content');
      (processFile as jest.Mock).mockResolvedValue(mockSegments);
      (Segment.create as jest.Mock).mockResolvedValue(mockSegments);

      const result = await fileService.processFile(mockFileId);

      expect(getFileContent).toHaveBeenCalledWith(mockFile.path);
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
      // Mock dependencies
      const mockFileWithError = {
        ...mockFile,
        status: FileStatus.PENDING
      };
      (File.findById as jest.Mock).mockResolvedValue(mockFileWithError);
      (getFileContent as jest.Mock).mockRejectedValue(new Error('Processing failed'));

      await expect(
        fileService.processFile(mockFileId)
      ).rejects.toThrow('Processing failed');

      expect(mockFileWithError.status).toBe(FileStatus.ERROR);
      expect(mockFileWithError.error).toBe('Processing failed');
      expect(mockFileWithError.save).toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      // Mock dependencies
      (File.findById as jest.Mock).mockResolvedValue(mockFile);
      (deleteFromS3 as jest.Mock).mockResolvedValue(undefined);
      (Segment.deleteMany as jest.Mock).mockResolvedValue({ deletedCount: 1 });

      const result = await fileService.deleteFile(mockFileId);

      expect(deleteFromS3).toHaveBeenCalledWith(mockFile.path);
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
      // Mock dependencies
      (File.findById as jest.Mock).mockResolvedValue(mockFile);
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSegments)
      };
      (Segment.find as jest.Mock).mockReturnValue(mockQuery);
      (uploadToS3 as jest.Mock).mockResolvedValue('https://test-bucket.s3.amazonaws.com/export.txt');

      const result = await fileService.exportFile(mockFileId, {
        format: 'txt',
        includeReview: true,
        includeMetadata: false
      });

      expect(Segment.find).toHaveBeenCalledWith({ fileId: mockFileId });
      expect(mockQuery.sort).toHaveBeenCalledWith({ order: 1 });
      expect(mockQuery.exec).toHaveBeenCalled();
      expect(uploadToS3).toHaveBeenCalled();
      expect(result).toBe('https://test-bucket.s3.amazonaws.com/export.txt');
    });

    it('should export file as JSON', async () => {
      // Mock dependencies
      (File.findById as jest.Mock).mockResolvedValue(mockFile);
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSegments)
      };
      (Segment.find as jest.Mock).mockReturnValue(mockQuery);
      (uploadToS3 as jest.Mock).mockResolvedValue('https://test-bucket.s3.amazonaws.com/export.json');

      const result = await fileService.exportFile(mockFileId, {
        format: 'json',
        includeReview: true,
        includeMetadata: true
      });

      expect(Segment.find).toHaveBeenCalledWith({ fileId: mockFileId });
      expect(mockQuery.sort).toHaveBeenCalledWith({ order: 1 });
      expect(mockQuery.exec).toHaveBeenCalled();
      expect(uploadToS3).toHaveBeenCalled();
      expect(result).toBe('https://test-bucket.s3.amazonaws.com/export.json');
    });
  });
}); 