"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIProviderManager = exports.AIProvider = void 0;
const openai_1 = __importDefault(require("openai"));
const logger_1 = __importDefault(require("../utils/logger"));
// Define supported AI providers
var AIProvider;
(function (AIProvider) {
    AIProvider["OPENAI"] = "openai";
    AIProvider["GOOGLE"] = "google";
    AIProvider["DEEPSEEK"] = "deepseek";
    AIProvider["GROK"] = "grok"; // Added Grok
    // Add more providers as needed
})(AIProvider || (exports.AIProvider = AIProvider = {}));
class AIProviderManager {
    constructor() {
        this.openai = new openai_1.default({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    async translateText(text, options) {
        try {
            const prompt = this.buildPrompt(text, options);
            const response = await this.openai.chat.completions.create({
                model: options.aiModel || 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            });
            return response.choices[0].message.content || '';
        }
        catch (error) {
            logger_1.default.error('Translation error:', error);
            throw error;
        }
    }
    async translateBatch(texts, options) {
        const results = await Promise.all(texts.map(text => this.translateText(text, options)));
        return results;
    }
    buildPrompt(text, options) {
        return `Translate the following text from ${options.sourceLanguage} to ${options.targetLanguage}:
${options.domain ? `Domain: ${options.domain}\n` : ''}
Text to translate:
${text}

Please provide only the translation without any additional text or explanations.`;
    }
}
exports.AIProviderManager = AIProviderManager;
