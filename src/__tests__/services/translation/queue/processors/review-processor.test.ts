import { ReviewTaskProcessor } from '../../../../../services/translation/queue/processors/review-processor';
import { QueueTask, QueueTaskStatus, QueueTaskType } from '../../../../../services/translation/queue/queue-task.interface';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../../../../models/segment.model', () => ({
  Segment: {
    findById: jest.fn(),
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: 'segment-1' }, { _id: 'segment-2' }]),
      limit: jest.fn()
    }),
    countDocuments: jest.fn()
  },
  SegmentStatus: {
    TRANSLATED: 'TRANSLATED',
    REVIEW_IN_PROGRESS: 'REVIEW_IN_PROGRESS',
    REVIEW_COMPLETED: 'REVIEW_COMPLETED',
    REVIEW_FAILED: 'REVIEW_FAILED'
  }
}));

jest.mock('../../../../../models/file.model', () => ({
  File: {
    findById: jest.fn()
  },
  FileStatus: {
    IN_PROGRESS: 'IN_PROGRESS',
    REVIEWING: 'REVIEWING',
    COMPLETED: 'COMPLETED',
    ERROR: 'ERROR'
  }
}));

jest.mock('../../../../../services/ai-review.service', () => ({
  __esModule: true,
  default: {
    reviewTranslation: jest.fn()
  }
}));

jest.mock('../../../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock mongoose
jest.mock('mongoose', () => ({
  ...jest.requireActual('mongoose'),
  isValidObjectId: jest.fn().mockReturnValue(true)
}));

// Import mocked modules
const Segment = jest.requireMock('../../../../../models/segment.model').Segment;
const SegmentStatus = jest.requireMock('../../../../../models/segment.model').SegmentStatus;
const File = jest.requireMock('../../../../../models/file.model').File;
const FileStatus = jest.requireMock('../../../../../models/file.model').FileStatus;
const aiReviewService = jest.requireMock('../../../../../services/ai-review.service').default;
const logger = jest.requireMock('../../../../../utils/logger');

describe('ReviewTaskProcessor', () => {
  let processor: ReviewTaskProcessor;
  
  // Helper function to create a mock task
  function createMockTask(
    taskType: string, 
    data: any = {}, 
    status: QueueTaskStatus = QueueTaskStatus.PENDING
  ): QueueTask {
    return {
      id: 'task-123',
      type: QueueTaskType.REVIEW,
      status,
      data: {
        taskType,
        ...data
      },
      priority: 1,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock mongoose isValidObjectId
    (mongoose.isValidObjectId as jest.Mock).mockReturnValue(true);
    
    // Mock Segment.findById
    const mockSegment = {
      _id: 'segment-123',
      fileId: 'file-123',
      content: 'Original content',
      translation: 'Translated content',
      status: SegmentStatus.TRANSLATED,
      save: jest.fn().mockResolvedValue(true)
    };
    
    Segment.findById.mockResolvedValue(mockSegment);
    
    // Mock File.findById
    const mockFile = {
      _id: 'file-123',
      fileName: 'test.txt',
      status: FileStatus.IN_PROGRESS,
      save: jest.fn().mockResolvedValue(true)
    };
    
    File.findById.mockResolvedValue(mockFile);
    
    // Mock Segment.find for batch operations
    const mockSegments = [
      {
        _id: 'segment-1',
        content: 'Content 1',
        translation: 'Translation 1',
        status: SegmentStatus.TRANSLATED,
        save: jest.fn().mockResolvedValue(true)
      },
      {
        _id: 'segment-2',
        content: 'Content 2',
        translation: 'Translation 2',
        status: SegmentStatus.TRANSLATED,
        save: jest.fn().mockResolvedValue(true)
      }
    ];
    
    // Properly mock Segment.find for chained methods
    const mockFindChain = {
      select: jest.fn().mockResolvedValue([
        { _id: 'segment-1' }, 
        { _id: 'segment-2' }
      ]),
      limit: jest.fn().mockReturnThis()
    };
    Segment.find.mockReturnValue(mockFindChain);
    mockFindChain.limit.mockResolvedValue(mockSegments);
    
    // Mock AI review service
    aiReviewService.reviewTranslation.mockResolvedValue({
      suggestedTranslation: 'Suggested translation',
      issues: [
        {
          type: 'grammar',
          description: 'Grammar issue',
          position: { start: 0, end: 5 }
        }
      ],
      scores: [
        {
          type: 'accuracy',
          score: 85
        }
      ],
      metadata: {
        modificationDegree: 0.3
      },
      statistics: {
        originalLength: 13,
        translatedLength: 15,
        suggestedLength: 21,
        issueCount: 1,
        modificationDegree: 0.3,
        overallScore: 85
      }
    });
    
    // Create processor instance
    processor = new ReviewTaskProcessor();
  });
  
  describe('process method', () => {
    it('should handle unknown task types', async () => {
      // Arrange
      const mockTask = createMockTask('unknownType');
      
      // Act & Assert
      await expect(processor.process(mockTask)).rejects.toThrow(
        'Unsupported review task type: unknownType'
      );
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Review task processing failed'),
        expect.any(Object)
      );
    });
    
    it('should process segment review tasks', async () => {
      // Arrange
      const mockTask = createMockTask('segmentReview', {
        segmentId: 'segment-123',
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'zh-CN',
          model: 'gpt-4'
        }
      });
      
      // Act
      const result = await processor.process(mockTask);
      
      // Assert
      expect(Segment.findById).toHaveBeenCalledWith('segment-123');
      expect(aiReviewService.reviewTranslation).toHaveBeenCalledWith(
        'Original content',
        'Translated content',
        expect.objectContaining({
          sourceLanguage: 'en',
          targetLanguage: 'zh-CN',
          model: 'gpt-4'
        })
      );
      
      expect(result).toEqual(expect.objectContaining({
        segmentId: 'segment-123',
        status: expect.any(String),
        reviewResult: expect.objectContaining({
          suggestedTranslation: 'Suggested translation',
          scores: expect.any(Array)
        })
      }));
    });
    
    it('should handle segment not found error in segment review tasks', async () => {
      // Arrange
      const mockTask = createMockTask('segmentReview', {
        segmentId: 'nonexistent-segment'
      });
      
      // Mock segment not found
      Segment.findById.mockResolvedValueOnce(null);
      
      // Act & Assert
      await expect(processor.process(mockTask)).rejects.toThrow(
        'Segment not found: nonexistent-segment'
      );
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Review task processing failed'),
        expect.any(Object)
      );
    });
    
    it('should process batch segment review tasks', async () => {
      // Arrange
      const mockTask = createMockTask('batchSegmentReview', {
        segmentIds: ['segment-1', 'segment-2'],
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'zh-CN',
          batchSize: 2,
          concurrentLimit: 2
        }
      });
      
      // Act
      const result = await processor.process(mockTask);
      
      // Assert
      expect(result).toEqual({
        totalSegments: 2,
        successCount: expect.any(Number),
        errorCount: expect.any(Number),
        results: expect.any(Array),
        errors: expect.any(Array)
      });
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Review task'),
        expect.any(Object)
      );
    });
    
    it('should process file review tasks', async () => {
      // Arrange
      const mockTask = createMockTask('fileReview', {
        fileId: 'file-123',
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'zh-CN'
        }
      });
      
      // Act
      const result = await processor.process(mockTask);
      
      // Assert
      expect(File.findById).toHaveBeenCalledWith('file-123');
      expect(result).toEqual(expect.objectContaining({
        fileId: 'file-123',
        fileName: 'test.txt'
      }));
    });
    
    it('should handle file not found error in file review tasks', async () => {
      // Arrange
      const mockTask = createMockTask('fileReview', {
        fileId: 'nonexistent-file'
      });
      
      // Mock file not found
      File.findById.mockResolvedValueOnce(null);
      
      // Act & Assert
      await expect(processor.process(mockTask)).rejects.toThrow(
        'File not found: nonexistent-file'
      );
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Review task processing failed'),
        expect.any(Object)
      );
    });
    
    it('should process direct text review tasks', async () => {
      // Arrange
      const mockTask = createMockTask('textReview', {
        originalText: 'Original text',
        translatedText: 'Translated text',
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'zh-CN'
        }
      });
      
      // Act
      const result = await processor.process(mockTask);
      
      // Assert
      expect(aiReviewService.reviewTranslation).toHaveBeenCalledWith(
        'Original text',
        'Translated text',
        expect.any(Object)
      );
      
      expect(result).toEqual(expect.objectContaining({
        suggestedTranslation: 'Suggested translation',
        issues: expect.any(Array),
        statistics: expect.objectContaining({
          originalLength: expect.any(Number),
          translatedLength: expect.any(Number)
        })
      }));
    });
    
    it('should handle AI review service errors', async () => {
      // Arrange
      const mockTask = createMockTask('segmentReview', {
        segmentId: 'segment-123'
      });
      
      // Mock AI review service error
      const mockError = new Error('AI review service error');
      aiReviewService.reviewTranslation.mockRejectedValueOnce(mockError);
      
      // Act & Assert
      await expect(processor.process(mockTask)).rejects.toThrow(
        'AI review service error'
      );
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error reviewing segment'),
        expect.any(Object)
      );
    });
  });
}); 