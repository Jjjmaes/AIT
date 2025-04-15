"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const openai_adapter_1 = require("../../services/translation/ai-adapters/openai.adapter");
const ai_service_types_1 = require("../../types/ai-service.types");
const globals_1 = require("@jest/globals");
const errors_1 = require("../../utils/errors");
// 模拟 OpenAI 包
globals_1.jest.mock('openai');
globals_1.jest.mock('../../utils/logger');
describe('OpenAIAdapter', () => {
    let adapter;
    let mockOpenAI;
    let mockCreateCompletion;
    let mockListModels;
    const mockSourceText = 'Hello, world!';
    const mockOptions = {
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        aiModel: 'gpt-4'
    };
    const mockPromptData = {
        systemInstruction: 'You are a professional translator.',
        userPrompt: 'Translate the following text from en to zh. Text: Hello, world!'
    };
    beforeEach(() => {
        globals_1.jest.clearAllMocks();
        // 创建 OpenAI 客户端模拟
        mockOpenAI = {
            chat: {
                completions: {
                    create: globals_1.jest.fn()
                }
            },
            models: {
                list: globals_1.jest.fn()
            }
        };
        // 设置 mock 函数
        mockCreateCompletion = globals_1.jest.spyOn(mockOpenAI.chat.completions, 'create');
        mockListModels = globals_1.jest.spyOn(mockOpenAI.models, 'list');
        // 设置返回值
        mockCreateCompletion.mockResolvedValue({
            id: 'chatcmpl-123',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-3.5-turbo',
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: '你好世界'
                    },
                    finish_reason: 'stop'
                }
            ],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15
            }
        });
        mockListModels.mockResolvedValue({
            data: [
                { id: 'gpt-3.5-turbo', object: 'model', owned_by: 'openai' },
                { id: 'gpt-4', object: 'model', owned_by: 'openai' },
                { id: 'gpt-4-vision', object: 'model', owned_by: 'openai' }
            ]
        });
        // 创建适配器实例
        adapter = new openai_adapter_1.OpenAIAdapter({
            apiKey: 'test-key',
            provider: ai_service_types_1.AIProvider.OPENAI,
            model: 'gpt-3.5-turbo'
        });
        adapter.client = mockOpenAI;
    });
    describe('translateText', () => {
        it('应该成功翻译文本', async () => {
            const mockResponse = {
                choices: [
                    {
                        message: {
                            content: '你好，世界！'
                        }
                    }
                ],
                usage: {
                    prompt_tokens: 50,
                    completion_tokens: 30
                }
            };
            mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);
            const result = await adapter.translateText(mockSourceText, mockPromptData, mockOptions);
            expect(result.translatedText).toBe('你好，世界！');
            expect(result.modelInfo).toEqual({ provider: 'openai', model: 'gpt-4-mock' });
            expect(result.tokenCount).toEqual({ input: 50, output: 30, total: 80 });
            expect(result.processingTime).toBeGreaterThanOrEqual(0);
            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
                model: mockOptions.aiModel,
                messages: [
                    {
                        role: 'system',
                        content: mockPromptData.systemInstruction
                    },
                    {
                        role: 'user',
                        content: mockPromptData.userPrompt
                    }
                ],
                temperature: 0.3,
            });
        });
        it('处理 API 调用失败', async () => {
            mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));
            await expect(adapter.translateText(mockSourceText, mockPromptData, mockOptions))
                .rejects
                .toThrow('API Error');
        });
        it('should handle API errors', async () => {
            const apiError = new Error('API Error');
            mockOpenAI.chat.completions.create.mockRejectedValue(apiError);
            await expect(adapter.translateText(mockSourceText, mockPromptData, mockOptions))
                .rejects.toThrow(errors_1.AppError);
        });
    });
    describe('validateApiKey', () => {
        it('有效的 API 密钥应该返回 true', async () => {
            mockOpenAI.models.list.mockResolvedValueOnce({ data: [] });
            const result = await adapter.validateApiKey();
            expect(result).toBe(true);
        });
        it('无效的 API 密钥应该返回 false', async () => {
            mockOpenAI.models.list.mockRejectedValueOnce(new Error('Invalid API key'));
            const result = await adapter.validateApiKey();
            expect(result).toBe(false);
        });
    });
    describe('getAvailableModels', () => {
        it('应该返回过滤后的模型列表', async () => {
            mockOpenAI.models.list.mockResolvedValueOnce({
                data: [
                    { id: 'gpt-4', root: 'gpt-4' },
                    { id: 'gpt-3.5-turbo', root: 'gpt-3.5-turbo' },
                    { id: 'text-davinci-003', root: 'text-davinci' }
                ]
            });
            const models = await adapter.getAvailableModels();
            expect(models).toEqual(['gpt-4', 'gpt-3.5-turbo']);
        });
        it('API 调用失败时应该返回硬编码模型列表', async () => {
            mockOpenAI.models.list.mockRejectedValueOnce(new Error('API Error'));
            const models = await adapter.getAvailableModels();
            expect(models).toEqual(['gpt-4', 'gpt-3.5-turbo']);
        });
    });
});
