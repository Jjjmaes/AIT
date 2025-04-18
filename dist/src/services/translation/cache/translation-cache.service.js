"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationCacheService = void 0;
const logger_1 = __importDefault(require("../../../utils/logger"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const zlib_1 = __importDefault(require("zlib"));
class TranslationCacheService {
    constructor(config) {
        this.cache = new Map();
        this.cleanupInterval = null;
        this.config = config;
        this.cache = new Map();
        this.stats = {
            itemCount: 0,
            hits: 0,
            misses: 0,
            totalSize: 0,
            hitRate: 0
        };
        this.initialize();
        // 仅当cleanupInterval > 0时才启动定时清理
        if (config.cleanupInterval > 0) {
            this.startCleanupInterval();
        }
    }
    initialize() {
        if (this.config.enablePersistence) {
            this.loadPersistedCache();
        }
    }
    startCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        if (this.config.cleanupInterval > 0) {
            this.cleanupInterval = setInterval(() => {
                this.cleanup();
            }, this.config.cleanupInterval);
        }
    }
    async get(key) {
        return this.getSync(key);
    }
    getSync(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            this.updateStats();
            return null;
        }
        // 检查是否过期
        const now = Date.now();
        if (now >= entry.expires) {
            // 立即删除过期条目
            this.cache.delete(key);
            this.stats.misses++;
            this.updateStats();
            return null;
        }
        entry.lastAccessed = now;
        entry.accessCount++;
        this.stats.hits++;
        this.updateStats();
        return entry.value;
    }
    async set(key, value) {
        this.setSync(key, value);
    }
    setSync(key, value) {
        if (this.cache.size >= this.config.maxSize) {
            this.cleanupSync();
        }
        const size = this.calculateSize(value);
        const now = Date.now();
        const expires = now + (this.config.ttl * 1000);
        this.cache.set(key, {
            value,
            expires: expires,
            createdAt: now,
            lastAccessed: now,
            accessCount: 0,
            size
        });
        this.stats.itemCount++;
        this.stats.totalSize += size;
        if (this.config.enablePersistence) {
            this.persistCache();
        }
    }
    async delete(key) {
        this.deleteSync(key);
    }
    deleteSync(key) {
        const entry = this.cache.get(key);
        if (entry) {
            this.stats.totalSize -= entry.size;
            this.stats.itemCount--;
            this.cache.delete(key);
            this.updateStats();
            if (this.config.enablePersistence) {
                this.persistCache();
            }
        }
    }
    async clear() {
        this.cache.clear();
        this.stats = {
            itemCount: 0,
            hits: 0,
            misses: 0,
            totalSize: 0,
            hitRate: 0
        };
        if (this.config.enablePersistence) {
            this.persistCache();
        }
    }
    async has(key) {
        return this.hasSync(key);
    }
    hasSync(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }
        // 检查是否过期
        const now = Date.now();
        if (now >= entry.expires) {
            // 立即删除过期条目
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    getStats() {
        return { ...this.stats };
    }
    async cleanup() {
        this.cleanupSync();
    }
    cleanupSync() {
        const now = Date.now();
        const expiredKeys = [];
        // 找出所有过期的key
        for (const [key, entry] of this.cache.entries()) {
            if (now >= entry.expires) {
                expiredKeys.push(key);
            }
        }
        // 删除过期的key
        for (const key of expiredKeys) {
            const entry = this.cache.get(key);
            if (entry) {
                this.cache.delete(key);
                this.stats.totalSize -= entry.size;
                this.stats.itemCount--;
            }
        }
        // 如果缓存大小仍超过限制，删除最旧的条目
        if (this.cache.size > this.config.maxSize) {
            const entries = Array.from(this.cache.entries())
                .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
            while (this.cache.size > this.config.maxSize && entries.length > 0) {
                const [key] = entries.shift();
                const entry = this.cache.get(key);
                if (entry) {
                    this.cache.delete(key);
                    this.stats.totalSize -= entry.size;
                    this.stats.itemCount--;
                }
            }
        }
    }
    getSize() {
        return this.stats.totalSize;
    }
    shouldCleanup() {
        if (this.config.enableMemoryLimit && this.stats.totalSize > this.config.maxMemoryUsage) {
            return true;
        }
        return this.stats.itemCount > this.config.maxSize;
    }
    isExpired(entry) {
        return Date.now() >= entry.expires;
    }
    compressValue(value) {
        if (!this.config.enableCompression) {
            return value;
        }
        const serialized = JSON.stringify(value);
        if (serialized.length > this.config.compressionThreshold) {
            const compressed = zlib_1.default.gzipSync(serialized);
            return compressed;
        }
        return value;
    }
    decompressValue(value) {
        if (!this.config.enableCompression) {
            return value;
        }
        if (Buffer.isBuffer(value)) {
            const decompressed = zlib_1.default.gunzipSync(value);
            return JSON.parse(decompressed.toString());
        }
        return value;
    }
    calculateSize(value) {
        if (value === null || value === undefined) {
            return 0;
        }
        return JSON.stringify(value).length;
    }
    updateStats() {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    }
    persistCache() {
        if (!this.config.enablePersistence || !this.config.persistencePath) {
            return;
        }
        try {
            const cacheData = Array.from(this.cache.entries());
            fs_1.default.writeFileSync(path_1.default.join(this.config.persistencePath, 'translation-cache.json'), JSON.stringify(cacheData, null, 2));
        }
        catch (error) {
            logger_1.default.error('Failed to persist cache:', error);
        }
    }
    loadPersistedCache() {
        if (!this.config.enablePersistence || !this.config.persistencePath) {
            return;
        }
        try {
            const filePath = path_1.default.join(this.config.persistencePath, 'translation-cache.json');
            if (fs_1.default.existsSync(filePath)) {
                const cacheData = JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
                this.cache = new Map(cacheData);
                // 重新计算统计信息
                this.stats.itemCount = this.cache.size;
                this.stats.totalSize = Array.from(this.cache.values())
                    .reduce((sum, entry) => sum + this.calculateSize(entry.value), 0);
            }
        }
        catch (error) {
            logger_1.default.error('Failed to load persisted cache:', error);
        }
    }
    async shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        if (this.config.enablePersistence) {
            this.persistCache();
        }
        // 确保等待所有异步操作完成
        await new Promise(resolve => {
            setImmediate(() => {
                resolve();
            });
        });
    }
}
exports.TranslationCacheService = TranslationCacheService;
