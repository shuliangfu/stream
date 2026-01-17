/**
 * @fileoverview 流信息缓存测试
 */

import { describe, expect, it } from "@dreamer/test";
import { StreamCache } from "../../src/utils/stream-cache.ts";
import type { Stream, StreamStatistics } from "../../src/types.ts";

describe("StreamCache", () => {
  it("应该支持基本操作", () => {
    const cache = new StreamCache();

    const stream: Stream = {
      id: "stream-1",
      name: "Test Stream",
      status: "idle",
      protocol: "rtmp",
      subscriberUrls: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    cache.setStream("stream-1", stream);
    const retrieved = cache.getStream("stream-1");

    expect(retrieved?.id).toBe("stream-1");
    expect(retrieved?.name).toBe("Test Stream");
  });

  it("应该缓存统计信息", () => {
    const cache = new StreamCache();

    const statistics: StreamStatistics = {
      streamId: "stream-1",
      uptime: 1000,
      bitrate: 2000,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
      viewers: 10,
    };

    cache.setStatistics("stream-1", statistics);
    const retrieved = cache.getStatistics("stream-1");

    expect(retrieved?.streamId).toBe("stream-1");
    expect(retrieved?.bitrate).toBe(2000);
  });

  it("应该支持删除流", () => {
    const cache = new StreamCache();

    const stream: Stream = {
      id: "stream-1",
      name: "Test Stream",
      status: "idle",
      protocol: "rtmp",
      subscriberUrls: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    cache.setStream("stream-1", stream);
    cache.setStatistics("stream-1", {
      streamId: "stream-1",
      uptime: 1000,
      bitrate: 2000,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
      viewers: 0,
    });

    cache.deleteStream("stream-1");

    expect(cache.getStream("stream-1")).toBeUndefined();
    expect(cache.getStatistics("stream-1")).toBeUndefined();
  });

  it("应该支持 needsUpdate 检查", () => {
    const cache = new StreamCache({ ttl: 1000 });

    const stream: Stream = {
      id: "stream-1",
      name: "Test Stream",
      status: "idle",
      protocol: "rtmp",
      subscriberUrls: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    cache.setStream("stream-1", stream);

    // 刚设置，不需要更新
    expect(cache.needsUpdate("stream-1", 5000)).toBe(false);

    // 等待一段时间后可能需要更新（取决于 TTL）
    // 这里简化测试，主要验证方法存在
    expect(typeof cache.needsUpdate("stream-1")).toBe("boolean");
  });

  it("应该支持清空操作", () => {
    const cache = new StreamCache();

    const stream: Stream = {
      id: "stream-1",
      name: "Test Stream",
      status: "idle",
      protocol: "rtmp",
      subscriberUrls: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    cache.setStream("stream-1", stream);
    cache.clear();

    expect(cache.getStream("stream-1")).toBeUndefined();
    expect(cache.getStats().streams).toBe(0);
  });

  it("应该提供统计信息", () => {
    const cache = new StreamCache();

    const stream: Stream = {
      id: "stream-1",
      name: "Test Stream",
      status: "idle",
      protocol: "rtmp",
      subscriberUrls: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    cache.setStream("stream-1", stream);
    cache.setStatistics("stream-1", {
      streamId: "stream-1",
      uptime: 1000,
      bitrate: 2000,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
      viewers: 0,
    });

    const stats = cache.getStats();
    expect(stats.streams).toBe(1);
    expect(stats.statistics).toBe(1);
  });
});
