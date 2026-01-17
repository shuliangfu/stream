/**
 * @fileoverview 流管理器测试
 */

import { describe, expect, it, assertRejects } from "@dreamer/test";
import { StreamManager } from "../src/manager.ts";

describe("StreamManager", () => {
  it("应该创建管理器实例", () => {
    const manager = new StreamManager({
      adapter: "ffmpeg",
      adapterConfig: {
        config: {
          host: "localhost",
          port: 1935,
        },
      },
    });

    expect(manager).toBeDefined();
  });

  it("应该创建流", async () => {
    const manager = new StreamManager({
      adapter: "ffmpeg",
    });

    const stream = await manager.createStream({
      name: "测试流",
      protocol: "rtmp",
    });

    expect(typeof stream.id).toBe("string");
    expect(stream.name).toBe("测试流");
  });

  it("应该获取流", async () => {
    const manager = new StreamManager({
      adapter: "ffmpeg",
    });

    const created = await manager.createStream({
      name: "测试流",
      protocol: "rtmp",
    });

    const retrieved = await manager.getStream(created.id);
    expect(retrieved?.id).toBe(created.id);
  });

  it("应该删除流", async () => {
    const manager = new StreamManager({
      adapter: "ffmpeg",
    });

    const stream = await manager.createStream({
      name: "测试流",
      protocol: "rtmp",
    });

    await manager.deleteStream(stream.id);
    const retrieved = await manager.getStream(stream.id);
    expect(retrieved).toBeNull();
  });

  it("应该列出所有流", async () => {
    const manager = new StreamManager({
      adapter: "ffmpeg",
    });

    await manager.createStream({ name: "流1", protocol: "rtmp" });
    await manager.createStream({ name: "流2", protocol: "rtmp" });

    const streams = await manager.listStreams();
    expect(streams.length >= 2).toBe(true);
  });

  it("应该创建房间", async () => {
    const manager = new StreamManager({
      adapter: "ffmpeg",
    });

    const room = await manager.createRoom({
      name: "测试房间",
      description: "这是一个测试房间",
    });

    expect(typeof room.id).toBe("string");
    expect(room.name).toBe("测试房间");
    expect(room.description).toBe("这是一个测试房间");
  });

  it("应该获取房间", async () => {
    const manager = new StreamManager({
      adapter: "ffmpeg",
    });

    const created = await manager.createRoom({
      name: "测试房间",
    });

    const retrieved = await manager.getRoom(created.id);
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.name).toBe("测试房间");
  });

  it("应该删除房间", async () => {
    const manager = new StreamManager({
      adapter: "ffmpeg",
    });

    const room = await manager.createRoom({
      name: "测试房间",
    });

    await manager.deleteRoom(room.id);
    const retrieved = await manager.getRoom(room.id);
    expect(retrieved).toBeNull();
  });

  it("应该列出所有房间", async () => {
    const manager = new StreamManager({
      adapter: "ffmpeg",
    });

    await manager.createRoom({ name: "房间1" });
    await manager.createRoom({ name: "房间2" });

    const rooms = await manager.listRooms();
    expect(rooms.length >= 2).toBe(true);
  });

  it("应该获取统计信息", async () => {
    const manager = new StreamManager({
      adapter: "ffmpeg",
    });

    const stream = await manager.createStream({
      name: "测试流",
      protocol: "rtmp",
    });

    const stats = await manager.getStatistics(stream.id);
    expect(stats.streamId).toBe(stream.id);
    expect(typeof stats.uptime).toBe("number");
  });

  it("应该对不支持的适配器类型抛出错误", async () => {
    await assertRejects(
      async () => {
        new StreamManager({
          adapter: "unsupported" as any,
        });
      },
      Error,
      "不支持的适配器类型",
    );
  });
});
