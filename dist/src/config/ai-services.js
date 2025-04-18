"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callAIService = exports.getAIClient = exports.anthropicClient = exports.openaiClient = exports.AIModels = exports.AIProvider = void 0;
const openai_1 = require("openai");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// 支持的AI服务提供商
var AIProvider;
(function (AIProvider) {
    AIProvider["OPENAI"] = "openai";
    AIProvider["ANTHROPIC"] = "anthropic";
    AIProvider["GROK"] = "grok";
})(AIProvider || (exports.AIProvider = AIProvider = {}));
// 各服务提供商支持的模型列表
exports.AIModels = {
    [AIProvider.OPENAI]: [
        'gpt-4',
        'gpt-4-turbo',
        'gpt-3.5-turbo',
    ],
    [AIProvider.ANTHROPIC]: [
        'claude-3-opus',
        'claude-3-sonnet',
        'claude-3-haiku',
    ],
    [AIProvider.GROK]: [
        'grok-1',
    ],
};
// 初始化AI服务客户端
exports.openaiClient = new openai_1.OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
});
exports.anthropicClient = new sdk_1.default({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});
// 简单的AI服务工厂函数，根据提供商返回相应客户端
const getAIClient = (provider) => {
    switch (provider) {
        case AIProvider.OPENAI:
            return exports.openaiClient;
        case AIProvider.ANTHROPIC:
            return exports.anthropicClient;
        default:
            throw new Error(`AI provider ${provider} not supported or not configured`);
    }
};
exports.getAIClient = getAIClient;
// 统一的AI请求处理函数
const callAIService = async (config) => {
    const startTime = Date.now();
    try {
        switch (config.provider) {
            case AIProvider.OPENAI: {
                const messages = [];
                if (config.systemMessage) {
                    messages.push({
                        role: 'system',
                        content: config.systemMessage
                    });
                }
                messages.push({
                    role: 'user',
                    content: config.userMessage
                });
                const response = await exports.openaiClient.chat.completions.create({
                    model: config.model,
                    messages,
                    temperature: config.temperature ?? 0.7,
                    max_tokens: config.maxTokens,
                    top_p: config.topP ?? 1,
                });
                const content = response.choices[0]?.message?.content;
                if (!content) {
                    throw new Error('No content returned from OpenAI');
                }
                return content;
            }
            case AIProvider.ANTHROPIC: {
                const response = await exports.anthropicClient.messages.create({
                    model: config.model,
                    max_tokens: config.maxTokens || 1024,
                    messages: [
                        {
                            role: 'user',
                            content: config.userMessage
                        }
                    ],
                    system: config.systemMessage,
                    temperature: config.temperature ?? 0.7,
                });
                const content = response.content[0];
                if (!content || content.type !== 'text') {
                    throw new Error('No text content returned from Anthropic');
                }
                return content.text;
            }
            case AIProvider.GROK:
                // 待实现Grok API客户端
                throw new Error('Grok API integration not yet implemented');
            default:
                throw new Error(`Unsupported AI provider: ${config.provider}`);
        }
    }
    catch (error) {
        console.error(`AI service call failed: ${error.message}`);
        throw new Error(`AI service call failed: ${error.message}`);
    }
    finally {
        const endTime = Date.now();
        console.log(`AI call to ${config.provider}/${config.model} took ${endTime - startTime}ms`);
    }
};
exports.callAIService = callAIService;
