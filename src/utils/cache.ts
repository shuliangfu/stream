/**
 * @fileoverview 缓存工具
 *
 * 提供 LRU 缓存和 TTL 缓存功能
 */

/**
 * 缓存选项
 */
export interface CacheOptions {
  /** 最大缓存大小（默认：100） */
  maxSize?: number;
  /** 过期时间（毫秒，默认：无过期） */
  ttl?: number;
}

/**
 * 缓存项
 */
interface CacheItem<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

/**
 * LRU 缓存实现
 *
 * 特性：
 * - 最近最少使用（LRU）淘汰策略
 * - 可选的 TTL 过期机制
 * - 访问计数统计
 */
export class LRUCache<K, V> {
  private cache: Map<K, CacheItem<V>> = new Map();
  private readonly maxSize: number;
  private readonly ttl?: number;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.ttl = options.ttl;
  }

  /**
   * 获取缓存值
   *
   * @param key 键
   * @returns 值，如果不存在或已过期返回 undefined
   */
  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) {
      return undefined;
    }

    // 检查是否过期
    if (this.ttl && Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // 更新访问信息
    item.accessCount++;
    // 移动到末尾（LRU）
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.value;
  }

  /**
   * 设置缓存值
   *
   * @param key 键
   * @param value 值
   */
  set(key: K, value: V): void {
    // 如果已存在，更新
    if (this.cache.has(key)) {
      const item = this.cache.get(key)!;
      item.value = value;
      item.timestamp = Date.now();
      item.accessCount++;
      // 移动到末尾
      this.cache.delete(key);
      this.cache.set(key, item);
      return;
    }

    // 如果缓存已满，删除最久未使用的项
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    // 添加新项
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 1,
    });
  }

  /**
   * 删除缓存项
   *
   * @param key 键
   */
  delete(key: K): void {
    this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 检查是否包含键
   *
   * @param key 键
   */
  has(key: K): boolean {
    const item = this.cache.get(key);
    if (!item) {
      return false;
    }

    // 检查是否过期
    if (this.ttl && Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 清理过期项
   */
  cleanup(): number {
    if (!this.ttl) {
      return 0;
    }

    let cleaned = 0;
    const now = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}
