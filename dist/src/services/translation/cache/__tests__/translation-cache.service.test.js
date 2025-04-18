"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const translation_cache_service_1 = require("../translation-cache.service");
// 告诉Jest使用假定时器
jest.useFakeTimers();
describe('TranslationCacheService', () => {
    let cacheService;
    const testConfig = {
        ttl: 600, // 600 seconds
        maxSize: 3,
        cleanupInterval: 0, // disable auto cleanup for testing
        enablePersistence: false
    };
    beforeEach(() => {
        cacheService = new translation_cache_service_1.TranslationCacheService(testConfig);
    });
    afterEach(() => {
        // Use sync cleanup for tests to avoid timeout issues
        if (cacheService) {
            cacheService.clear();
        }
    });
    describe('Get and Set', () => {
        test('should store and retrieve value', () => {
            const key = 'test-key';
            const value = { test: 'value' };
            // 使用同步方法而不是异步方法
            cacheService.setSync(key, value);
            const result = cacheService.getSync(key);
            expect(result).toEqual(value);
        });
        test('should return null for non-existent key', () => {
            const result = cacheService.getSync('non-existent');
            expect(result).toBeNull();
        });
        test('should handle expired values', () => {
            const key = 'expired-key';
            const value = { test: 'value' };
            // 创建一个配置，TTL设置为0，使值立即过期
            const expiredConfig = {
                ...testConfig,
                ttl: 0
            };
            const expiredCache = new translation_cache_service_1.TranslationCacheService(expiredConfig);
            // 设置值
            expiredCache.setSync(key, value);
            // 值应该立即过期
            const result = expiredCache.getSync(key);
            expect(result).toBeNull();
        });
    });
    describe('Delete and Clear', () => {
        test('should delete a specific key', () => {
            const key1 = 'key1';
            const key2 = 'key2';
            cacheService.setSync(key1, 'value1');
            cacheService.setSync(key2, 'value2');
            cacheService.deleteSync(key1);
            expect(cacheService.getSync(key1)).toBeNull();
            expect(cacheService.getSync(key2)).toBe('value2');
        });
        test('should clear all keys', () => {
            cacheService.setSync('key1', 'value1');
            cacheService.setSync('key2', 'value2');
            // 使用同步方法清除
            cacheService.clear();
            expect(cacheService.getSync('key1')).toBeNull();
            expect(cacheService.getSync('key2')).toBeNull();
            expect(cacheService.getStats().itemCount).toBe(0);
        });
    });
    describe('Has', () => {
        test('should check if key exists', () => {
            const key = 'test-key';
            cacheService.setSync(key, 'value');
            const exists = cacheService.hasSync(key);
            expect(exists).toBe(true);
            const notExists = cacheService.hasSync('non-existent');
            expect(notExists).toBe(false);
        });
        test('expired keys should return false', () => {
            const key = 'expired-key';
            // 创建一个配置，TTL设置为0，使值立即过期
            const expiredConfig = {
                ...testConfig,
                ttl: 0
            };
            const expiredCache = new translation_cache_service_1.TranslationCacheService(expiredConfig);
            expiredCache.setSync(key, 'value');
            const exists = expiredCache.hasSync(key);
            expect(exists).toBe(false);
        });
    });
    describe('Cleanup', () => {
        test('should remove expired entries', () => {
            const expiredConfig = {
                ...testConfig,
                ttl: 0 // 立即过期
            };
            const expiredCache = new translation_cache_service_1.TranslationCacheService(expiredConfig);
            expiredCache.setSync('key1', 'value1');
            expiredCache.setSync('key2', 'value2');
            // 清理过期条目
            expiredCache.cleanupSync();
            expect(expiredCache.hasSync('key1')).toBe(false);
            expect(expiredCache.hasSync('key2')).toBe(false);
        });
        test('should respect max size limit', () => {
            // 设置最大大小为2
            const limitedConfig = {
                ...testConfig,
                maxSize: 2
            };
            const limitedCache = new translation_cache_service_1.TranslationCacheService(limitedConfig);
            limitedCache.setSync('key1', 'value1');
            limitedCache.setSync('key2', 'value2');
            limitedCache.setSync('key3', 'value3'); // 这应该触发清理
            // 手动调用cleanupSync确保清理已执行
            limitedCache.cleanupSync();
            expect(limitedCache.getStats().itemCount).toBeLessThanOrEqual(2);
        });
    });
    describe('Stats', () => {
        test('should track hits and misses', () => {
            cacheService.setSync('key1', 'value1');
            // 命中
            cacheService.getSync('key1');
            cacheService.getSync('key1');
            // 未命中
            cacheService.getSync('non-existent');
            const stats = cacheService.getStats();
            expect(stats.hits).toBe(2);
            expect(stats.misses).toBe(1);
        });
        test('should calculate hit rate', () => {
            cacheService.setSync('key1', 'value1');
            // 2次命中，1次未命中
            cacheService.getSync('key1');
            cacheService.getSync('key1');
            cacheService.getSync('non-existent');
            const stats = cacheService.getStats();
            expect(stats.hitRate).toBe(2 / 3); // 2 / (2+1)
        });
    });
});
