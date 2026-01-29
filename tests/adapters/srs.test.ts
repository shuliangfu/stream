/**
 * @fileoverview SRS 适配器单元测试
 *
 * 通过 mock fetch 测试 SRS 适配器，无需真实 SRS 服务器
 */

import {
  afterEach,
  assertRejects,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { SRSAdapter } from "../../src/adapters/srs.ts";
import { StreamNotFoundError } from "../../src/utils/errors.ts";

/** 保存原始 fetch，便于恢复 */
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("SRSAdapter", () => {
  it("应该创建适配器实例", () => {
    const adapter = new SRSAdapter({
      apiUrl: "http://localhost:1985",
      host: "localhost",
      rtmpPort: 1935,
      httpPort: 8080,
      app: "live",
    });
    expect(adapter.name).toBe("srs");
  });

  it("应该使用默认配置", () => {
    const adapter = new SRSAdapter();
    expect(adapter).toBeDefined();
  });

  it("应该创建流（不调用 SRS API）", async () => {
    const adapter = new SRSAdapter({
      apiUrl: "http://localhost:1985",
      host: "localhost",
      rtmpPort: 1935,
      httpPort: 8080,
      app: "live",
    });
    const stream = await adapter.createStream({
      name: "测试流",
      protocol: "rtmp",
    });
    expect(typeof stream.id).toBe("string");
    expect(stream.name).toBe("测试流");
    expect(stream.protocol).toBe("rtmp");
    expect(stream.status).toBe("idle");
    expect(stream.publisherUrl).toContain("rtmp://");
    expect(stream.subscriberUrls.rtmp).toBeDefined();
    expect(stream.subscriberUrls.hls).toBeDefined();
    expect(stream.subscriberUrls.flv).toBeDefined();
    expect(stream.subscriberUrls.webrtc).toBeDefined();
  });

  it("应该获取流（mock SRS API 返回空流列表）", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ streams: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const adapter = new SRSAdapter({ apiUrl: "http://localhost:1985" });
    const created = await adapter.createStream({
      name: "测试流",
      protocol: "rtmp",
    });
    const retrieved = await adapter.getStream(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.name).toBe("测试流");
  });

  it("应该对不存在的流返回 null", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ streams: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const adapter = new SRSAdapter({ apiUrl: "http://localhost:1985" });
    const stream = await adapter.getStream("non-existent-id");
    expect(stream).toBeNull();
  });

  it("应该列出所有流（mock SRS API）", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ streams: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const adapter = new SRSAdapter({ apiUrl: "http://localhost:1985" });
    await adapter.createStream({ name: "流1", protocol: "rtmp" });
    await adapter.createStream({ name: "流2", protocol: "rtmp" });
    const streams = await adapter.listStreams();
    expect(streams.length).toBe(2);
  });

  it("应该支持 listStreams 分页（limit/offset）", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ streams: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const adapter = new SRSAdapter({ apiUrl: "http://localhost:1985" });
    await adapter.createStream({ name: "流1", protocol: "rtmp" });
    await adapter.createStream({ name: "流2", protocol: "rtmp" });
    await adapter.createStream({ name: "流3", protocol: "rtmp" });
    const page1 = await adapter.listStreams({ limit: 2, offset: 0 });
    expect(page1.length).toBe(2);
    const page2 = await adapter.listStreams({ limit: 2, offset: 2 });
    expect(page2.length).toBe(1);
  });

  it("应该删除流（mock DELETE 成功）", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const adapter = new SRSAdapter({ apiUrl: "http://localhost:1985" });
    const stream = await adapter.createStream({
      name: "测试流",
      protocol: "rtmp",
    });
    await adapter.deleteStream(stream.id);
    const retrieved = await adapter.getStream(stream.id);
    expect(retrieved).toBeNull();
  });

  it("应该获取流统计信息（mock API）", async () => {
    globalThis.fetch = (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/v1/streams/") && !url.endsWith("streams")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              stream: {
                id: 1,
                name: "test",
                stream: "stream-xxx",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ streams: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    };
    const adapter = new SRSAdapter({ apiUrl: "http://localhost:1985" });
    const stream = await adapter.createStream({
      name: "测试流",
      protocol: "rtmp",
    });
    const stats = await adapter.getStatistics(stream.id);
    expect(stats.streamId).toBe(stream.id);
    expect(typeof stats.viewers).toBe("number");
    expect(typeof stats.uptime).toBe("number");
  });

  it("应该对不存在的流 getStatistics 抛出 StreamNotFoundError", async () => {
    const adapter = new SRSAdapter({ apiUrl: "http://localhost:1985" });
    await assertRejects(
      () => adapter.getStatistics("non-existent-stream-id"),
      StreamNotFoundError,
    );
  });

  it("connect 失败时应抛出错误", async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response("error", { status: 500 }));
    const adapter = new SRSAdapter({ apiUrl: "http://localhost:1985" });
    await assertRejects(() => adapter.connect());
  });

  it("connect 成功时不应抛出", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const adapter = new SRSAdapter({ apiUrl: "http://localhost:1985" });
    await adapter.connect();
  });
});
