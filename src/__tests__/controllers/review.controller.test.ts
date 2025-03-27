import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import * as reviewController from '../../controllers/review.controller';
import reviewService from '../../services/review.service';
import { TranslationQueueService } from '../../services/translation/queue/translation-queue.service';
import { QueueTaskType, QueueTaskStatus } from '../../services/translation/queue/queue-task.interface';
import { UnauthorizedError, NotFoundError } from '../../utils/errors';
import logger from '../../utils/logger';

// Mock dependencies
jest.mock('../../services/review.service', () => ({
  __esModule: true,
  default: {
    startAIReview: jest.fn(),
    completeSegmentReview: jest.fn(),
    getSegmentReviewResult: jest.fn()
  }
}));

jest.mock('../../services/translation/queue/translation-queue.service');
jest.mock('../../utils/errors', () => ({
  AppError: jest.fn().mockImplementation(function(this: { message: string; statusCode: number; status: string; isOperational: boolean }, message: string, statusCode: number) {
    this.message = message;
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
  }),
  UnauthorizedError: jest.fn().mockImplementation(function(this: { message: string; name: string; status: number }, message: string) {
    this.message = message;
    this.name = 'UnauthorizedError';
    this.status = 401;
  }),
  NotFoundError: jest.fn().mockImplementation(function(this: { message: string; name: string; status: number }, message: string) {
    this.message = message;
    this.name = 'NotFoundError';
    this.status = 404;
  })
}));
jest.mock('../../utils/logger');

describe('Review Controller', () => {
  // Mock request and response objects
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockJsonFn: jest.Mock;
  let mockStatusFn: jest.Mock;
  let mockQueueService: jest.Mocked<TranslationQueueService>;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock response
    mockJsonFn = jest.fn().mockReturnThis();
    mockStatusFn = jest.fn().mockReturnValue({ json: mockJsonFn });
    mockResponse = {
      status: mockStatusFn,
      json: mockJsonFn
    };
    
    // Setup mock request
    mockRequest = {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
        role: 'translator'
      },
      body: {},
      params: {}
    };
    
    // Setup mock queue service
    mockQueueService = {
      addTask: jest.fn().mockResolvedValue('mock-task-id'),
      getTask: jest.fn().mockResolvedValue({
        id: 'mock-task-id',
        status: QueueTaskStatus.COMPLETED,
        data: { taskType: 'segmentReview' },
        createdAt: new Date(),
        completedAt: new Date()
      }),
      cancelTask: jest.fn().mockResolvedValue(true)
    } as any;
    
    // Mock TranslationQueueService constructor
    (TranslationQueueService as jest.Mock).mockImplementation(() => mockQueueService);
  });
  
  describe('requestSegmentReview', () => {
    it('should return 400 if segmentId is missing', async () => {
      // Arrange
      mockRequest.body = {};
      
      // Act
      await reviewController.requestSegmentReview(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockStatusFn).toHaveBeenCalledWith(400);
      expect(mockJsonFn).toHaveBeenCalledWith({ error: '缺少段落ID' });
    });
    
    it('should call reviewService.startAIReview for immediate reviews', async () => {
      // Arrange
      mockRequest.body = {
        segmentId: 'test-segment-id',
        options: {
          immediate: true,
          model: 'gpt-4',
          aiProvider: 'openai'
        }
      };
      
      const mockSegment = {
        _id: 'test-segment-id',
        status: 'REVIEW_COMPLETED'
      };
      
      (reviewService.startAIReview as jest.Mock).mockResolvedValue(mockSegment);
      
      // Act
      await reviewController.requestSegmentReview(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(reviewService.startAIReview).toHaveBeenCalledWith(
        'test-segment-id',
        'test-user-id',
        expect.objectContaining({
          aiModel: 'gpt-4'
        })
      );
      
      expect(mockStatusFn).toHaveBeenCalledWith(200);
      expect(mockJsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: '段落审校已完成',
          data: mockSegment
        })
      );
    });
    
    it('should add task to queue for non-immediate reviews', async () => {
      // Arrange
      mockRequest.body = {
        segmentId: 'test-segment-id',
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'zh-CN',
          model: 'gpt-4'
        }
      };
      
      // Act
      await reviewController.requestSegmentReview(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(TranslationQueueService).toHaveBeenCalled();
      expect(mockQueueService.addTask).toHaveBeenCalledWith(
        expect.objectContaining({
          type: QueueTaskType.REVIEW,
          data: expect.objectContaining({
            taskType: 'segmentReview',
            segmentId: 'test-segment-id',
            userId: 'test-user-id'
          })
        })
      );
      
      expect(mockStatusFn).toHaveBeenCalledWith(202);
      expect(mockJsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: '段落审校任务已提交到队列',
          taskId: 'mock-task-id'
        })
      );
    });
    
    it('should handle unauthorized access', async () => {
      // Arrange
      mockRequest.user = undefined;
      mockRequest.body = { segmentId: 'test-segment-id' };
      
      // Mock the startAIReview to throw an UnauthorizedError
      (reviewService.startAIReview as jest.Mock).mockImplementation(() => {
        throw new UnauthorizedError('未授权的访问');
      });
      
      // Act
      await reviewController.requestSegmentReview(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockStatusFn).toHaveBeenCalledWith(401);
      expect(mockJsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '未授权的访问'
        })
      );
    });
    
    it('should handle not found errors', async () => {
      // Arrange
      mockRequest.body = {
        segmentId: 'test-segment-id',
        options: { immediate: true }
      };
      
      // Mock the startAIReview to throw a NotFoundError
      (reviewService.startAIReview as jest.Mock).mockImplementation(() => {
        throw new NotFoundError('段落不存在');
      });
      
      // Act
      await reviewController.requestSegmentReview(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockStatusFn).toHaveBeenCalledWith(404);
      expect(mockJsonFn).toHaveBeenCalledWith({ error: '段落不存在' });
    });
  });
  
  describe('queueSegmentReview', () => {
    it('should return 400 if segmentId is missing', async () => {
      // Arrange
      mockRequest.body = {};
      
      // Act
      await reviewController.queueSegmentReview(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockStatusFn).toHaveBeenCalledWith(400);
      expect(mockJsonFn).toHaveBeenCalledWith({ error: '缺少段落ID' });
    });
    
    it('should add segment review task to queue with default options', async () => {
      // Arrange
      mockRequest.body = {
        segmentId: 'test-segment-id'
      };
      
      // Act
      await reviewController.queueSegmentReview(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(TranslationQueueService).toHaveBeenCalled();
      expect(mockQueueService.addTask).toHaveBeenCalledWith(
        expect.objectContaining({
          type: QueueTaskType.REVIEW,
          priority: 1,
          data: expect.objectContaining({
            taskType: 'segmentReview',
            segmentId: 'test-segment-id'
          })
        })
      );
      
      expect(mockStatusFn).toHaveBeenCalledWith(202);
      expect(mockJsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '审校任务已提交到队列',
          taskId: 'mock-task-id'
        })
      );
    });
    
    it('should add segment review task to queue with custom options', async () => {
      // Arrange
      mockRequest.body = {
        segmentId: 'test-segment-id',
        options: {
          sourceLanguage: 'en',
          targetLanguage: 'zh-CN',
          model: 'gpt-4',
          provider: 'openai',
          customPrompt: 'Custom prompt',
          priority: 3
        }
      };
      
      // Act
      await reviewController.queueSegmentReview(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockQueueService.addTask).toHaveBeenCalledWith(
        expect.objectContaining({
          type: QueueTaskType.REVIEW,
          priority: 3,
          data: expect.objectContaining({
            taskType: 'segmentReview',
            segmentId: 'test-segment-id',
            options: expect.objectContaining({
              sourceLanguage: 'en',
              targetLanguage: 'zh-CN',
              model: 'gpt-4',
              aiProvider: 'openai',
              customPrompt: 'Custom prompt'
            })
          })
        })
      );
    });
    
    it('should handle errors from queue service', async () => {
      // Arrange
      mockRequest.body = {
        segmentId: 'test-segment-id'
      };
      
      const error = new Error('Queue service error');
      mockQueueService.addTask.mockRejectedValue(error);
      
      // Spy on console.error to verify it's called
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Act
      await reviewController.queueSegmentReview(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        '提交审校任务失败:',
        error
      );
      
      expect(mockStatusFn).toHaveBeenCalledWith(500);
      expect(mockJsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Queue service error'
        })
      );
      
      // Restore console.error
      consoleSpy.mockRestore();
    });
  });
  
  describe('getReviewTaskStatus', () => {
    it('should return 400 if taskId is missing', async () => {
      // Arrange
      mockRequest.params = {};
      
      // Act
      await reviewController.getReviewTaskStatus(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockStatusFn).toHaveBeenCalledWith(400);
      expect(mockJsonFn).toHaveBeenCalledWith({ error: '缺少任务ID' });
    });
    
    it('should return task status if taskId is valid', async () => {
      // Arrange
      mockRequest.params = { taskId: 'mock-task-id' };
      
      const mockTask = {
        id: 'mock-task-id',
        status: QueueTaskStatus.COMPLETED,
        type: QueueTaskType.REVIEW,
        data: { taskType: 'segmentReview' },
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        error: undefined,
        result: { success: true },
        priority: 1,
        retryCount: 0,
        updatedAt: new Date()
      };
      
      mockQueueService.getTask.mockResolvedValue(mockTask);
      
      // Act
      await reviewController.getReviewTaskStatus(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockQueueService.getTask).toHaveBeenCalledWith('mock-task-id');
      
      expect(mockStatusFn).toHaveBeenCalledWith(200);
      expect(mockJsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'mock-task-id',
          status: QueueTaskStatus.COMPLETED,
          type: QueueTaskType.REVIEW,
          dataType: 'segmentReview'
        })
      );
    });
    
    it('should return 404 if task is not found', async () => {
      // Arrange
      mockRequest.params = { taskId: 'nonexistent-task-id' };
      
      mockQueueService.getTask.mockResolvedValue(undefined);
      
      // Act
      await reviewController.getReviewTaskStatus(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockStatusFn).toHaveBeenCalledWith(404);
      expect(mockJsonFn).toHaveBeenCalledWith({ error: '任务不存在' });
    });
  });
  
  describe('cancelReviewTask', () => {
    it('should return 400 if taskId is missing', async () => {
      // Arrange
      mockRequest.params = {};
      
      // Act
      await reviewController.cancelReviewTask(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockStatusFn).toHaveBeenCalledWith(400);
      expect(mockJsonFn).toHaveBeenCalledWith({ error: '缺少任务ID' });
    });
    
    it('should cancel task if taskId is valid', async () => {
      // Arrange
      mockRequest.params = { taskId: 'mock-task-id' };
      
      // Act
      await reviewController.cancelReviewTask(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(mockQueueService.cancelTask).toHaveBeenCalledWith('mock-task-id');
      
      expect(mockStatusFn).toHaveBeenCalledWith(200);
      expect(mockJsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '任务已取消',
          taskId: 'mock-task-id'
        })
      );
    });
    
    it('should handle errors when canceling task', async () => {
      // Arrange
      mockRequest.params = { taskId: 'mock-task-id' };
      
      const error = new Error('Cancel error');
      mockQueueService.cancelTask.mockRejectedValue(error);
      
      // Spy on console.error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Act
      await reviewController.cancelReviewTask(
        mockRequest as Request,
        mockResponse as Response
      );
      
      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        '取消任务失败:',
        error
      );
      
      expect(mockStatusFn).toHaveBeenCalledWith(500);
      expect(mockJsonFn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Cancel error'
        })
      );
      
      // Restore console.error
      consoleSpy.mockRestore();
    });
  });
}); 