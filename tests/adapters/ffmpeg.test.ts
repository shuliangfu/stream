/**
 * @fileoverview FFmpeg 适配器测试
 */

import { describe, expect, it } from "@dreamer/test";
import { FFmpegAdapter } from "../../src/adapters/ffmpeg.ts";

describe("FFmpegAdapter", () => {
  it("应该创建适配器实例", () => {
    const adapter = new FFmpegAdapter({
      host: "localhost",
      port: 1935,
      app: "live",
    });

    expect(adapter.name).toBe("ffmpeg");
  });

  it("应该创建流", async () => {
    const adapter = new FFmpegAdapter();
    const stream = await adapter.createStream({
      name: "测试流",
      protocol: "rtmp",
    });

    expect(typeof stream.id).toBe("string");
    expect(stream.name).toBe("测试流");
    expect(stream.protocol).toBe("rtmp");
    expect(stream.status).toBe("idle");
  });

  it("应该获取流", async () => {
    const adapter = new FFmpegAdapter();
    const created = await adapter.createStream({
      name: "测试流",
      protocol: "rtmp",
    });

    const retrieved = await adapter.getStream(created.id);
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.name).toBe("测试流");
  });

  it("应该返回 null 当流不存在时", async () => {
    const adapter = new FFmpegAdapter();
    const stream = await adapter.getStream("non-existent");
    expect(stream).toBeNull();
  });

  it("应该删除流", async () => {
    const adapter = new FFmpegAdapter();
    const stream = await adapter.createStream({
      name: "测试流",
      protocol: "rtmp",
    });

    await adapter.deleteStream(stream.id);
    const retrieved = await adapter.getStream(stream.id);
    expect(retrieved).toBeNull();
  });

  it("应该处理删除不存在的流", async () => {
    const adapter = new FFmpegAdapter();
    // FFmpegAdapter 的 deleteStream 可能不会抛出错误，只是简单删除
    // 这里测试删除操作不会抛出错误
    await adapter.deleteStream("non-existent");
    // 验证流确实不存在
    const stream = await adapter.getStream("non-existent");
    expect(stream).toBeNull();
  });

  it("应该列出所有流", async () => {
    const adapter = new FFmpegAdapter();

    await adapter.createStream({ name: "流1", protocol: "rtmp" });
    await adapter.createStream({ name: "流2", protocol: "rtmp" });

    const streams = await adapter.listStreams();
    expect(streams.length >= 2).toBe(true);
  });

  it("应该支持分页列出流", async () => {
    const adapter = new FFmpegAdapter();

    await adapter.createStream({ name: "流1", protocol: "rtmp" });
    await adapter.createStream({ name: "流2", protocol: "rtmp" });
    await adapter.createStream({ name: "流3", protocol: "rtmp" });

    const streams = await adapter.listStreams({ limit: 2, offset: 0 });
    expect(streams.length <= 2).toBe(true);
  });

  it("应该获取统计信息", async () => {
    const adapter = new FFmpegAdapter();
    const stream = await adapter.createStream({
      name: "测试流",
      protocol: "rtmp",
    });

    const stats = await adapter.getStatistics(stream.id);
    expect(stats.streamId).toBe(stream.id);
    expect(typeof stats.uptime).toBe("number");
    expect(typeof stats.bitrate).toBe("number");
  });

  it("应该支持清理操作", () => {
    const adapter = new FFmpegAdapter();
    // cleanup 方法应该存在且不抛出错误
    adapter.cleanup();
    expect(adapter.name).toBe("ffmpeg");
  });
});
