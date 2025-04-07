import { FileTranslationService } from '../../services/translation/file-translation.service';
import { TranslationService } from '../../services/translation/translation.service';
import { OpenAIAdapter } from '../../services/translation/ai-adapters/openai.adapter';
import { TranslationOptions, TranslationStatus } from '../../types/translation.types';
import { AIProvider, AIServiceConfig } from '../../types/ai-service.types';
import { Types } from 'mongoose';
import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AIServiceFactory } from '../../services/translation/ai-adapters/ai-service.factory';
import { translationQueueService } from '../../services/translationQueue.service';
import { ProcessedPrompt } from '../../utils/promptProcessor';
import { IProject, Project } from '../../models/project.model';
import { IFile, File } from '../../models/file.model';
import { ISegment, Segment, SegmentStatus } from '../../models/segment.model';

// 模拟 OpenAI 包
jest.mock('openai');
jest.mock('../../utils/logger');

describe('Translation Integration', () => {
  let fileTranslationService: FileTranslationService;
  let translationService: TranslationService;
  let openAIAdapter: OpenAIAdapter;
  let tempDir: string;
  let fileId: Types.ObjectId;
  let projectId: Types.ObjectId;
  let mockProject: IProject;
  let mockSegments: ISegment[];

  const mockTranslationOptions: TranslationOptions = {
    sourceLanguage: 'en',
    targetLanguage: 'zh',
    preserveFormatting: true,
    useTerminology: false,
    aiModel: 'gpt-3.5-turbo'
  };

  const mockAIConfig: AIServiceConfig = {
    provider: AIProvider.OPENAI,
    apiKey: 'test-api-key',
    aiModel: 'gpt-3.5-turbo',
    maxTokens: 2000,
    temperature: 0.3
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 创建临时目录
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'translation-test-'));
    fileId = new Types.ObjectId();
    projectId = new Types.ObjectId();
    
    // 创建 OpenAI 适配器
    openAIAdapter = new OpenAIAdapter(mockAIConfig);
    
    // 模拟 OpenAI 客户端的响应
    jest.spyOn(openAIAdapter, 'translateText')
      .mockImplementation(async (sourceText: string, promptData: ProcessedPrompt, options?: any) => ({
        translatedText: `翻译: ${sourceText}`,
        modelInfo: { provider: 'mock', model: options?.aiModel || 'default-mock' },
        tokenCount: { input: 10, output: 10, total: 20 },
        processingTime: 50
      }));
    
    // 模拟 AIServiceFactory
    jest.spyOn(AIServiceFactory, 'getInstance')
      .mockImplementation(() => ({
        createAdapter: () => openAIAdapter
      } as unknown as AIServiceFactory));
    
    // 创建翻译服务
    translationService = new TranslationService({
      ...mockAIConfig,
      enableQueue: false,
      enableCache: false
    });
    
    // 创建文件翻译服务
    fileTranslationService = new FileTranslationService(
      translationService,
      fileId,
      projectId,
      mockTranslationOptions
    );

    mockProject = new Project({
      _id: projectId,
      name: 'Test Project',
      languagePairs: [{ source: 'en', target: 'fr' }],
      manager: new Types.ObjectId(),
      files: [new File({ _id: fileId, name: 'Test File', type: 'txt', status: 'pending' }) as IFile],
      status: 'active',
      owner: new Types.ObjectId(),
      members: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as IProject;

    mockProject.save = jest.fn<() => Promise<IProject>>(async () => mockProject);

    mockSegments = [
      new Segment({
        _id: new Types.ObjectId(),
        fileId: fileId,
        sourceText: 'Segment 1',
        status: SegmentStatus.PENDING,
        index: 0,
        sourceLength: 9,
        createdAt: new Date(),
        updatedAt: new Date(),
      }) as ISegment,
      new Segment({
        _id: new Types.ObjectId(),
        fileId: fileId,
        sourceText: 'Segment 2',
        status: SegmentStatus.PENDING,
        index: 1,
        sourceLength: 9,
        createdAt: new Date(),
        updatedAt: new Date(),
      }) as ISegment,
    ];
  });

  afterEach(() => {
    // 清理临时文件
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('完整翻译流程', () => {
    test('应该成功完成整个翻译流程', async () => {
      // 1. 初始化翻译任务
      await fileTranslationService.initialize(mockSegments.map(s => s.sourceText));
      
      // 2. 开始翻译
      await fileTranslationService.translate();
      
      // 3. 获取结果
      const tasks = fileTranslationService.getTasks();
      const progress = fileTranslationService.getProgress();
      const result = await fileTranslationService.getResult();
      
      // 验证任务状态
      expect(tasks.length).toBe(3);
      expect(tasks.every(task => task.status === TranslationStatus.COMPLETED)).toBe(true);
      
      // 验证进度
      expect(progress.totalSegments).toBe(3);
      expect(progress.completedSegments).toBe(3);
      expect(progress.failedSegments).toBe(0);
      expect(progress.progress).toBe(100);
      expect(progress.status).toBe(TranslationStatus.COMPLETED);
      
      // 验证结果
      expect(result.segments.length).toBe(3);
      expect(result.segments[0].translatedText).toBeDefined();
      expect(result.segments[0].metadata.provider).toBe(AIProvider.OPENAI);
      expect(result.segments[0].metadata.model).toBe('gpt-3.5-turbo');
    });

    test('应该处理部分段落翻译失败的情况', async () => {
      // 1. 初始化翻译任务
      await fileTranslationService.initialize(mockSegments.map(s => s.sourceText));
      
      // 2. 模拟第二个段落翻译失败
      jest.spyOn(openAIAdapter, 'translateText')
        .mockImplementationOnce(async (sourceText, promptData, options) => ({
          translatedText: 'First translated segment',
          modelInfo: { provider: 'mock', model: options?.aiModel || 'default-mock' },
          tokenCount: { input: 5, output: 5, total: 10 },
          processingTime: 40
        }))
        .mockRejectedValueOnce(new Error('Translation failed - attempt 1'))
        .mockRejectedValueOnce(new Error('Translation failed - attempt 2'))
        .mockRejectedValueOnce(new Error('Translation failed - attempt 3'))
        .mockImplementationOnce(async (sourceText, promptData, options) => ({
          translatedText: 'Third translated segment',
          modelInfo: { provider: 'mock', model: options?.aiModel || 'default-mock' },
          tokenCount: { input: 7, output: 7, total: 14 },
          processingTime: 60
        }));
      
      // 3. 开始翻译
      await fileTranslationService.translate();
      
      // 4. 获取结果
      const tasks = fileTranslationService.getTasks();
      const progress = fileTranslationService.getProgress();
      const result = await fileTranslationService.getResult();
      
      // 验证任务状态
      expect(tasks[0].status).toBe(TranslationStatus.COMPLETED);
      expect(tasks[1].status).toBe(TranslationStatus.FAILED);
      expect(tasks[2].status).toBe(TranslationStatus.COMPLETED);
      
      // 验证进度
      expect(progress.totalSegments).toBe(3);
      expect(progress.completedSegments).toBe(2);
      expect(progress.failedSegments).toBe(1);
      expect(progress.status).toBe(TranslationStatus.FAILED);
      
      // 验证结果
      expect(result.segments.length).toBe(2);
      expect(result.segments[0].translatedText).toBe('First translated segment');
      expect(result.segments[1].translatedText).toBe('Third translated segment');
    });

    test('应该支持取消翻译任务', async () => {
      // 1. 初始化翻译任务
      await fileTranslationService.initialize(mockSegments.map(s => s.sourceText));
      
      // 2. 开始翻译
      const translatePromise = fileTranslationService.translate();
      
      // 3. 模拟翻译进行中
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 4. 取消翻译
      await fileTranslationService.cancel();
      
      // 5. 等待翻译完成
      await translatePromise;
      
      // 6. 获取结果
      const tasks = fileTranslationService.getTasks();
      const progress = fileTranslationService.getProgress();
      
      // 验证任务状态
      expect(tasks.some(task => task.status === TranslationStatus.CANCELLED)).toBe(true);
      
      // 验证进度
      expect(progress.status).toBe(TranslationStatus.CANCELLED);
    });
  });

  describe('文本翻译集成测试', () => {
    test('应该成功翻译简单文本', async () => {
      const result = await translationService.translateText(
        'Hello World',
        mockTranslationOptions
      );

      expect(result.translatedText).toBeDefined();
      expect(result.metadata.provider).toBe(AIProvider.OPENAI);
      expect(result.metadata.model).toBe('gpt-3.5-turbo');
    });

    test('应该成功翻译多段落文本', async () => {
      const text = `First paragraph.
Second paragraph.
Third paragraph.`;

      const result = await translationService.translateText(
        text,
        mockTranslationOptions
      );

      expect(result.translatedText).toBeDefined();
      expect(result.translatedText.split('\n')).toHaveLength(3);
    });

    test('应该处理特殊字符', async () => {
      const text = 'Hello! @#$%^&*()_+ World';
      
      const result = await translationService.translateText(
        text,
        mockTranslationOptions
      );

      expect(result.translatedText).toBeDefined();
      expect(result.translatedText).not.toBe(text);
    });
  });

  describe('文件翻译集成测试', () => {
    test('应该成功翻译文本文件', async () => {
      const sourceFile = path.join(tempDir, 'test.txt');
      const targetFile = path.join(tempDir, 'test.zh.txt');
      
      // 创建测试文件
      fs.writeFileSync(sourceFile, 'Hello World\nThis is a test file.');

      // 初始化翻译任务
      const segmentsText = ['Hello World', 'This is a test file.'];
      await fileTranslationService.initialize(segmentsText);
      await fileTranslationService.translate();

      // 获取结果并写入目标文件
      const result = await fileTranslationService.getResult();
      fs.writeFileSync(targetFile, result.segments.map(s => s.translatedText).join('\n'));

      expect(fs.existsSync(targetFile)).toBe(true);
      const translatedContent = fs.readFileSync(targetFile, 'utf-8');
      expect(translatedContent).toBeDefined();
      expect(translatedContent.split('\n')).toHaveLength(2);
    });

    test('应该处理大文件', async () => {
      const sourceFile = path.join(tempDir, 'large.txt');
      const targetFile = path.join(tempDir, 'large.zh.txt');
      
      // 创建大文件（超过默认分块大小）
      const segments = Array(100).fill('Line of text.'); // 减少测试数据量
      fs.writeFileSync(sourceFile, segments.join('\n'));

      // 初始化翻译任务
      await fileTranslationService.initialize(segments);
      await fileTranslationService.translate();

      // 获取结果并写入目标文件
      const result = await fileTranslationService.getResult();
      fs.writeFileSync(targetFile, result.segments.map(s => s.translatedText).join('\n'));

      expect(fs.existsSync(targetFile)).toBe(true);
      const translatedContent = fs.readFileSync(targetFile, 'utf-8');
      expect(translatedContent.split('\n')).toHaveLength(100);
    }, 30000); // 增加超时时间

    test('应该处理文件编码', async () => {
      const sourceFile = path.join(tempDir, 'utf8.txt');
      const targetFile = path.join(tempDir, 'utf8.zh.txt');
      
      // 创建包含 UTF-8 字符的文件
      const segments = ['Hello 世界', '测试文件'];
      fs.writeFileSync(sourceFile, segments.join('\n'), 'utf-8');

      // 初始化翻译任务
      await fileTranslationService.initialize(segments);
      await fileTranslationService.translate();

      // 获取结果并写入目标文件
      const result = await fileTranslationService.getResult();
      fs.writeFileSync(targetFile, result.segments.map(s => s.translatedText).join('\n'), 'utf-8');

      expect(fs.existsSync(targetFile)).toBe(true);
      const translatedContent = fs.readFileSync(targetFile, 'utf-8');
      expect(translatedContent).toBeDefined();
    });

    test('应该处理翻译失败的情况', async () => {
      const sourceFile = path.join(tempDir, 'error.txt');
      const targetFile = path.join(tempDir, 'error.zh.txt');
      
      // 创建测试文件
      const segments = ['Hello World'];
      fs.writeFileSync(sourceFile, segments.join('\n'));

      // 模拟翻译失败
      jest.spyOn(openAIAdapter, 'translateText')
        .mockRejectedValueOnce(new Error('Translation failed'));

      // 初始化翻译任务
      await fileTranslationService.initialize(segments);
      
      // 执行翻译
      await fileTranslationService.translate();
      
      // 获取结果
      const tasks = fileTranslationService.getTasks();
      const progress = fileTranslationService.getProgress();
      
      // 验证任务状态
      expect(tasks[0].status).toBe(TranslationStatus.FAILED);
      expect(tasks[0].error).toBe('Translation failed');
      
      // 验证进度
      expect(progress.status).toBe(TranslationStatus.FAILED);
      expect(progress.failedSegments).toBe(1);
      
      // 验证文件
      expect(fs.existsSync(targetFile)).toBe(false);
    });
  });

  describe('翻译队列集成测试', () => {
    test('应该成功添加翻译任务', async () => {
      // Use the imported instance
      const jobId = await translationQueueService.addFileTranslationJob(
        mockProject._id.toString(),
        fileId.toString(),
        mockTranslationOptions,
        new Types.ObjectId().toString() // Add missing userId
      );
      expect(jobId).toBeDefined();
    });
  });
}); 