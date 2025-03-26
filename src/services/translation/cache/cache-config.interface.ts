export interface CacheConfig {
  /** 缓存过期时间（毫秒） */
  ttl: number;
  /** 最大缓存条目数 */
  maxSize: number;
  /** 清理间隔（毫秒） */
  cleanupInterval: number;
  /** 是否启用持久化 */
  enablePersistence?: boolean;
  /** 持久化路径 */
  persistencePath?: string;
  /** 是否启用压缩 */
  enableCompression?: boolean;
  /** 压缩阈值（字节） */
  compressionThreshold?: number;
  /** 是否启用内存限制 */
  enableMemoryLimit?: boolean;
  /** 最大内存使用量（字节） */
  maxMemoryUsage?: number;
} 