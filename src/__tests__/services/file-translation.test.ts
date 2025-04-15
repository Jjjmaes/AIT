import { FileTranslationService } from '../../services/translation/file-translation.service';
import { TranslationService } from '../../services/translation/translation.service';
import { TranslationStatus } from '../../types/translation.types';
import { Types } from 'mongoose';
import { AIProvider } from '../../types/ai-service.types';
import { jest } from '@jest/globals';
import { translationQueueService } from '../../services/translationQueue.service';

// 模拟依赖
jest.mock('../../services/translation/translation.service');
jest.mock('../../utils/logger');
jest.mock('../../services/translationQueue.service', () => ({
    translationQueueService: {
        addFileTranslationJob: jest.fn<() => Promise<string>>(),
    }
}));

// Define userId
const userId = 'mock-user-id';

describe('FileTranslationService', () => {
  let mockTranslationService: jest.Mocked<TranslationService>;
  let fileTranslationService: FileTranslationService;
  let mockQueueAddJob: jest.Mock<() => Promise<string>>;
  
  const projectId = new Types.ObjectId();
  const fileId = new Types.ObjectId();
  
  const mockTranslationOptions = {
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    preserveFormatting: true
  };
  
  const mockSegments = [
    'This is the first segment.',
    'This is the second segment.',
    'This is the third segment.'
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockTranslationService = {
      translateText: jest.fn(),
      validateApiKey: jest.fn(),
      getAvailableModels: jest.fn(),
      getModelInfo: jest.fn(),
      getModelPricing: jest.fn(),
      translateMultipleSegments: jest.fn(),
      validateAndNormalizeConfig: jest.fn(),
      aiServiceFactory: {
        createAdapter: jest.fn(),
        getInstance: jest.fn(),
        removeAdapter: jest.fn(),
        getAdapter: jest.fn()
      },
      config: {},
      performanceMonitor: {
        recordRequest: jest.fn(),
        recordCacheAccess: jest.fn(),
        recordQueueMetrics: jest.fn(),
        recordTaskCompletion: jest.fn(),
        recordRetry: jest.fn(),
        resetMetrics: jest.fn(),
        getMetrics: jest.fn(),
        getTaskMetrics: jest.fn()
      }
    } as any;
    
    fileTranslationService = new FileTranslationService(
      mockTranslationService,
      fileId,
      projectId,
      mockTranslationOptions
    );
    
    mockQueueAddJob = translationQueueService.addFileTranslationJob as jest.Mock<() => Promise<string>>;
  });

  describe('initialize', () => {
    it('应该正确初始化段落', async () => {
      const segments = ['First segment', 'Second segment'];
      await fileTranslationService.initialize(segments);

      const tasks = fileTranslationService.getTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks[0].status).toBe(TranslationStatus.PENDING);
      expect(tasks[1].status).toBe(TranslationStatus.PENDING);
    });
  });

  describe('translate', () => {
    it('应该成功翻译所有段落', async () => {
      // 初始化段落
      await fileTranslationService.initialize(['First segment', 'Second segment']);

      // 设置翻译成功的 mock
      mockTranslationService.translateText
        .mockResolvedValueOnce({
          translatedText: 'First translated segment',
          metadata: {
            provider: AIProvider.OPENAI,
            model: 'gpt-3.5-turbo',
            processingTime: 100,
            confidence: 0.95,
            wordCount: 3,
            characterCount: 20,
            tokens: { input: 10, output: 15 }
          }
        })
        .mockResolvedValueOnce({
          translatedText: 'Second translated segment',
          metadata: {
            provider: AIProvider.OPENAI,
            model: 'gpt-3.5-turbo',
            processingTime: 100,
            confidence: 0.95,
            wordCount: 3,
            characterCount: 20,
            tokens: { input: 10, output: 15 }
          }
        });

      // 执行翻译
      await fileTranslationService.translate();

      // 验证任务状态
      const tasks = fileTranslationService.getTasks();
      expect(tasks[0].status).toBe(TranslationStatus.COMPLETED);
      expect(tasks[1].status).toBe(TranslationStatus.COMPLETED);

      // 验证进度
      const progress = fileTranslationService.getProgress();
      expect(progress.status).toBe(TranslationStatus.COMPLETED);
      expect(progress.completedSegments).toBe(2);
    });

    it('应该处理翻译失败的情况', async () => {
      // 初始化段落
      await fileTranslationService.initialize(['First paragraph', 'Second paragraph']);

      // 设置翻译失败的 mock
      mockTranslationService.translateText
        .mockRejectedValueOnce(new Error('Translation failed'));

      // 执行翻译
      await fileTranslationService.translate();

      // 验证任务状态
      const tasks = fileTranslationService.getTasks();
      expect(tasks[0].status).toBe(TranslationStatus.FAILED);
      expect(tasks[0].error).toBe('Translation failed');

      // 验证进度
      const progress = fileTranslationService.getProgress();
      expect(progress.status).toBe(TranslationStatus.FAILED);
      expect(progress.failedSegments).toBe(1);
    });

    it('应该支持翻译任务的重试机制', async () => {
      // 初始化段落
      await fileTranslationService.initialize(['Test segment']);

      // 设置前两次失败，第三次成功的 mock
      mockTranslationService.translateText
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce({
          translatedText: 'Successfully translated',
          metadata: {
            provider: AIProvider.OPENAI,
            model: 'gpt-3.5-turbo',
            processingTime: 100,
            confidence: 0.95,
            wordCount: 2,
            characterCount: 18,
            tokens: { input: 10, output: 15 }
          }
        });

      // 执行翻译
      await fileTranslationService.translate();

      // 验证调用次数
      expect(mockTranslationService.translateText).toHaveBeenCalledTimes(3);

      // 验证最终状态
      const tasks = fileTranslationService.getTasks();
      expect(tasks[0].status).toBe(TranslationStatus.COMPLETED);
    });
  });

  describe('cancel', () => {
    it('应该取消所有待处理的任务', async () => {
      // 初始化段落
      await fileTranslationService.initialize(['First segment', 'Second segment']);

      // 取消翻译
      await fileTranslationService.cancel();

      // 验证任务状态
      const tasks = fileTranslationService.getTasks();
      expect(tasks[0].status).toBe(TranslationStatus.CANCELLED);
      expect(tasks[1].status).toBe(TranslationStatus.CANCELLED);

      // 验证进度
      const progress = fileTranslationService.getProgress();
      expect(progress.status).toBe(TranslationStatus.CANCELLED);
    });
  });

  it('should add a file translation job to the queue', async () => {
    mockQueueAddJob.mockResolvedValue('job-123');

    await translationQueueService.addFileTranslationJob(projectId.toString(), fileId.toString(), mockTranslationOptions, userId, ['admin']);

    expect(mockQueueAddJob).toHaveBeenCalledWith(projectId.toString(), fileId.toString(), mockTranslationOptions, userId, ['admin']);
  });
}); 