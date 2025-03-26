import { CacheConfig } from './cache-config.interface';

export interface CacheEntry<T> {
  /** 缓存值 */
  value: T;
  /** 过期时间 */
  expires: number;
  /** 创建时间 */
  createdAt: number;
  /** 最后访问时间 */
  lastAccessed: number;
  /** 访问次数 */
  accessCount: number;
  /** 大小（字节） */
  size: number;
}

export interface CacheStats {
  /** 当前缓存条目数 */
  itemCount: number;
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 总内存使用量（字节） */
  totalSize: number;
  /** 命中率 */
  hitRate: number;
}

export interface CacheStrategy {
  /** 缓存配置 */
  config: CacheConfig;
  /** 缓存统计信息 */
  stats: CacheStats;
  
  /** 获取缓存值 */
  get<T>(key: string): Promise<T | null>;
  
  /** 设置缓存值 */
  set<T>(key: string, value: T): Promise<void>;
  
  /** 删除缓存值 */
  delete(key: string): Promise<void>;
  
  /** 清空缓存 */
  clear(): Promise<void>;
  
  /** 检查键是否存在 */
  has(key: string): Promise<boolean>;
  
  /** 获取缓存统计信息 */
  getStats(): CacheStats;
  
  /** 清理过期缓存 */
  cleanup(): Promise<void>;
  
  /** 获取缓存大小 */
  getSize(): number;
  
  /** 检查是否需要清理 */
  shouldCleanup(): boolean;
  
  /** 关闭缓存 */
  shutdown(): Promise<void>;
} 