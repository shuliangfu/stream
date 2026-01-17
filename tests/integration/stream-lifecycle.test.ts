/**
 * @fileoverview 流生命周期集成测试
 */

import { describe, expect, it } from "@dreamer/test";
import { StreamManager } from "../../src/manager.ts";

describe("流生命周期", () => {
  it("应该完成流的完整生命周期", async () => {
    const manager = new StreamManager({
      adapter: "ffmpeg",
    });

    // 1. 创建流
    const stream = await manager.createStream({
      name: "生命周期测试流",
      protocol: "rtmp",
    });
    expect(stream.status).toBe("idle");

    // 2. 获取流
    const retrieved = await manager.getStream(stream.id);
    expect(retrieved?.id).toBe(stream.id);

    // 3. 获取统计信息
    const stats = await manager.getStatistics(stream.id);
    expect(stats.streamId).toBe(stream.id);

    // 4. 列出流
    const streams = await manager.listStreams();
    expect(streams.some((s) => s.id === stream.id)).toBe(true);

    // 5. 删除流
    await manager.deleteStream(stream.id);
    const deleted = await manager.getStream(stream.id);
    expect(deleted).toBeNull();
  });

  it("应该支持房间和流关联", async () => {
    const manager = new StreamManager({
      adapter: "ffmpeg",
    });

    // 创建房间
    const room = await manager.createRoom({
      name: "测试房间",
    });

    // 创建流并关联到房间
    const stream = await manager.createStream({
      name: "房间流",
      protocol: "rtmp",
      roomId: room.id,
    });

    expect(stream.roomId).toBe(room.id);

    // 清理
    await manager.deleteStream(stream.id);
    await manager.deleteRoom(room.id);
  });

  it("应该支持批量操作流", async () => {
    const manager = new StreamManager({
      adapter: "ffmpeg",
    });

    // 创建多个流
    const stream1 = await manager.createStream({
      name: "批量流1",
      protocol: "rtmp",
    });
    const stream2 = await manager.createStream({
      name: "批量流2",
      protocol: "rtmp",
    });
    const stream3 = await manager.createStream({
      name: "批量流3",
      protocol: "rtmp",
    });

    // 列出所有流
    const streams = await manager.listStreams();
    expect(streams.length >= 3).toBe(true);

    // 批量删除
    await manager.deleteStream(stream1.id);
    await manager.deleteStream(stream2.id);
    await manager.deleteStream(stream3.id);

    // 验证删除
    const remaining = await manager.listStreams();
    expect(
      remaining.some(
        (s) => s.id === stream1.id || s.id === stream2.id || s.id === stream3.id,
      ),
    ).toBe(false);
  });
});
