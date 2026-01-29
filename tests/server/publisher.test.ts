/**
 * @fileoverview 服务端推流器单元测试
 */

import { assertRejects, describe, expect, it } from "@dreamer/test";
import { ServerPublisher } from "../../src/server/publisher.ts";

/** 用于测试的 mock Socket.io Server（避免真实启动端口；需具备 of、listen、on） */
function createMockIo() {
  return {
    of: () => ({ emit: () => {} }),
    listen: () => Promise.resolve(),
    on: () => {},
  };
}

describe("ServerPublisher", () => {
  it("应该创建推流器实例", () => {
    const publisher = new ServerPublisher({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    expect(publisher.streamId).toBe("stream-1");
    expect(publisher.status).toBe("idle");
  });

  it("应该在未连接时 getStatistics 返回默认统计", () => {
    const publisher = new ServerPublisher({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    const stats = publisher.getStatistics();
    expect(stats.streamId).toBe("stream-1");
    expect(stats.status).toBe("idle");
    expect(typeof stats.uptime).toBe("number");
  });

  it("应该 connect 后状态变为 connected", async () => {
    const publisher = new ServerPublisher({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    await publisher.connect("rtmp://localhost:1935/live/stream-1");
    expect(publisher.status).toBe("connected");
  });

  it("未连接时 publish 应抛出状态错误", async () => {
    const publisher = new ServerPublisher({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    await assertRejects(() => publisher.publish("/tmp/video.mp4"));
  });

  it("重复 connect 应抛出状态错误", async () => {
    const publisher = new ServerPublisher({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    await publisher.connect("rtmp://localhost:1935/live/stream-1");
    await assertRejects(
      () => publisher.connect("rtmp://localhost:1935/live/stream-1"),
      Error,
      "推流器状态错误",
    );
  });

  it("应该支持 on/off 事件监听", async () => {
    const publisher = new ServerPublisher({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    let connected = false;
    publisher.on("connected", () => {
      connected = true;
    });
    await publisher.connect("rtmp://localhost:1935/live/stream-1");
    expect(connected).toBe(true);
    if (publisher.removeAllListeners) {
      publisher.removeAllListeners();
    }
  });

  it("getHlsPlaylistPath 在未进行 HLS 推流时返回 undefined", () => {
    const publisher = new ServerPublisher({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    expect(publisher.getHlsPlaylistPath()).toBeUndefined();
  });

  it("connect 后 getHlsPlaylistPath 在 RTMP 推流前仍为 undefined", async () => {
    const publisher = new ServerPublisher({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    await publisher.connect("rtmp://localhost:1935/live/stream-1");
    expect(publisher.getHlsPlaylistPath()).toBeUndefined();
  });

  it("publish 时使用 WebRTC URL 应抛出明确错误", async () => {
    const publisher = new ServerPublisher({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    await publisher.connect("https://example.com/webrtc/stream");
    await assertRejects(
      () => publisher.publish("/tmp/video.mp4"),
      Error,
      "WebRTC 推流需要信令服务器支持",
    );
  });

  it("publish 时使用非 Blob/非 string 媒体源应抛出明确错误", async () => {
    const publisher = new ServerPublisher({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    await publisher.connect("rtmp://localhost:1935/live/stream-1");
    const mediaStreamLike = { getTracks: () => [] };
    await assertRejects(
      () => publisher.publish(mediaStreamLike as unknown as Blob),
      Error,
      "服务端推流仅支持文件路径、Blob、File",
    );
  });
});
