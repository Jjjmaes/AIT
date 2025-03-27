"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIAdapter = void 0;
const openai_1 = __importDefault(require("openai"));
const base_adapter_1 = require("./base.adapter");
const ai_service_types_1 = require("../../../types/ai-service.types");
class OpenAIAdapter extends base_adapter_1.BaseAIServiceAdapter {
    constructor(config) {
        super(config);
        this.availableModels = [
            {
                id: 'gpt-4',
                name: 'GPT-4',
                provider: ai_service_types_1.AIProvider.OPENAI,
                maxTokens: 8192,
                capabilities: ['translation', 'text-generation'],
                pricing: {
                    input: 0.03,
                    output: 0.06
                }
            },
            {
                id: 'gpt-3.5-turbo',
                name: 'GPT-3.5 Turbo',
                provider: ai_service_types_1.AIProvider.OPENAI,
                maxTokens: 4096,
                capabilities: ['translation', 'text-generation'],
                pricing: {
                    input: 0.0015,
                    output: 0.002
                }
            }
        ];
        this.client = new openai_1.default({
            apiKey: config.apiKey,
            timeout: config.timeout || 30000
        });
    }
    async translateText(sourceText, options) {
        try {
            const startTime = Date.now();
            const prompt = await this.buildPrompt(sourceText, options);
            const completion = await this.client.chat.completions.create({
                model: this.config.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional translator. Please provide accurate and natural translations.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: this.config.temperature || 0.3,
                max_tokens: this.config.maxTokens || 2000,
                top_p: this.config.topP || 1,
                frequency_penalty: this.config.frequencyPenalty || 0,
                presence_penalty: this.config.presencePenalty || 0
            });
            const translatedText = completion.choices[0].message.content || '';
            const processingTime = Date.now() - startTime;
            return {
                translatedText,
                metadata: {
                    provider: ai_service_types_1.AIProvider.OPENAI,
                    model: this.config.model,
                    processingTime,
                    confidence: 0.9, // OpenAI 不提供置信度，使用默认值
                    wordCount: this.calculateWordCount(translatedText),
                    characterCount: this.calculateCharacterCount(translatedText),
                    tokens: {
                        input: completion.usage?.prompt_tokens || 0,
                        output: completion.usage?.completion_tokens || 0
                    }
                }
            };
        }
        catch (error) {
            if (error instanceof openai_1.default.APIError) {
                throw this.createError(error.code || 'OPENAI_API_ERROR', error.message, error);
            }
            throw this.createError('UNKNOWN_ERROR', 'An unknown error occurred during translation', error);
        }
    }
    async validateApiKey() {
        try {
            await this.client.models.list();
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async getAvailableModels() {
        return this.availableModels;
    }
    async getModelInfo(modelId) {
        const model = this.availableModels.find(m => m.id === modelId);
        if (!model) {
            throw this.createError('MODEL_NOT_FOUND', `Model ${modelId} not found`);
        }
        return model;
    }
    async getPricing(modelId) {
        const model = await this.getModelInfo(modelId);
        return model.pricing;
    }
}
exports.OpenAIAdapter = OpenAIAdapter;
