/**
 * @fileoverview 服务端拉流器单元测试
 */

import { assertRejects, describe, expect, it } from "@dreamer/test";
import { ServerSubscriber } from "../../src/server/subscriber.ts";

/** 用于测试的 mock Socket.io Server（避免真实启动端口；需具备 of、listen、on） */
function createMockIo() {
  return {
    of: () => ({ emit: () => {} }),
    listen: () => Promise.resolve(),
    on: () => {},
  };
}

describe("ServerSubscriber", () => {
  it("应该创建拉流器实例", () => {
    const subscriber = new ServerSubscriber({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    expect(subscriber.streamId).toBe("stream-1");
    expect(subscriber.status).toBe("idle");
  });

  it("应该在未连接时 getStatistics 返回默认统计", () => {
    const subscriber = new ServerSubscriber({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    const stats = subscriber.getStatistics();
    expect(stats.streamId).toBe("stream-1");
    expect(stats.status).toBe("idle");
    expect(typeof stats.uptime).toBe("number");
  });

  it("应该 connect 后状态变为 connected", async () => {
    const subscriber = new ServerSubscriber({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    await subscriber.connect("http://localhost:8080/live/stream-1.m3u8");
    expect(subscriber.status).toBe("connected");
  });

  it("未连接时 subscribe 应抛出状态错误", async () => {
    const subscriber = new ServerSubscriber({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    await assertRejects(() => subscriber.subscribe());
  });

  it("重复 connect 应抛出状态错误", async () => {
    const subscriber = new ServerSubscriber({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    await subscriber.connect("http://localhost:8080/live/stream-1.m3u8");
    await assertRejects(
      () => subscriber.connect("http://localhost:8080/live/stream-1.m3u8"),
      Error,
      "拉流器状态错误",
    );
  });

  it("应该支持 on/off 事件监听", async () => {
    const subscriber = new ServerSubscriber({
      streamId: "stream-1",
      io: createMockIo() as any,
    });
    let connected = false;
    subscriber.on("connected", () => {
      connected = true;
    });
    await subscriber.connect("http://localhost:8080/live/stream-1.m3u8");
    expect(connected).toBe(true);
    if (subscriber.removeAllListeners) {
      subscriber.removeAllListeners();
    }
  });
});
