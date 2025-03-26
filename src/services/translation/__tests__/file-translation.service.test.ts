import { FileTranslationService } from '../file-translation.service';
import { TranslationService } from '../translation.service';
import { TranslationOptions } from '../../../types/translation.types';
import { TranslationStatus } from '../../../types/translation.types';
import { AIProvider } from '../../../types/ai-service.types';
import { AIServiceResponse } from '../../../types/ai-service.types';
import { Types } from 'mongoose';

// Mock TranslationService
jest.mock('../translation.service');

describe('FileTranslationService', () => {
  let fileTranslationService: FileTranslationService;
  let mockTranslationService: jest.Mocked<TranslationService>;
  let mockFileId: Types.ObjectId;
  let mockProjectId: Types.ObjectId;
  let mockOptions: TranslationOptions;

  beforeEach(() => {
    // 创建 mock IDs
    mockFileId = new Types.ObjectId();
    mockProjectId = new Types.ObjectId();

    // 创建 mock 选项
    mockOptions = {
      sourceLanguage: 'en',
      targetLanguage: 'zh',
      preserveFormatting: true
    };

    // 创建 mock TranslationService
    mockTranslationService = {
      translateText: jest.fn(),
      translateMultipleSegments: jest.fn(),
      validateApiKey: jest.fn(),
      getAvailableModels: jest.fn(),
      getModelInfo: jest.fn(),
      getPricing: jest.fn()
    } as any;

    fileTranslationService = new FileTranslationService(
      mockTranslationService,
      mockFileId,
      mockProjectId,
      mockOptions
    );
  });

  describe('initialize', () => {
    it('should initialize translation tasks', async () => {
      const segments = ['Hello', 'World'];

      await fileTranslationService.initialize(segments);

      const tasks = fileTranslationService.getTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toMatchObject({
        projectId: mockProjectId,
        fileId: mockFileId,
        status: TranslationStatus.PENDING,
        options: mockOptions
      });
    });

    it('should handle initialization errors', async () => {
      const segments = null as any;
      const error = new Error('Cannot read properties of null');

      await expect(fileTranslationService.initialize(segments)).rejects.toThrow();
    });
  });

  describe('translate', () => {
    it('should successfully translate all segments', async () => {
      const segments = ['Hello', 'World'];
      await fileTranslationService.initialize(segments);

      const mockResponse1: AIServiceResponse = {
        translatedText: '你好',
        metadata: {
          provider: AIProvider.OPENAI,
          model: 'gpt-3.5-turbo',
          processingTime: 50,
          confidence: 0.95,
          wordCount: 1,
          characterCount: 2,
          tokens: {
            input: 2,
            output: 1
          }
        }
      };

      const mockResponse2: AIServiceResponse = {
        translatedText: '世界',
        metadata: {
          provider: AIProvider.OPENAI,
          model: 'gpt-3.5-turbo',
          processingTime: 50,
          confidence: 0.95,
          wordCount: 1,
          characterCount: 2,
          tokens: {
            input: 2,
            output: 1
          }
        }
      };

      mockTranslationService.translateText
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      await fileTranslationService.translate();

      const progress = fileTranslationService.getProgress();
      expect(progress.status).toBe(TranslationStatus.COMPLETED);
      expect(progress.completedSegments).toBe(2);
      expect(progress.failedSegments).toBe(0);
    });

    it('should handle translation errors', async () => {
      const segments = ['Hello', 'World'];
      await fileTranslationService.initialize(segments);

      const mockResponse: AIServiceResponse = {
        translatedText: '你好',
        metadata: {
          provider: AIProvider.OPENAI,
          model: 'gpt-3.5-turbo',
          processingTime: 50,
          confidence: 0.95,
          wordCount: 1,
          characterCount: 2,
          tokens: {
            input: 2,
            output: 1
          }
        }
      };

      mockTranslationService.translateText
        .mockResolvedValueOnce(mockResponse)
        .mockRejectedValueOnce(new Error('Translation failed'));

      await expect(fileTranslationService.translate()).rejects.toThrow('Translation failed');

      const progress = fileTranslationService.getProgress();
      expect(progress.status).toBe(TranslationStatus.FAILED);
      expect(progress.completedSegments).toBe(1);
      expect(progress.failedSegments).toBe(1);
    });
  });

  describe('cancel', () => {
    it('should cancel all pending tasks', async () => {
      const segments = ['Hello', 'World'];
      await fileTranslationService.initialize(segments);

      fileTranslationService.cancel();

      const tasks = fileTranslationService.getTasks();
      expect(tasks.every(task => task.status === TranslationStatus.CANCELLED)).toBe(true);

      const progress = fileTranslationService.getProgress();
      expect(progress.status).toBe(TranslationStatus.CANCELLED);
    });
  });

  describe('getProgress', () => {
    it('should return current progress', async () => {
      const segments = ['Hello', 'World'];
      await fileTranslationService.initialize(segments);

      const progress = fileTranslationService.getProgress();
      expect(progress).toMatchObject({
        projectId: mockProjectId,
        fileId: mockFileId,
        totalSegments: 2,
        processedSegments: 0,
        completedSegments: 0,
        failedSegments: 0,
        progress: 0,
        status: TranslationStatus.PENDING
      });
    });
  });

  describe('getTasks', () => {
    it('should return all tasks', async () => {
      const segments = ['Hello', 'World'];
      await fileTranslationService.initialize(segments);

      const tasks = fileTranslationService.getTasks();
      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toMatchObject({
        projectId: mockProjectId,
        fileId: mockFileId,
        status: TranslationStatus.PENDING
      });
    });
  });
}); 