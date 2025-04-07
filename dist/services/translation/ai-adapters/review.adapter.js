"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewAdapter = void 0;
const openai_1 = require("openai");
const ai_service_types_1 = require("../../../types/ai-service.types");
const base_adapter_1 = require("./base.adapter");
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * OpenAI 审校适配器
 */
class ReviewAdapter extends base_adapter_1.BaseAIServiceAdapter {
    constructor(config) {
        super(config);
        // 初始化 OpenAI 客户端
        this.client = new openai_1.OpenAI({
            apiKey: config.apiKey,
            timeout: config.timeout || 60000,
        });
    }
    /**
     * 计算文本中的token数量
     * 这是一个简化的计算方法，实际上OpenAI使用的是基于BPE的tokenizer
     * 在生产环境中，应该使用更准确的计算方法
     */
    calculateTokens(text) {
        // 简单的估算方法：大约每4个字符为1个token
        return Math.ceil(text.length / 4);
    }
    /**
     * 计算文本中的单词数量
     */
    countWords(text) {
        // 简单的计算方法：按照空格分割
        return text.trim().split(/\s+/).length;
    }
    /**
     * 构建审校提示词
     */
    buildReviewPrompt(options) {
        const { sourceLanguage, targetLanguage, originalContent, translatedContent, contextSegments = [], customPrompt } = options;
        // 如果有自定义提示词，则使用自定义提示词
        if (customPrompt) {
            return customPrompt
                .replace('{SOURCE_LANGUAGE}', sourceLanguage)
                .replace('{TARGET_LANGUAGE}', targetLanguage)
                .replace('{ORIGINAL_CONTENT}', originalContent)
                .replace('{TRANSLATED_CONTENT}', translatedContent);
        }
        let context = '';
        if (contextSegments.length > 0) {
            context = '上下文段落：\n';
            contextSegments.forEach((segment, index) => {
                context += `[段落 ${index + 1}]\n原文：${segment.original}\n译文：${segment.translation}\n\n`;
            });
        }
        return `
你是一位专业的翻译审校专家，精通${sourceLanguage}和${targetLanguage}。
请审校以下翻译，提供详细的问题分析和改进建议。
使用JSON格式回复，包含以下内容：

1. 原文内容：
${originalContent}

2. 当前翻译：
${translatedContent}

${context}

请分析以下几个方面：
1. 准确性：译文是否准确传达了原文的所有信息和含义
2. 流畅度：译文是否符合目标语言的表达习惯，是否自然流畅
3. 术语一致性：专业术语和关键词的翻译是否准确一致
4. 语法和拼写：是否存在语法错误或拼写错误
5. 风格一致性：译文风格是否与原文一致

请按照以下JSON格式回复，仅返回JSON数据：

{
  "suggestedTranslation": "你认为的最佳翻译",
  "issues": [
    {
      "type": "问题类型(accuracy/grammar/terminology/style/consistency/formatting/other)",
      "description": "问题描述",
      "position": {
        "start": 问题在译文中的起始位置(数字),
        "end": 问题在译文中的结束位置(数字)
      },
      "suggestion": "修改建议"
    }
  ],
  "scores": [
    {
      "type": "overall",
      "score": 评分(0-100),
      "details": "评分理由"
    },
    {
      "type": "accuracy",
      "score": 评分(0-100),
      "details": "评分理由"
    },
    {
      "type": "fluency",
      "score": 评分(0-100),
      "details": "评分理由"
    },
    {
      "type": "terminology",
      "score": 评分(0-100),
      "details": "评分理由"
    },
    {
      "type": "style",
      "score": 评分(0-100),
      "details": "评分理由"
    }
  ]
}

请确保返回的JSON格式规范，可以被直接解析。不要包含任何JSON以外的说明文字。
`;
    }
    /**
     * 计算修改程度
     * 返回一个0-1之间的数值，表示修改的程度
     */
    calculateModificationDegree(original, modified) {
        if (!original || !modified)
            return 0;
        // 简单的字符级别差异计算
        let changes = 0;
        const maxLength = Math.max(original.length, modified.length);
        const minLength = Math.min(original.length, modified.length);
        // 长度差异
        changes += maxLength - minLength;
        // 字符差异
        for (let i = 0; i < minLength; i++) {
            if (original[i] !== modified[i]) {
                changes++;
            }
        }
        return Math.min(1, changes / maxLength);
    }
    /**
     * 执行审校
     */
    async reviewText(options) {
        const startTime = Date.now();
        try {
            const { translatedContent } = options;
            const prompt = this.buildReviewPrompt(options);
            // 计算输入token数
            const inputTokens = this.calculateTokens(prompt);
            // 调用OpenAI API
            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages: [
                    { role: 'system', content: 'You are a professional translation reviewer. Respond only with valid JSON.' },
                    { role: 'user', content: prompt }
                ],
                temperature: this.config.temperature || 0.3,
                max_tokens: this.config.maxTokens || 4000,
                top_p: this.config.topP || 1,
                frequency_penalty: this.config.frequencyPenalty || 0,
                presence_penalty: this.config.presencePenalty || 0,
                response_format: { type: 'json_object' }
            });
            // 提取响应内容
            const content = response.choices[0]?.message?.content || '';
            // 解析JSON
            let reviewResult;
            try {
                reviewResult = JSON.parse(content);
            }
            catch (error) {
                logger_1.default.error('Failed to parse AI review response', { error, content });
                throw this.createError('PARSE_ERROR', 'Failed to parse AI review response');
            }
            // 处理返回数据
            const outputTokens = this.calculateTokens(content);
            const processingTime = Date.now() - startTime;
            // 计算修改程度
            const modificationDegree = this.calculateModificationDegree(translatedContent, reviewResult.suggestedTranslation);
            // 构建响应
            const result = {
                suggestedTranslation: reviewResult.suggestedTranslation || translatedContent,
                issues: reviewResult.issues || [],
                scores: reviewResult.scores || [],
                metadata: {
                    provider: this.config.provider,
                    model: this.config.model,
                    processingTime,
                    confidence: 0.85, // 固定值，OpenAI不提供置信度
                    wordCount: this.countWords(translatedContent),
                    characterCount: translatedContent.length,
                    tokens: {
                        input: inputTokens,
                        output: outputTokens
                    },
                    modificationDegree
                }
            };
            return result;
        }
        catch (error) {
            logger_1.default.error('Error during AI review', { error });
            // 处理OpenAI API错误
            let errorCode = 'REVIEW_ERROR';
            let errorMessage = 'Failed to review text';
            if (error.status === 401) {
                errorCode = 'INVALID_API_KEY';
                errorMessage = 'Invalid API key';
            }
            else if (error.status === 429) {
                errorCode = 'RATE_LIMIT_EXCEEDED';
                errorMessage = 'Rate limit exceeded';
            }
            else if (error.status === 500) {
                errorCode = 'SERVICE_UNAVAILABLE';
                errorMessage = 'Service unavailable';
            }
            throw this.createError(errorCode, errorMessage, error);
        }
    }
    /**
     * 实现基类的必需方法（为审校服务提供转换）
     */
    async translateText(sourceText, promptData, // Use promptData from base
    options) {
        logger_1.default.warn('translateText called on ReviewAdapter. This might indicate a design issue.');
        const modelToUse = options?.model || this.config.defaultModel || 'gpt-3.5-turbo';
        const temp = options?.temperature ?? 0.3;
        const startTime = Date.now();
        try {
            const completion = await this.client.chat.completions.create({
                model: modelToUse,
                messages: [
                    { role: 'system', content: promptData?.systemInstruction || 'Translate the following text.' },
                    { role: 'user', content: promptData?.userPrompt || sourceText }
                ],
                temperature: temp,
            });
            const translatedText = completion.choices[0]?.message?.content || '';
            const processingTime = Date.now() - startTime;
            const tokenCount = completion.usage ? {
                input: completion.usage.prompt_tokens,
                output: completion.usage.completion_tokens,
                total: completion.usage.total_tokens
            } : undefined;
            return {
                translatedText,
                tokenCount,
                processingTime,
                modelInfo: { provider: this.provider.toString(), model: modelToUse }
            };
        }
        catch (error) {
            logger_1.default.error('Error during translateText in ReviewAdapter:', error);
            throw this.createError('TRANSLATION_FAILED', 'translateText failed in ReviewAdapter', error);
        }
    }
    /**
     * 验证API密钥
     */
    async validateApiKey() {
        try {
            // 简单调用模型列表API来验证API密钥
            await this.client.models.list();
            return true;
        }
        catch (error) {
            logger_1.default.error('API key validation failed', { error });
            return false;
        }
    }
    /**
     * 获取可用模型列表
     */
    async getAvailableModels() {
        return ReviewAdapter.AVAILABLE_MODELS;
    }
    /**
     * 获取特定模型信息
     */
    getModelInfo(modelId) {
        const model = ReviewAdapter.AVAILABLE_MODELS.find(model => model.id === modelId);
        if (!model) {
            throw this.createError('MODEL_NOT_FOUND', `Model ${modelId} not found`);
        }
        return Promise.resolve(model);
    }
    /**
     * 获取价格信息
     */
    getPricing(modelId) {
        const model = ReviewAdapter.AVAILABLE_MODELS.find(model => model.id === modelId);
        if (!model) {
            throw this.createError('MODEL_NOT_FOUND', `Model ${modelId} not found`);
        }
        return Promise.resolve(model.pricing);
    }
}
exports.ReviewAdapter = ReviewAdapter;
ReviewAdapter.AVAILABLE_MODELS = [
    {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: ai_service_types_1.AIProvider.OPENAI,
        maxTokens: 8192,
        capabilities: ['review', 'translation'],
        pricing: {
            input: 0.03,
            output: 0.06
        }
    },
    {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: ai_service_types_1.AIProvider.OPENAI,
        maxTokens: 128000,
        capabilities: ['review', 'translation'],
        pricing: {
            input: 0.01,
            output: 0.03
        }
    },
    {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: ai_service_types_1.AIProvider.OPENAI,
        maxTokens: 16385,
        capabilities: ['review', 'translation'],
        pricing: {
            input: 0.0005,
            output: 0.0015
        }
    }
];
