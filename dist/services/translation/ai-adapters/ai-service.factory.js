"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIServiceFactory = void 0;
const ai_service_types_1 = require("../../../types/ai-service.types");
const openai_adapter_1 = require("./openai.adapter");
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
    getAdapter(provider) {
        return this.adapters.get(provider);
    }
    /**
     * 获取审校适配器
     */
    getReviewAdapter(provider) {
        return this.reviewAdapters.get(provider);
    }
}
exports.AIServiceFactory = AIServiceFactory;
