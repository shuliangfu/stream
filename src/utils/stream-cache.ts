/**
 * @fileoverview 流信息缓存
 *
 * 提供流信息、统计信息的缓存功能
 */

import type { Stream, StreamStatistics } from "../types.ts";
import { LRUCache } from "./cache.ts";

/**
 * 流信息缓存选项
 */
export interface StreamCacheOptions {
  /** 最大缓存大小（默认：100） */
  maxSize?: number;
  /** 缓存过期时间（毫秒，默认：30000） */
  ttl?: number;
}

/**
 * 流信息缓存
 *
 * 缓存流信息和统计信息，减少重复查询
 */
export class StreamCache {
  private streamCache: LRUCache<string, Stream>;
  private statisticsCache: LRUCache<string, StreamStatistics>;
  private lastUpdateTime: Map<string, number> = new Map();

  constructor(options: StreamCacheOptions = {}) {
    const maxSize = options.maxSize ?? 100;
    const ttl = options.ttl ?? 30000;

    this.streamCache = new LRUCache<string, Stream>({ maxSize, ttl });
    this.statisticsCache = new LRUCache<string, StreamStatistics>({
      maxSize,
      ttl: ttl / 2, // 统计信息缓存时间更短
    });
  }

  /**
   * 获取流信息（从缓存）
   *
   * @param streamId 流 ID
   * @returns 流信息，如果不存在返回 undefined
   */
  getStream(streamId: string): Stream | undefined {
    return this.streamCache.get(streamId);
  }

  /**
   * 设置流信息（到缓存）
   *
   * @param streamId 流 ID
   * @param stream 流信息
   */
  setStream(streamId: string, stream: Stream): void {
    this.streamCache.set(streamId, stream);
    this.lastUpdateTime.set(streamId, Date.now());
  }

  /**
   * 删除流信息（从缓存）
   *
   * @param streamId 流 ID
   */
  deleteStream(streamId: string): void {
    this.streamCache.delete(streamId);
    this.statisticsCache.delete(streamId);
    this.lastUpdateTime.delete(streamId);
  }

  /**
   * 获取统计信息（从缓存）
   *
   * @param streamId 流 ID
   * @returns 统计信息，如果不存在返回 undefined
   */
  getStatistics(streamId: string): StreamStatistics | undefined {
    return this.statisticsCache.get(streamId);
  }

  /**
   * 设置统计信息（到缓存）
   *
   * @param streamId 流 ID
   * @param statistics 统计信息
   */
  setStatistics(streamId: string, statistics: StreamStatistics): void {
    this.statisticsCache.set(streamId, statistics);
  }

  /**
   * 检查流信息是否需要更新
   *
   * @param streamId 流 ID
   * @param maxAge 最大年龄（毫秒，默认：30000）
   * @returns 是否需要更新
   */
  needsUpdate(streamId: string, maxAge?: number): boolean {
    const lastUpdate = this.lastUpdateTime.get(streamId);
    if (!lastUpdate) {
      return true;
    }

    const age = Date.now() - lastUpdate;
    return age > (maxAge ?? 30000);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.streamCache.clear();
    this.statisticsCache.clear();
    this.lastUpdateTime.clear();
  }

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    // LRUCache 会自动清理过期项
    // 这里可以添加额外的清理逻辑
    this.streamCache.cleanup();
    this.statisticsCache.cleanup();
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    streams: number;
    statistics: number;
  } {
    return {
      streams: this.streamCache.size,
      statistics: this.statisticsCache.size,
    };
  }
}
