"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiServiceFactory = void 0;
const ai_service_types_1 = require("../../types/ai-service.types");
const openai_adapter_1 = require("./ai-adapters/openai.adapter");
const logger_1 = __importDefault(require("../../utils/logger"));
const process_1 = __importDefault(require("process")); // Import process for env vars
class AIServiceFactory {
    constructor() {
        // Use a single map storing the combined type
        this.adapters = new Map();
    }
    static getInstance() {
        if (!AIServiceFactory.instance) {
            AIServiceFactory.instance = new AIServiceFactory();
        }
        return AIServiceFactory.instance;
    }
    // Adjust constructor type to expect the combined type
    getOrCreateAdapter(provider, adapterMap, 
    // Constructor should produce an object satisfying the combined type
    adapterConstructor, adapterTypeName, config) {
        // If specific config provided, always create new
        if (config) {
            logger_1.default.info(`Creating new ${adapterTypeName} instance for ${provider} with specific config.`);
            config.provider = provider;
            const adapter = new adapterConstructor(config);
            adapterMap.set(provider, adapter);
            return adapter;
        }
        // Use singleton based on provider type
        if (!adapterMap.has(provider)) {
            logger_1.default.info(`Creating singleton ${adapterTypeName} instance for ${provider}.`);
            const defaultConfig = this.loadDefaultConfig(provider);
            if (!defaultConfig) {
                throw new Error(`Default configuration not found for AI provider: ${provider}`);
            }
            const adapter = new adapterConstructor(defaultConfig);
            adapterMap.set(provider, adapter);
        }
        const adapterInstance = adapterMap.get(provider);
        if (!adapterInstance) {
            throw new Error(`Failed to get or create ${adapterTypeName} for ${provider}`);
        }
        return adapterInstance;
    }
    loadDefaultConfig(provider) {
        switch (provider) {
            case ai_service_types_1.AIProvider.OPENAI:
                const apiKey = process_1.default.env.OPENAI_API_KEY;
                const defaultModel = process_1.default.env.OPENAI_DEFAULT_MODEL;
                if (!apiKey) {
                    logger_1.default.error('OPENAI_API_KEY environment variable not set.');
                    return null;
                }
                return {
                    provider: ai_service_types_1.AIProvider.OPENAI,
                    apiKey: apiKey,
                    defaultModel: defaultModel
                };
            // Add other providers here
            default:
                logger_1.default.warn(`Default config loader not implemented for provider: ${provider}`);
                return null;
        }
    }
    getTranslationAdapter(provider = ai_service_types_1.AIProvider.OPENAI, config) {
        const providerEnum = provider;
        switch (providerEnum) {
            case ai_service_types_1.AIProvider.OPENAI:
                // Pass OpenAIAdapter constructor, assuming it fits the combined type constructor signature
                return this.getOrCreateAdapter(providerEnum, this.adapters, openai_adapter_1.OpenAIAdapter, 'Adapter', config);
            default:
                throw new Error(`Unsupported translation provider: ${provider}`);
        }
    }
    getReviewAdapter(provider = ai_service_types_1.AIProvider.OPENAI, config) {
        const providerEnum = provider;
        switch (providerEnum) {
            case ai_service_types_1.AIProvider.OPENAI:
                // Pass OpenAIAdapter constructor, assuming it fits the combined type constructor signature
                return this.getOrCreateAdapter(providerEnum, this.adapters, openai_adapter_1.OpenAIAdapter, 'Adapter', config);
            default:
                throw new Error(`Unsupported review provider: ${provider}`);
        }
    }
}
exports.aiServiceFactory = AIServiceFactory.getInstance();
