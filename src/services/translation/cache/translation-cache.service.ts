import { CacheConfig } from './cache-config.interface';
import { CacheStrategy, CacheEntry, CacheStats } from './cache-strategy.interface';
import { CacheKey } from './cache-keys.enum';
import logger from '../../../utils/logger';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

export class TranslationCacheService implements CacheStrategy {
  private cache: Map<string, CacheEntry<any>> = new Map();
  public config: CacheConfig;
  public stats: CacheStats;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: CacheConfig) {
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

  private initialize(): void {
    if (this.config.enablePersistence) {
      this.loadPersistedCache();
    }
  }

  private startCleanupInterval(): void {
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

  async get<T>(key: string): Promise<T | null> {
    return this.getSync<T>(key);
  }

  getSync<T>(key: string): T | null {
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

    return entry.value as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.setSync(key, value);
  }

  setSync<T>(key: string, value: T): void {
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

  async delete(key: string): Promise<void> {
    this.deleteSync(key);
  }

  deleteSync(key: string): void {
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

  async clear(): Promise<void> {
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

  async has(key: string): Promise<boolean> {
    return this.hasSync(key);
  }

  hasSync(key: string): boolean {
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

  getStats(): CacheStats {
    return { ...this.stats };
  }

  async cleanup(): Promise<void> {
    this.cleanupSync();
  }

  cleanupSync(): void {
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
        const [key] = entries.shift()!;
        const entry = this.cache.get(key);
        if (entry) {
          this.cache.delete(key);
          this.stats.totalSize -= entry.size;
          this.stats.itemCount--;
        }
      }
    }
  }

  getSize(): number {
    return this.stats.totalSize;
  }

  shouldCleanup(): boolean {
    if (this.config.enableMemoryLimit && this.stats.totalSize > this.config.maxMemoryUsage!) {
      return true;
    }
    return this.stats.itemCount > this.config.maxSize;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() >= entry.expires;
  }

  private compressValue<T>(value: T): T {
    if (!this.config.enableCompression) {
      return value;
    }

    const serialized = JSON.stringify(value);
    if (serialized.length > this.config.compressionThreshold!) {
      const compressed = zlib.gzipSync(serialized);
      return compressed as any;
    }

    return value;
  }

  private decompressValue<T>(value: T): T {
    if (!this.config.enableCompression) {
      return value;
    }

    if (Buffer.isBuffer(value)) {
      const decompressed = zlib.gunzipSync(value);
      return JSON.parse(decompressed.toString());
    }

    return value;
  }

  private calculateSize(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }
    return JSON.stringify(value).length;
  }

  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private persistCache(): void {
    if (!this.config.enablePersistence || !this.config.persistencePath) {
      return;
    }

    try {
      const cacheData = Array.from(this.cache.entries());
      fs.writeFileSync(
        path.join(this.config.persistencePath, 'translation-cache.json'),
        JSON.stringify(cacheData, null, 2)
      );
    } catch (error) {
      logger.error('Failed to persist cache:', error);
    }
  }

  private loadPersistedCache(): void {
    if (!this.config.enablePersistence || !this.config.persistencePath) {
      return;
    }

    try {
      const filePath = path.join(this.config.persistencePath, 'translation-cache.json');
      if (fs.existsSync(filePath)) {
        const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.cache = new Map(cacheData);
        
        // 重新计算统计信息
        this.stats.itemCount = this.cache.size;
        this.stats.totalSize = Array.from(this.cache.values())
          .reduce((sum, entry) => sum + this.calculateSize(entry.value), 0);
      }
    } catch (error) {
      logger.error('Failed to load persisted cache:', error);
    }
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.config.enablePersistence) {
      this.persistCache();
    }
    
    // 确保等待所有异步操作完成
    await new Promise<void>(resolve => {
      setImmediate(() => {
        resolve();
      });
    });
  }
} 