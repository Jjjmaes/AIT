"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIServiceFactory = void 0;
const ai_service_types_1 = require("../../../types/ai-service.types");
const openai_adapter_1 = require("./openai.adapter");
class AIServiceFactory {
    constructor() {
        this.adapters = new Map();
    }
    static getInstance() {
        if (!AIServiceFactory.instance) {
            AIServiceFactory.instance = new AIServiceFactory();
        }
        return AIServiceFactory.instance;
    }
    createAdapter(config) {
        const { provider } = config;
        // 检查是否已存在适配器实例
        if (this.adapters.has(provider)) {
            return this.adapters.get(provider);
        }
        // 创建新的适配器实例
        let adapter;
        switch (provider) {
            case ai_service_types_1.AIProvider.OPENAI:
                adapter = new openai_adapter_1.OpenAIAdapter(config);
                break;
            // 后续添加其他 AI 服务提供商
            default:
                throw new Error(`Unsupported AI provider: ${provider}`);
        }
        // 缓存适配器实例
        this.adapters.set(provider, adapter);
        return adapter;
    }
    removeAdapter(provider) {
        this.adapters.delete(provider);
    }
    getAdapter(provider) {
        return this.adapters.get(provider);
    }
}
exports.AIServiceFactory = AIServiceFactory;
