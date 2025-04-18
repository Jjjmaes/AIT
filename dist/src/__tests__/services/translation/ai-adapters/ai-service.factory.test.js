"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ai_service_factory_1 = require("../../../../services/translation/ai-adapters/ai-service.factory");
const ai_service_types_1 = require("../../../../types/ai-service.types");
const openai_adapter_1 = require("../../../../services/translation/ai-adapters/openai.adapter");
// Mock OpenAIAdapter
jest.mock('../../../../services/translation/ai-adapters/openai.adapter');
describe('AIServiceFactory', () => {
    let factory;
    beforeEach(() => {
        // 重置单例
        ai_service_factory_1.AIServiceFactory.instance = undefined;
        factory = ai_service_factory_1.AIServiceFactory.getInstance();
    });
    describe('getInstance', () => {
        it('should return the same instance', () => {
            const instance1 = ai_service_factory_1.AIServiceFactory.getInstance();
            const instance2 = ai_service_factory_1.AIServiceFactory.getInstance();
            expect(instance1).toBe(instance2);
        });
    });
    describe('createAdapter', () => {
        const mockConfig = {
            provider: ai_service_types_1.AIProvider.OPENAI,
            apiKey: 'test-api-key',
            model: 'gpt-4'
        };
        it('should create OpenAI adapter', () => {
            const adapter = factory.createAdapter(mockConfig);
            expect(adapter).toBeInstanceOf(openai_adapter_1.OpenAIAdapter);
            expect(openai_adapter_1.OpenAIAdapter).toHaveBeenCalledWith(mockConfig);
        });
        it('should reuse existing adapter instance', () => {
            const adapter1 = factory.createAdapter(mockConfig);
            const adapter2 = factory.createAdapter(mockConfig);
            expect(adapter1).toBe(adapter2);
        });
        it('should throw error for unsupported provider', () => {
            const invalidConfig = {
                ...mockConfig,
                provider: 'invalid-provider'
            };
            expect(() => factory.createAdapter(invalidConfig))
                .toThrow('Unsupported AI provider: invalid-provider');
        });
    });
    describe('removeAdapter', () => {
        const mockConfig = {
            provider: ai_service_types_1.AIProvider.OPENAI,
            apiKey: 'test-api-key',
            model: 'gpt-4'
        };
        it('should remove adapter and allow creating new instance', () => {
            // 创建适配器
            const adapter1 = factory.createAdapter(mockConfig);
            // 移除适配器
            factory.removeAdapter(ai_service_types_1.AIProvider.OPENAI);
            // 创建新的适配器
            const adapter2 = factory.createAdapter(mockConfig);
            // 验证是不同的实例
            expect(adapter1).not.toBe(adapter2);
        });
    });
    describe('getAdapter', () => {
        const mockConfig = {
            provider: ai_service_types_1.AIProvider.OPENAI,
            apiKey: 'test-api-key',
            model: 'gpt-4'
        };
        it('should return undefined for non-existent adapter', () => {
            const adapter = factory.getAdapter(ai_service_types_1.AIProvider.OPENAI);
            expect(adapter).toBeUndefined();
        });
        it('should return existing adapter', () => {
            const createdAdapter = factory.createAdapter(mockConfig);
            const retrievedAdapter = factory.getAdapter(ai_service_types_1.AIProvider.OPENAI);
            expect(retrievedAdapter).toBe(createdAdapter);
        });
    });
});
