/**
 * @fileoverview 流管理器测试
 */

import { assertRejects, describe, expect, it } from "@dreamer/test";
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

  it("应该支持 nginx-rtmp 适配器（mock stat）", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(
          '<?xml version="1.0"?><rtmp><server><application><name>live</name><live><stream><name>test</name></stream></live></application></server></rtmp>',
          { status: 200 },
        ),
      );
    try {
      const manager = new StreamManager({
        adapter: "nginx-rtmp",
        adapterConfig: {
          config: {
            statUrl: "http://localhost:80/stat",
            host: "localhost",
            rtmpPort: 1935,
            httpPort: 80,
            app: "live",
          },
        },
      });
      const stream = await manager.createStream({
        name: "nginx-stream",
        protocol: "rtmp",
      });
      expect(stream.id).toBe("nginx-stream");
      expect(stream.publisherUrl).toContain("rtmp://");
      const retrieved = await manager.getStream(stream.id);
      expect(retrieved?.id).toBe("nginx-stream");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("应该支持 livekit 适配器（mock API）", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("CreateRoom")) {
        return Promise.resolve(
          new Response(JSON.stringify({ room: { name: "lk-room" } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url.includes("ListRooms")) {
        return Promise.resolve(
          new Response(JSON.stringify({ rooms: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    };
    try {
      const manager = new StreamManager({
        adapter: "livekit",
        adapterConfig: {
          config: {
            host: "http://localhost:7880",
            apiKey: "key",
            apiSecret: "secret",
          },
        },
      });
      const stream = await manager.createStream({
        name: "lk-room",
        protocol: "webrtc",
      });
      expect(stream.id).toBe("lk-room");
      expect(stream.protocol).toBe("webrtc");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("应该支持 listStreams 的 filter（name、roomId、status、protocol）", async () => {
    const manager = new StreamManager({ adapter: "ffmpeg" });
    await manager.createStream({ name: "流A", protocol: "rtmp", roomId: "r1" });
    await manager.createStream({ name: "流B", protocol: "rtmp", roomId: "r2" });
    await manager.createStream({ name: "流A", protocol: "rtmp", roomId: "r1" });

    const byName = await manager.listStreams({ filter: { name: "流A" } });
    expect(byName.length).toBe(2);
    expect(byName.every((s) => s.name === "流A")).toBe(true);

    const byRoomId = await manager.listStreams({ filter: { roomId: "r1" } });
    expect(byRoomId.length).toBe(2);
    expect(byRoomId.every((s) => s.roomId === "r1")).toBe(true);

    const byProtocol = await manager.listStreams({
      filter: { protocol: "rtmp" },
    });
    expect(byProtocol.length).toBe(3);
    expect(byProtocol.every((s) => s.protocol === "rtmp")).toBe(true);
  });

  it("应该支持 listRooms 的 filter（name、isPrivate）", async () => {
    const manager = new StreamManager({ adapter: "ffmpeg" });
    await manager.createRoom({ name: "公开房", isPrivate: false });
    await manager.createRoom({ name: "私密房", isPrivate: true });
    await manager.createRoom({ name: "公开房", isPrivate: false });

    const byName = await manager.listRooms({ filter: { name: "公开房" } });
    expect(byName.length).toBe(2);
    expect(byName.every((r) => r.name === "公开房")).toBe(true);

    const byPrivate = await manager.listRooms({ filter: { isPrivate: true } });
    expect(byPrivate.length).toBe(1);
    expect(byPrivate[0].name).toBe("私密房");
  });
});
