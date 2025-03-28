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
const reviewController = __importStar(require("../../controllers/review.controller"));
const review_service_1 = __importDefault(require("../../services/review.service"));
const translation_queue_service_1 = require("../../services/translation/queue/translation-queue.service");
const queue_task_interface_1 = require("../../services/translation/queue/queue-task.interface");
const errors_1 = require("../../utils/errors");
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
    AppError: jest.fn().mockImplementation(function (message, statusCode) {
        this.message = message;
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
    }),
    UnauthorizedError: jest.fn().mockImplementation(function (message) {
        this.message = message;
        this.name = 'UnauthorizedError';
        this.status = 401;
    }),
    NotFoundError: jest.fn().mockImplementation(function (message) {
        this.message = message;
        this.name = 'NotFoundError';
        this.status = 404;
    })
}));
jest.mock('../../utils/logger');
describe('Review Controller', () => {
    // Mock request and response objects
    let mockRequest;
    let mockResponse;
    let mockJsonFn;
    let mockStatusFn;
    let mockQueueService;
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
                status: queue_task_interface_1.QueueTaskStatus.COMPLETED,
                data: { taskType: 'segmentReview' },
                createdAt: new Date(),
                completedAt: new Date()
            }),
            cancelTask: jest.fn().mockResolvedValue(true)
        };
        // Mock TranslationQueueService constructor
        translation_queue_service_1.TranslationQueueService.mockImplementation(() => mockQueueService);
    });
    describe('requestSegmentReview', () => {
        it('should return 400 if segmentId is missing', async () => {
            // Arrange
            mockRequest.body = {};
            // Act
            await reviewController.requestSegmentReview(mockRequest, mockResponse);
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
            review_service_1.default.startAIReview.mockResolvedValue(mockSegment);
            // Act
            await reviewController.requestSegmentReview(mockRequest, mockResponse);
            // Assert
            expect(review_service_1.default.startAIReview).toHaveBeenCalledWith('test-segment-id', 'test-user-id', expect.objectContaining({
                aiModel: 'gpt-4'
            }));
            expect(mockStatusFn).toHaveBeenCalledWith(200);
            expect(mockJsonFn).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: '段落审校已完成',
                data: mockSegment
            }));
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
            await reviewController.requestSegmentReview(mockRequest, mockResponse);
            // Assert
            expect(translation_queue_service_1.TranslationQueueService).toHaveBeenCalled();
            expect(mockQueueService.addTask).toHaveBeenCalledWith(expect.objectContaining({
                type: queue_task_interface_1.QueueTaskType.REVIEW,
                data: expect.objectContaining({
                    taskType: 'segmentReview',
                    segmentId: 'test-segment-id',
                    userId: 'test-user-id'
                })
            }));
            expect(mockStatusFn).toHaveBeenCalledWith(202);
            expect(mockJsonFn).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: '段落审校任务已提交到队列',
                taskId: 'mock-task-id'
            }));
        });
        it('should handle unauthorized access', async () => {
            // Arrange
            mockRequest.user = undefined;
            mockRequest.body = { segmentId: 'test-segment-id' };
            // Mock the startAIReview to throw an UnauthorizedError
            review_service_1.default.startAIReview.mockImplementation(() => {
                throw new errors_1.UnauthorizedError('未授权的访问');
            });
            // Act
            await reviewController.requestSegmentReview(mockRequest, mockResponse);
            // Assert
            expect(mockStatusFn).toHaveBeenCalledWith(401);
            expect(mockJsonFn).toHaveBeenCalledWith(expect.objectContaining({
                error: '未授权的访问'
            }));
        });
        it('should handle not found errors', async () => {
            // Arrange
            mockRequest.body = {
                segmentId: 'test-segment-id',
                options: { immediate: true }
            };
            // Mock the startAIReview to throw a NotFoundError
            review_service_1.default.startAIReview.mockImplementation(() => {
                throw new errors_1.NotFoundError('段落不存在');
            });
            // Act
            await reviewController.requestSegmentReview(mockRequest, mockResponse);
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
            await reviewController.queueSegmentReview(mockRequest, mockResponse);
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
            await reviewController.queueSegmentReview(mockRequest, mockResponse);
            // Assert
            expect(translation_queue_service_1.TranslationQueueService).toHaveBeenCalled();
            expect(mockQueueService.addTask).toHaveBeenCalledWith(expect.objectContaining({
                type: queue_task_interface_1.QueueTaskType.REVIEW,
                priority: 1,
                data: expect.objectContaining({
                    taskType: 'segmentReview',
                    segmentId: 'test-segment-id'
                })
            }));
            expect(mockStatusFn).toHaveBeenCalledWith(202);
            expect(mockJsonFn).toHaveBeenCalledWith(expect.objectContaining({
                message: '审校任务已提交到队列',
                taskId: 'mock-task-id'
            }));
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
            await reviewController.queueSegmentReview(mockRequest, mockResponse);
            // Assert
            expect(mockQueueService.addTask).toHaveBeenCalledWith(expect.objectContaining({
                type: queue_task_interface_1.QueueTaskType.REVIEW,
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
            }));
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
            await reviewController.queueSegmentReview(mockRequest, mockResponse);
            // Assert
            expect(consoleSpy).toHaveBeenCalledWith('提交审校任务失败:', error);
            expect(mockStatusFn).toHaveBeenCalledWith(500);
            expect(mockJsonFn).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Queue service error'
            }));
            // Restore console.error
            consoleSpy.mockRestore();
        });
    });
    describe('getReviewTaskStatus', () => {
        it('should return 400 if taskId is missing', async () => {
            // Arrange
            mockRequest.params = {};
            // Act
            await reviewController.getReviewTaskStatus(mockRequest, mockResponse);
            // Assert
            expect(mockStatusFn).toHaveBeenCalledWith(400);
            expect(mockJsonFn).toHaveBeenCalledWith({ error: '缺少任务ID' });
        });
        it('should return task status if taskId is valid', async () => {
            // Arrange
            mockRequest.params = { taskId: 'mock-task-id' };
            const mockTask = {
                id: 'mock-task-id',
                status: queue_task_interface_1.QueueTaskStatus.COMPLETED,
                type: queue_task_interface_1.QueueTaskType.REVIEW,
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
            await reviewController.getReviewTaskStatus(mockRequest, mockResponse);
            // Assert
            expect(mockQueueService.getTask).toHaveBeenCalledWith('mock-task-id');
            expect(mockStatusFn).toHaveBeenCalledWith(200);
            expect(mockJsonFn).toHaveBeenCalledWith(expect.objectContaining({
                taskId: 'mock-task-id',
                status: queue_task_interface_1.QueueTaskStatus.COMPLETED,
                type: queue_task_interface_1.QueueTaskType.REVIEW,
                dataType: 'segmentReview'
            }));
        });
        it('should return 404 if task is not found', async () => {
            // Arrange
            mockRequest.params = { taskId: 'nonexistent-task-id' };
            mockQueueService.getTask.mockResolvedValue(undefined);
            // Act
            await reviewController.getReviewTaskStatus(mockRequest, mockResponse);
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
            await reviewController.cancelReviewTask(mockRequest, mockResponse);
            // Assert
            expect(mockStatusFn).toHaveBeenCalledWith(400);
            expect(mockJsonFn).toHaveBeenCalledWith({ error: '缺少任务ID' });
        });
        it('should cancel task if taskId is valid', async () => {
            // Arrange
            mockRequest.params = { taskId: 'mock-task-id' };
            // Act
            await reviewController.cancelReviewTask(mockRequest, mockResponse);
            // Assert
            expect(mockQueueService.cancelTask).toHaveBeenCalledWith('mock-task-id');
            expect(mockStatusFn).toHaveBeenCalledWith(200);
            expect(mockJsonFn).toHaveBeenCalledWith(expect.objectContaining({
                message: '任务已取消',
                taskId: 'mock-task-id'
            }));
        });
        it('should handle errors when canceling task', async () => {
            // Arrange
            mockRequest.params = { taskId: 'mock-task-id' };
            const error = new Error('Cancel error');
            mockQueueService.cancelTask.mockRejectedValue(error);
            // Spy on console.error
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            // Act
            await reviewController.cancelReviewTask(mockRequest, mockResponse);
            // Assert
            expect(consoleSpy).toHaveBeenCalledWith('取消任务失败:', error);
            expect(mockStatusFn).toHaveBeenCalledWith(500);
            expect(mockJsonFn).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Cancel error'
            }));
            // Restore console.error
            consoleSpy.mockRestore();
        });
    });
});
