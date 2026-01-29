/**
 * @fileoverview LiveKit 适配器单元测试
 *
 * 通过 mock fetch 测试 LiveKit 适配器，无需真实 LiveKit 服务
 */

import {
  afterEach,
  assertRejects,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { LiveKitAdapter } from "../../src/adapters/livekit.ts";
import { StreamNotFoundError } from "../../src/utils/errors.ts";

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("LiveKitAdapter", () => {
  const baseUrl = "http://localhost:7880";
  const apiKey = "test-api-key";
  const apiSecret = "test-api-secret";

  it("应该创建适配器实例", () => {
    const adapter = new LiveKitAdapter({
      host: baseUrl,
      apiKey,
      apiSecret,
    });
    expect(adapter.name).toBe("livekit");
  });

  it("应该使用默认 host", () => {
    const adapter = new LiveKitAdapter({ apiKey, apiSecret });
    expect(adapter).toBeDefined();
  });

  it("应该 createStream 调用 CreateRoom 并返回流", async () => {
    let createRoomCalled = false;
    globalThis.fetch = (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("CreateRoom")) {
        createRoomCalled = true;
        return Promise.resolve(
          new Response(JSON.stringify({ room: { name: "my-room" } }), {
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
    const adapter = new LiveKitAdapter({
      host: baseUrl,
      apiKey,
      apiSecret,
    });
    const stream = await adapter.createStream({
      name: "my-room",
      protocol: "webrtc",
    });
    expect(createRoomCalled).toBe(true);
    expect(stream.id).toBe("my-room");
    expect(stream.name).toBe("my-room");
    expect(stream.protocol).toBe("webrtc");
    expect(stream.publisherUrl).toContain("ws");
    expect(stream.subscriberUrls.webrtc).toBeDefined();
  });

  it("应该 getStream 通过 ListRooms 获取房间并转为流", async () => {
    globalThis.fetch = (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("ListRooms")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              rooms: [
                {
                  name: "room-1",
                  num_participants: 1,
                  creation_time: Math.floor(Date.now() / 1000) - 60,
                },
              ],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    };
    const adapter = new LiveKitAdapter({
      host: baseUrl,
      apiKey,
      apiSecret,
    });
    const stream = await adapter.getStream("room-1");
    expect(stream).not.toBeNull();
    expect(stream?.id).toBe("room-1");
    expect(stream?.status).toBe("publishing");
  });

  it("应该对不存在的房间 getStream 返回 null（ListRooms 未返回该房间）", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ rooms: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const adapter = new LiveKitAdapter({
      host: baseUrl,
      apiKey,
      apiSecret,
    });
    const stream = await adapter.getStream("non-existent-room");
    expect(stream).toBeNull();
  });

  it("应该 listStreams 调用 ListRooms 并返回流列表", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            rooms: [
              { name: "r1", num_participants: 0, creation_time: 0 },
              { name: "r2", num_participants: 2, creation_time: 0 },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const adapter = new LiveKitAdapter({
      host: baseUrl,
      apiKey,
      apiSecret,
    });
    const list = await adapter.listStreams();
    expect(list.length).toBe(2);
    const names = list.map((s) => s.name).sort();
    expect(names).toEqual(["r1", "r2"]);
  });

  it("应该 deleteStream 调用 DeleteRoom", async () => {
    let deleteRoomCalled = false;
    globalThis.fetch = (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("DeleteRoom")) {
        deleteRoomCalled = true;
      }
      return Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    };
    const adapter = new LiveKitAdapter({
      host: baseUrl,
      apiKey,
      apiSecret,
    });
    await adapter.createStream({ name: "to-delete", protocol: "webrtc" });
    await adapter.deleteStream("to-delete");
    expect(deleteRoomCalled).toBe(true);
  });

  it("应该 getStatistics 对存在的流返回统计", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            rooms: [
              {
                name: "stats-room",
                num_participants: 3,
                creation_time: Math.floor(Date.now() / 1000) - 120,
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const adapter = new LiveKitAdapter({
      host: baseUrl,
      apiKey,
      apiSecret,
    });
    await adapter.createStream({ name: "stats-room", protocol: "webrtc" });
    const stats = await adapter.getStatistics("stats-room");
    expect(stats.streamId).toBe("stats-room");
    expect(stats.viewers).toBe(3);
    expect(typeof stats.uptime).toBe("number");
  });

  it("应该 getStatistics 对不存在的流抛出 StreamNotFoundError", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ rooms: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const adapter = new LiveKitAdapter({
      host: baseUrl,
      apiKey,
      apiSecret,
    });
    await assertRejects(
      () => adapter.getStatistics("non-existent"),
      StreamNotFoundError,
    );
  });

  it("应该 createPublisher / createSubscriber 对存在的流返回实例", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            rooms: [{ name: "pubsub-room", num_participants: 0 }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const adapter = new LiveKitAdapter({
      host: baseUrl,
      apiKey,
      apiSecret,
    });
    await adapter.createStream({ name: "pubsub-room", protocol: "webrtc" });
    const publisher = await adapter.createPublisher("pubsub-room");
    expect(publisher).toBeDefined();
    expect(publisher.streamId).toBe("pubsub-room");
    const subscriber = await adapter.createSubscriber("pubsub-room");
    expect(subscriber).toBeDefined();
    expect(subscriber.streamId).toBe("pubsub-room");
  });

  it("应该 createPublisher 对不存在的流抛出 StreamNotFoundError", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ rooms: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const adapter = new LiveKitAdapter({
      host: baseUrl,
      apiKey,
      apiSecret,
    });
    await assertRejects(
      () => adapter.createPublisher("non-existent"),
      StreamNotFoundError,
    );
  });
});
