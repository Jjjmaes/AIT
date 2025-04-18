"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const file_translation_service_1 = require("../../services/translation/file-translation.service");
const translation_service_1 = require("../../services/translation/translation.service");
const openai_adapter_1 = require("../../services/translation/ai-adapters/openai.adapter");
const translation_types_1 = require("../../types/translation.types");
const ai_service_types_1 = require("../../types/ai-service.types");
const mongoose_1 = require("mongoose");
const globals_1 = require("@jest/globals");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const ai_service_factory_1 = require("../../services/translation/ai-adapters/ai-service.factory");
const translationQueue_service_1 = require("../../services/translationQueue.service");
const project_model_1 = require("../../models/project.model");
const file_model_1 = require("../../models/file.model");
const segment_model_1 = require("../../models/segment.model");
// 模拟 OpenAI 包
globals_1.jest.mock('openai');
globals_1.jest.mock('../../utils/logger');
describe('Translation Integration', () => {
    let fileTranslationService;
    let translationService;
    let openAIAdapter;
    let tempDir;
    let fileId;
    let projectId;
    let mockProject;
    let mockSegments;
    const mockTranslationOptions = {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        preserveFormatting: true,
        useTerminology: false,
        aiModel: 'gpt-3.5-turbo'
    };
    const mockAIConfig = {
        provider: ai_service_types_1.AIProvider.OPENAI,
        apiKey: 'test-api-key',
        aiModel: 'gpt-3.5-turbo',
        maxTokens: 2000,
        temperature: 0.3
    };
    beforeEach(() => {
        globals_1.jest.clearAllMocks();
        // 创建临时目录
        tempDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'translation-test-'));
        fileId = new mongoose_1.Types.ObjectId();
        projectId = new mongoose_1.Types.ObjectId();
        // 创建 OpenAI 适配器
        openAIAdapter = new openai_adapter_1.OpenAIAdapter(mockAIConfig);
        // 模拟 OpenAI 客户端的响应
        globals_1.jest.spyOn(openAIAdapter, 'translateText')
            .mockImplementation(async (sourceText, promptData, options) => ({
            translatedText: `翻译: ${sourceText}`,
            modelInfo: { provider: 'mock', model: options?.aiModel || 'default-mock' },
            tokenCount: { input: 10, output: 10, total: 20 },
            processingTime: 50
        }));
        // 模拟 AIServiceFactory
        globals_1.jest.spyOn(ai_service_factory_1.AIServiceFactory, 'getInstance')
            .mockImplementation(() => ({
            createAdapter: () => openAIAdapter
        }));
        // 创建翻译服务
        translationService = new translation_service_1.TranslationService({
            ...mockAIConfig,
            enableQueue: false,
            enableCache: false
        });
        // 创建文件翻译服务
        fileTranslationService = new file_translation_service_1.FileTranslationService(translationService, fileId, projectId, mockTranslationOptions);
        mockProject = new project_model_1.Project({
            _id: projectId,
            name: 'Test Project',
            languagePairs: [{ source: 'en', target: 'fr' }],
            manager: new mongoose_1.Types.ObjectId(),
            files: [new file_model_1.File({ _id: fileId, name: 'Test File', type: 'txt', status: 'pending' })],
            status: 'active',
            owner: new mongoose_1.Types.ObjectId(),
            members: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        mockProject.save = globals_1.jest.fn(async () => mockProject);
        mockSegments = [
            new segment_model_1.Segment({
                _id: new mongoose_1.Types.ObjectId(),
                fileId: fileId,
                sourceText: 'Segment 1',
                status: segment_model_1.SegmentStatus.PENDING,
                index: 0,
                sourceLength: 9,
                createdAt: new Date(),
                updatedAt: new Date(),
            }),
            new segment_model_1.Segment({
                _id: new mongoose_1.Types.ObjectId(),
                fileId: fileId,
                sourceText: 'Segment 2',
                status: segment_model_1.SegmentStatus.PENDING,
                index: 1,
                sourceLength: 9,
                createdAt: new Date(),
                updatedAt: new Date(),
            }),
        ];
    });
    afterEach(() => {
        // 清理临时文件
        if (fs_1.default.existsSync(tempDir)) {
            fs_1.default.rmSync(tempDir, { recursive: true, force: true });
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
            expect(tasks.every(task => task.status === translation_types_1.TranslationStatus.COMPLETED)).toBe(true);
            // 验证进度
            expect(progress.totalSegments).toBe(3);
            expect(progress.completedSegments).toBe(3);
            expect(progress.failedSegments).toBe(0);
            expect(progress.progress).toBe(100);
            expect(progress.status).toBe(translation_types_1.TranslationStatus.COMPLETED);
            // 验证结果
            expect(result.segments.length).toBe(3);
            expect(result.segments[0].translatedText).toBeDefined();
            expect(result.segments[0].metadata.provider).toBe(ai_service_types_1.AIProvider.OPENAI);
            expect(result.segments[0].metadata.model).toBe('gpt-3.5-turbo');
        });
        test('应该处理部分段落翻译失败的情况', async () => {
            // 1. 初始化翻译任务
            await fileTranslationService.initialize(mockSegments.map(s => s.sourceText));
            // 2. 模拟第二个段落翻译失败
            globals_1.jest.spyOn(openAIAdapter, 'translateText')
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
            expect(tasks[0].status).toBe(translation_types_1.TranslationStatus.COMPLETED);
            expect(tasks[1].status).toBe(translation_types_1.TranslationStatus.FAILED);
            expect(tasks[2].status).toBe(translation_types_1.TranslationStatus.COMPLETED);
            // 验证进度
            expect(progress.totalSegments).toBe(3);
            expect(progress.completedSegments).toBe(2);
            expect(progress.failedSegments).toBe(1);
            expect(progress.status).toBe(translation_types_1.TranslationStatus.FAILED);
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
            expect(tasks.some(task => task.status === translation_types_1.TranslationStatus.CANCELLED)).toBe(true);
            // 验证进度
            expect(progress.status).toBe(translation_types_1.TranslationStatus.CANCELLED);
        });
    });
    describe('文本翻译集成测试', () => {
        test('应该成功翻译简单文本', async () => {
            const result = await translationService.translateText('Hello World', mockTranslationOptions);
            expect(result.translatedText).toBeDefined();
            expect(result.metadata.provider).toBe(ai_service_types_1.AIProvider.OPENAI);
            expect(result.metadata.model).toBe('gpt-3.5-turbo');
        });
        test('应该成功翻译多段落文本', async () => {
            const text = `First paragraph.
Second paragraph.
Third paragraph.`;
            const result = await translationService.translateText(text, mockTranslationOptions);
            expect(result.translatedText).toBeDefined();
            expect(result.translatedText.split('\n')).toHaveLength(3);
        });
        test('应该处理特殊字符', async () => {
            const text = 'Hello! @#$%^&*()_+ World';
            const result = await translationService.translateText(text, mockTranslationOptions);
            expect(result.translatedText).toBeDefined();
            expect(result.translatedText).not.toBe(text);
        });
    });
    describe('文件翻译集成测试', () => {
        test('应该成功翻译文本文件', async () => {
            const sourceFile = path_1.default.join(tempDir, 'test.txt');
            const targetFile = path_1.default.join(tempDir, 'test.zh.txt');
            // 创建测试文件
            fs_1.default.writeFileSync(sourceFile, 'Hello World\nThis is a test file.');
            // 初始化翻译任务
            const segmentsText = ['Hello World', 'This is a test file.'];
            await fileTranslationService.initialize(segmentsText);
            await fileTranslationService.translate();
            // 获取结果并写入目标文件
            const result = await fileTranslationService.getResult();
            fs_1.default.writeFileSync(targetFile, result.segments.map(s => s.translatedText).join('\n'));
            expect(fs_1.default.existsSync(targetFile)).toBe(true);
            const translatedContent = fs_1.default.readFileSync(targetFile, 'utf-8');
            expect(translatedContent).toBeDefined();
            expect(translatedContent.split('\n')).toHaveLength(2);
        });
        test('应该处理大文件', async () => {
            const sourceFile = path_1.default.join(tempDir, 'large.txt');
            const targetFile = path_1.default.join(tempDir, 'large.zh.txt');
            // 创建大文件（超过默认分块大小）
            const segments = Array(100).fill('Line of text.'); // 减少测试数据量
            fs_1.default.writeFileSync(sourceFile, segments.join('\n'));
            // 初始化翻译任务
            await fileTranslationService.initialize(segments);
            await fileTranslationService.translate();
            // 获取结果并写入目标文件
            const result = await fileTranslationService.getResult();
            fs_1.default.writeFileSync(targetFile, result.segments.map(s => s.translatedText).join('\n'));
            expect(fs_1.default.existsSync(targetFile)).toBe(true);
            const translatedContent = fs_1.default.readFileSync(targetFile, 'utf-8');
            expect(translatedContent.split('\n')).toHaveLength(100);
        }, 30000); // 增加超时时间
        test('应该处理文件编码', async () => {
            const sourceFile = path_1.default.join(tempDir, 'utf8.txt');
            const targetFile = path_1.default.join(tempDir, 'utf8.zh.txt');
            // 创建包含 UTF-8 字符的文件
            const segments = ['Hello 世界', '测试文件'];
            fs_1.default.writeFileSync(sourceFile, segments.join('\n'), 'utf-8');
            // 初始化翻译任务
            await fileTranslationService.initialize(segments);
            await fileTranslationService.translate();
            // 获取结果并写入目标文件
            const result = await fileTranslationService.getResult();
            fs_1.default.writeFileSync(targetFile, result.segments.map(s => s.translatedText).join('\n'), 'utf-8');
            expect(fs_1.default.existsSync(targetFile)).toBe(true);
            const translatedContent = fs_1.default.readFileSync(targetFile, 'utf-8');
            expect(translatedContent).toBeDefined();
        });
        test('应该处理翻译失败的情况', async () => {
            const sourceFile = path_1.default.join(tempDir, 'error.txt');
            const targetFile = path_1.default.join(tempDir, 'error.zh.txt');
            // 创建测试文件
            const segments = ['Hello World'];
            fs_1.default.writeFileSync(sourceFile, segments.join('\n'));
            // 模拟翻译失败
            globals_1.jest.spyOn(openAIAdapter, 'translateText')
                .mockRejectedValueOnce(new Error('Translation failed'));
            // 初始化翻译任务
            await fileTranslationService.initialize(segments);
            // 执行翻译
            await fileTranslationService.translate();
            // 获取结果
            const tasks = fileTranslationService.getTasks();
            const progress = fileTranslationService.getProgress();
            // 验证任务状态
            expect(tasks[0].status).toBe(translation_types_1.TranslationStatus.FAILED);
            expect(tasks[0].error).toBe('Translation failed');
            // 验证进度
            expect(progress.status).toBe(translation_types_1.TranslationStatus.FAILED);
            expect(progress.failedSegments).toBe(1);
            // 验证文件
            expect(fs_1.default.existsSync(targetFile)).toBe(false);
        });
    });
    describe('翻译队列集成测试', () => {
        test('应该成功添加翻译任务', async () => {
            // Use the imported instance
            const jobId = await translationQueue_service_1.translationQueueService.addFileTranslationJob(mockProject._id.toString(), fileId.toString(), mockTranslationOptions, new mongoose_1.Types.ObjectId().toString(), // Add missing userId
            ['admin'] // Added mock requesterRoles
            );
            expect(jobId).toBeDefined();
        });
    });
});
