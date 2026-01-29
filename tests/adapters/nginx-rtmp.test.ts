/**
 * @fileoverview nginx-rtmp 适配器单元测试
 *
 * 通过 mock fetch 测试 nginx-rtmp 适配器，无需真实 nginx-rtmp 服务器
 */

import {
  afterEach,
  assertRejects,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { NginxRtmpAdapter } from "../../src/adapters/nginx-rtmp.ts";
import { StreamNotFoundError } from "../../src/utils/errors.ts";

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** 返回 nginx-rtmp /stat 风格的 XML 片段 */
function statXmlWithStreams(streamNames: string[], appName = "live"): string {
  const streams = streamNames
    .map((name) => `<stream><name>${name}</name></stream>`)
    .join("");
  return `<?xml version="1.0"?>
<rtmp><server>
<application><name>${appName}</name><live>${streams}</live></application>
</server></rtmp>`;
}

describe("NginxRtmpAdapter", () => {
  it("应该创建适配器实例", () => {
    const adapter = new NginxRtmpAdapter({
      statUrl: "http://localhost:80/stat",
      host: "localhost",
      rtmpPort: 1935,
      httpPort: 80,
      app: "live",
    });
    expect(adapter.name).toBe("nginx-rtmp");
  });

  it("应该使用默认配置", () => {
    const adapter = new NginxRtmpAdapter();
    expect(adapter).toBeDefined();
  });

  it("应该 createStream 登记流并返回推拉 URL", async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response(statXmlWithStreams([]), { status: 200 }));
    const adapter = new NginxRtmpAdapter({
      statUrl: "http://localhost/stat",
      host: "localhost",
      rtmpPort: 1935,
      httpPort: 80,
      app: "live",
    });
    const stream = await adapter.createStream({
      name: "mystream",
      protocol: "rtmp",
    });
    expect(stream.id).toBe("mystream");
    expect(stream.name).toBe("mystream");
    expect(stream.protocol).toBe("rtmp");
    expect(stream.status).toBe("idle");
    expect(stream.publisherUrl).toContain("rtmp://");
    expect(stream.publisherUrl).toContain("/live/mystream");
    expect(stream.subscriberUrls.rtmp).toContain("/live/mystream");
    expect(stream.subscriberUrls.hls).toBeDefined();
    expect(stream.subscriberUrls.flv).toBeDefined();
  });

  it("应该 getStream 在 stat 无该流时仍返回本地已登记流", async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response(statXmlWithStreams([]), { status: 200 }));
    const adapter = new NginxRtmpAdapter({ statUrl: "http://localhost/stat" });
    const created = await adapter.createStream({
      name: "local-only",
      protocol: "rtmp",
    });
    const retrieved = await adapter.getStream(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe("local-only");
  });

  it("应该 getStream 从 stat 同步在播流", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(statXmlWithStreams(["live-stream-1"]), { status: 200 }),
      );
    const adapter = new NginxRtmpAdapter({ statUrl: "http://localhost/stat" });
    const retrieved = await adapter.getStream("live-stream-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe("live-stream-1");
    expect(retrieved?.status).toBe("publishing");
  });

  it("应该对不存在的流返回 null（stat 无该流且本地无登记）", async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response(statXmlWithStreams([]), { status: 200 }));
    const adapter = new NginxRtmpAdapter({ statUrl: "http://localhost/stat" });
    const stream = await adapter.getStream("non-existent");
    expect(stream).toBeNull();
  });

  it("应该 listStreams 合并 stat 与本地流", async () => {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(statXmlWithStreams(["from-stat"]), { status: 200 }),
      );
    const adapter = new NginxRtmpAdapter({ statUrl: "http://localhost/stat" });
    await adapter.createStream({ name: "local-stream", protocol: "rtmp" });
    const list = await adapter.listStreams();
    expect(list.length).toBeGreaterThanOrEqual(1);
    const names = list.map((s) => s.name);
    expect(names).toContain("from-stat");
    expect(names).toContain("local-stream");
  });

  it("应该 deleteStream 移除本地登记", async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response(statXmlWithStreams([]), { status: 200 }));
    const adapter = new NginxRtmpAdapter({ statUrl: "http://localhost/stat" });
    const created = await adapter.createStream({
      name: "to-delete",
      protocol: "rtmp",
    });
    await adapter.deleteStream(created.id);
    const after = await adapter.getStream(created.id);
    expect(after).toBeNull();
  });

  it("应该 getStatistics 对存在的流返回基础统计", async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response(statXmlWithStreams([]), { status: 200 }));
    const adapter = new NginxRtmpAdapter({ statUrl: "http://localhost/stat" });
    const created = await adapter.createStream({
      name: "stats-stream",
      protocol: "rtmp",
    });
    const stats = await adapter.getStatistics(created.id);
    expect(stats.streamId).toBe("stats-stream");
    expect(typeof stats.viewers).toBe("number");
    expect(typeof stats.uptime).toBe("number");
  });

  it("应该 getStatistics 对不存在的流抛出 StreamNotFoundError", async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response(statXmlWithStreams([]), { status: 200 }));
    const adapter = new NginxRtmpAdapter({ statUrl: "http://localhost/stat" });
    await assertRejects(
      () => adapter.getStatistics("non-existent"),
      StreamNotFoundError,
    );
  });

  it("应该 connect 失败时抛出 ConnectionError", async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response("error", { status: 500 }));
    const adapter = new NginxRtmpAdapter({ statUrl: "http://localhost/stat" });
    await assertRejects(() => adapter.connect(), Error, "stat");
  });

  it("应该 createPublisher / createSubscriber 对存在的流返回实例", async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response(statXmlWithStreams([]), { status: 200 }));
    const adapter = new NginxRtmpAdapter({ statUrl: "http://localhost/stat" });
    const created = await adapter.createStream({
      name: "pubsub-stream",
      protocol: "rtmp",
    });
    const publisher = await adapter.createPublisher(created.id);
    expect(publisher).toBeDefined();
    expect(publisher.streamId).toBe("pubsub-stream");
    const subscriber = await adapter.createSubscriber(created.id);
    expect(subscriber).toBeDefined();
    expect(subscriber.streamId).toBe("pubsub-stream");
  });

  it("应该 createPublisher 对不存在的流抛出 StreamNotFoundError", async () => {
    globalThis.fetch = () =>
      Promise.resolve(new Response(statXmlWithStreams([]), { status: 200 }));
    const adapter = new NginxRtmpAdapter({ statUrl: "http://localhost/stat" });
    await assertRejects(
      () => adapter.createPublisher("non-existent"),
      StreamNotFoundError,
    );
  });
});
