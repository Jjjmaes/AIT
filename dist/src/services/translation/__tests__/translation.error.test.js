"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const translation_service_1 = require("../translation.service");
const ai_service_types_1 = require("../../../types/ai-service.types");
const ai_service_factory_1 = require("../ai-adapters/ai-service.factory");
const translation_cache_service_1 = require("../cache/translation-cache.service");
jest.mock("../ai-adapters/ai-service.factory");
jest.mock("../cache/translation-cache.service");
jest.mock("../monitoring/performance-monitor", () => {
    return {
        PerformanceMonitor: jest.fn().mockImplementation(() => {
            return {
                recordRequest: jest.fn(),
                recordCacheAccess: jest.fn(),
                recordTaskCompletion: jest.fn(),
            };
        })
    };
});
describe("TranslationService Error Handling", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it("should handle translation errors", async () => {
        const errorAdapter = {
            translateText: jest.fn().mockRejectedValue(new Error("Translation failed")),
            validateApiKey: jest.fn().mockResolvedValue(true),
            getAvailableModels: jest.fn().mockResolvedValue([]),
            getModelInfo: jest.fn().mockResolvedValue({}),
            getPricing: jest.fn().mockResolvedValue({})
        };
        ai_service_factory_1.AIServiceFactory.getInstance.mockReturnValue({
            createAdapter: jest.fn().mockReturnValue(errorAdapter)
        });
        const mockCacheService = {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(true),
            delete: jest.fn().mockResolvedValue(true),
            clear: jest.fn().mockResolvedValue(true),
            has: jest.fn().mockResolvedValue(false)
        };
        translation_cache_service_1.TranslationCacheService.mockImplementation(() => mockCacheService);
        const errorService = new translation_service_1.TranslationService({
            provider: ai_service_types_1.AIProvider.OPENAI,
            model: 'test-model',
            apiKey: 'test-api-key',
            enableCache: true,
            cacheConfig: {
                ttl: 3600,
                maxSize: 100,
                cleanupInterval: 300
            }
        });
        await expect(errorService.translateText('Hola', {
            sourceLanguage: 'es',
            targetLanguage: 'en'
        })).rejects.toThrow('Translation failed');
    });
    it("should handle API key validation errors", async () => {
        const errorAdapter = {
            translateText: jest.fn(),
            validateApiKey: jest.fn().mockRejectedValue(new Error("Invalid API key")),
            getAvailableModels: jest.fn().mockResolvedValue([]),
            getModelInfo: jest.fn().mockResolvedValue({}),
            getPricing: jest.fn().mockResolvedValue({})
        };
        ai_service_factory_1.AIServiceFactory.getInstance.mockReturnValue({
            createAdapter: jest.fn().mockReturnValue(errorAdapter)
        });
        const mockCacheService = {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(true),
            delete: jest.fn().mockResolvedValue(true),
            clear: jest.fn().mockResolvedValue(true),
            has: jest.fn().mockResolvedValue(false)
        };
        translation_cache_service_1.TranslationCacheService.mockImplementation(() => mockCacheService);
        const errorService = new translation_service_1.TranslationService({
            provider: ai_service_types_1.AIProvider.OPENAI,
            model: 'test-model',
            apiKey: 'invalid-api-key',
            enableCache: true,
            cacheConfig: {
                ttl: 3600,
                maxSize: 100,
                cleanupInterval: 300
            }
        });
        const result = await errorService.validateApiKey();
        expect(result).toBe(false);
        expect(errorAdapter.validateApiKey).toHaveBeenCalled();
    });
    it("should handle getAvailableModels failure", async () => {
        const mockError = new Error("Model list retrieval failed");
        const mockAdapter = { getAvailableModels: jest.fn().mockRejectedValue(mockError) };
        ai_service_factory_1.AIServiceFactory.getInstance.mockReturnValue({
            createAdapter: jest.fn().mockReturnValue(mockAdapter)
        });
        const errorService = new translation_service_1.TranslationService({
            provider: ai_service_types_1.AIProvider.OPENAI,
            model: 'test-model',
            apiKey: 'test-api-key',
            enableCache: true,
            cacheConfig: {
                ttl: 3600,
                maxSize: 100,
                cleanupInterval: 300
            }
        });
        await expect(errorService.getAvailableModels()).rejects.toThrow("Model list retrieval failed");
    });
});
