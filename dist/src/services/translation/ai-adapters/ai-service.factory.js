"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiServiceFactory = exports.AIServiceFactory = void 0;
const ai_service_types_1 = require("../../../types/ai-service.types");
const openai_adapter_1 = require("./openai.adapter");
const grok_adapter_1 = require("./grok.adapter");
const review_adapter_1 = require("./review.adapter");
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * AI服务工厂类 - 单例模式
 */
class AIServiceFactory {
    constructor() {
        this.adapters = new Map();
        this.reviewAdapters = new Map();
    }
    static getInstance() {
        if (!AIServiceFactory.instance) {
            AIServiceFactory.instance = new AIServiceFactory();
        }
        return AIServiceFactory.instance;
    }
    /**
     * 创建或获取AI服务适配器
     */
    createAdapter(config) {
        const { provider } = config;
        // 检查是否已有该提供商的适配器实例
        if (this.adapters.has(provider)) {
            const adapter = this.adapters.get(provider);
            if (adapter) {
                logger_1.default.info(`Using existing AI adapter for provider: ${provider}`);
                return adapter;
            }
        }
        // 创建新的适配器实例
        let adapter;
        switch (provider) {
            case ai_service_types_1.AIProvider.OPENAI:
                adapter = new openai_adapter_1.OpenAIAdapter(config);
                break;
            // 后续可以添加其他AI服务提供商的支持
            default:
                throw new Error(`Unsupported AI provider: ${provider}`);
        }
        // 存储适配器实例
        this.adapters.set(provider, adapter);
        logger_1.default.info(`Created new AI adapter for provider: ${provider}`);
        return adapter;
    }
    /**
     * 创建或获取AI审校适配器
     */
    createReviewAdapter(config) {
        const { provider } = config;
        // 检查是否已有该提供商的审校适配器实例
        if (this.reviewAdapters.has(provider)) {
            const adapter = this.reviewAdapters.get(provider);
            if (adapter) {
                logger_1.default.info(`Using existing AI review adapter for provider: ${provider}`);
                return adapter;
            }
        }
        // 创建新的审校适配器实例
        let adapter;
        switch (provider) {
            case ai_service_types_1.AIProvider.OPENAI:
                adapter = new review_adapter_1.ReviewAdapter(config);
                break;
            // 后续可以添加其他AI服务提供商的支持
            default:
                throw new Error(`Unsupported AI provider for review: ${provider}`);
        }
        // 存储适配器实例
        this.reviewAdapters.set(provider, adapter);
        logger_1.default.info(`Created new AI review adapter for provider: ${provider}`);
        return adapter;
    }
    /**
     * 移除适配器
     */
    removeAdapter(provider) {
        if (this.adapters.has(provider)) {
            this.adapters.delete(provider);
            logger_1.default.info(`Removed AI adapter for provider: ${provider}`);
        }
        if (this.reviewAdapters.has(provider)) {
            this.reviewAdapters.delete(provider);
            logger_1.default.info(`Removed AI review adapter for provider: ${provider}`);
        }
    }
    /**
     * 获取适配器
     */
    getAdapter(provider, config) {
        // If config is provided, always create a new instance
        if (config) {
            logger_1.default.info(`Creating new adapter instance for ${provider} with specific config.`);
            config.provider = provider; // Ensure provider is set in config
            switch (provider) {
                case ai_service_types_1.AIProvider.OPENAI:
                    return new openai_adapter_1.OpenAIAdapter(config);
                case ai_service_types_1.AIProvider.GROK: // Added Grok case
                    return new grok_adapter_1.GrokAdapter(config);
                // Add cases for other providers like GOOGLE, DEEPSEEK etc.
                default:
                    throw new Error(`Unsupported AI provider for specific config creation: ${provider}`);
            }
        }
        // Use singleton based on provider type if no specific config
        if (!this.adapters.has(provider)) {
            logger_1.default.info(`Creating singleton adapter instance for ${provider}.`);
            // Load default config for the provider (logic might vary)
            // This assumes a mechanism to load default API keys etc.
            const defaultConfig = this.loadDefaultConfigForProvider(provider);
            let adapter;
            switch (provider) {
                case ai_service_types_1.AIProvider.OPENAI:
                    adapter = new openai_adapter_1.OpenAIAdapter(defaultConfig);
                    break;
                case ai_service_types_1.AIProvider.GROK: // Added Grok case
                    adapter = new grok_adapter_1.GrokAdapter(defaultConfig);
                    break;
                // Add cases for other providers
                default:
                    throw new Error(`Unsupported AI provider for singleton creation: ${provider}`);
            }
            this.adapters.set(provider, adapter);
        }
        const adapterInstance = this.adapters.get(provider);
        if (!adapterInstance) {
            // This should theoretically not happen if the above logic is sound
            throw new Error(`Failed to get or create adapter instance for ${provider}`);
        }
        return adapterInstance;
    }
    // Placeholder for loading default config - implement based on your config strategy
    loadDefaultConfigForProvider(provider) {
        logger_1.default.warn(`[AIServiceFactory] loadDefaultConfigForProvider called for ${provider}. Using potentially insecure defaults or environment variables.`);
        // Example: Load from environment variables or a config file
        // IMPORTANT: Securely manage API keys (e.g., use process.env)
        let apiKey;
        let defaultModel;
        switch (provider) {
            case ai_service_types_1.AIProvider.OPENAI:
                apiKey = process.env.OPENAI_API_KEY;
                defaultModel = process.env.OPENAI_DEFAULT_MODEL || 'gpt-3.5-turbo';
                break;
            case ai_service_types_1.AIProvider.GROK:
                apiKey = process.env.GROK_API_KEY; // Use GROK_API_KEY from env
                defaultModel = process.env.GROK_DEFAULT_MODEL || 'grok-3-latest';
                break;
            // Add cases for other providers
            default:
                throw new Error(`Default configuration loading not implemented for provider: ${provider}`);
        }
        if (!apiKey) {
            throw new Error(`API key environment variable not found for provider: ${provider}`);
        }
        return {
            provider,
            apiKey,
            defaultModel
        };
    }
    /**
     * 获取审校适配器
     */
    getReviewAdapter(provider) {
        return this.reviewAdapters.get(provider);
    }
}
exports.AIServiceFactory = AIServiceFactory;
// Export the singleton instance
exports.aiServiceFactory = AIServiceFactory.getInstance();
