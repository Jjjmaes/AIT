"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIReviewService = void 0;
const ai_service_types_1 = require("../types/ai-service.types");
const ai_adapters_1 = require("./translation/ai-adapters");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * AI审校服务
 * 提供独立的AI审校功能，可以被其他服务或控制器调用
 */
class AIReviewService {
    constructor() {
        this.aiServiceFactory = ai_adapters_1.AIServiceFactory.getInstance();
    }
    /**
     * 获取AI审校适配器
     */
    getReviewAdapter(config) {
        const adapterConfig = {
            provider: config.provider,
            apiKey: config.apiKey,
            model: config.model,
            temperature: 0.3,
            maxTokens: 4000
        };
        return this.aiServiceFactory.createReviewAdapter(adapterConfig);
    }
    /**
     * 执行文本审校
     * @param original 原文
     * @param translation 翻译
     * @param options 审校选项
     */
    async reviewTranslation(original, translation, options) {
        try {
            // 获取API密钥（首选传入的，否则使用环境变量）
            const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
            if (!apiKey) {
                throw new Error('未配置API密钥');
            }
            // 获取提供商（首选传入的，否则默认为OpenAI）
            const provider = options.provider || ai_service_types_1.AIProvider.OPENAI;
            // 获取模型（首选传入的，否则使用默认值）
            const model = options.model || 'gpt-3.5-turbo';
            // 获取审校适配器
            const reviewAdapter = this.getReviewAdapter({
                provider,
                apiKey,
                model
            });
            // 构建审校选项
            const reviewOptions = {
                sourceLanguage: options.sourceLanguage,
                targetLanguage: options.targetLanguage,
                originalContent: original,
                translatedContent: translation,
                customPrompt: options.customPrompt,
                requestedScores: options.requestedScores,
                checkIssueTypes: options.checkIssueTypes,
                contextSegments: options.contextSegments
            };
            // 执行审校并返回结果
            logger_1.default.info(`Starting AI review using ${provider} model ${model}`);
            const result = await reviewAdapter.reviewText(reviewOptions);
            logger_1.default.info('AI review completed successfully');
            return result;
        }
        catch (error) {
            logger_1.default.error('AI review failed', { error });
            throw new Error(`AI审校失败: ${error.message}`);
        }
    }
    /**
     * 执行文本审校（简化别名方法）
     * @param original 原文
     * @param translation 翻译
     * @param options 审校选项
     */
    async reviewText(original, translation, options) {
        return this.reviewTranslation(original, translation, options);
    }
    /**
     * 获取支持的审校模型列表
     * @param provider AI提供商
     * @param apiKey API密钥
     */
    async getSupportedModels(provider = ai_service_types_1.AIProvider.OPENAI, apiKey) {
        try {
            // 获取API密钥（首选传入的，否则使用环境变量）
            const key = apiKey || process.env.OPENAI_API_KEY;
            if (!key) {
                throw new Error('未配置API密钥');
            }
            // 获取审校适配器
            const reviewAdapter = this.getReviewAdapter({
                provider,
                apiKey: key,
                model: 'gpt-3.5-turbo' // 这里只是用来初始化适配器，不会真正使用该模型
            });
            // 获取适配器支持的模型
            const models = await reviewAdapter.getAvailableModels();
            // 过滤出具有审校能力的模型
            return models.filter(model => model.capabilities.includes('review'));
        }
        catch (error) {
            logger_1.default.error('Failed to get supported models', { error });
            throw new Error(`获取支持的模型失败: ${error.message}`);
        }
    }
    /**
     * 验证API密钥是否有效
     * @param provider AI提供商
     * @param apiKey API密钥
     */
    async validateApiKey(provider = ai_service_types_1.AIProvider.OPENAI, apiKey) {
        try {
            // 获取审校适配器
            const reviewAdapter = this.getReviewAdapter({
                provider,
                apiKey,
                model: 'gpt-3.5-turbo' // 这里只是用来初始化适配器，不会真正使用该模型
            });
            // 验证API密钥
            return await reviewAdapter.validateApiKey();
        }
        catch (error) {
            logger_1.default.error('API key validation failed', { error });
            return false;
        }
    }
}
exports.AIReviewService = AIReviewService;
// 导出服务实例
exports.default = new AIReviewService();
