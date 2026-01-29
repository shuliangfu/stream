/**
 * @fileoverview 使用 @dreamer/test 浏览器测试集成进行客户端（浏览器）测试
 *
 * 参考 webrtc 的 browser-puppeteer.test.ts：
 * - 使用 browser 配置启用浏览器环境
 * - entryPoint 为客户端入口，打包后挂到 globalName（StreamClient）
 * - browserMode: false 将 JSR 打进 bundle，避免浏览器里出现 require()
 * 首次运行 createBrowserContext 时会打包 client，可能需 1–2 分钟，属正常。
 */

import { RUNTIME } from "@dreamer/runtime-adapter";
import { describe, expect, it } from "@dreamer/test";

// 浏览器测试配置：与 webrtc 一致，browserMode: false 将 JSR 打进去
const browserConfig = {
  sanitizeOps: false,
  sanitizeResources: false,
  timeout: 120_000,
  browser: {
    enabled: true,
    entryPoint: "./src/client/mod.ts",
    globalName: "StreamClient",
    browserMode: false,
    moduleLoadTimeout: 90_000,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
    reuseBrowser: true,
    bodyContent: `
      <div id="test-container">
        <video id="local-video" autoplay muted></video>
        <video id="remote-video" autoplay></video>
      </div>
    `,
  },
};

describe(`Stream 客户端 - 浏览器测试 (${RUNTIME})`, () => {
  describe("StreamClient 浏览器环境", () => {
    it(
      "应该在浏览器中挂载 StreamClient 并导出 ClientPublisher、ClientSubscriber",
      async (t) => {
        const result = await (t as {
          browser?: { evaluate: (fn: () => unknown) => Promise<unknown> };
        }).browser!.evaluate(() => {
          const win = globalThis as unknown as {
            StreamClient?: {
              ClientPublisher?: unknown;
              ClientSubscriber?: unknown;
            };
          };
          if (typeof win.StreamClient === "undefined") {
            return { success: false, error: "StreamClient 未定义" };
          }
          try {
            return {
              success: true,
              hasClientPublisher:
                typeof win.StreamClient.ClientPublisher === "function",
              hasClientSubscriber:
                typeof win.StreamClient.ClientSubscriber === "function",
            };
          } catch (err: unknown) {
            return {
              success: false,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        });
        const r = result as {
          success: boolean;
          error?: string;
          hasClientPublisher?: boolean;
          hasClientSubscriber?: boolean;
        };
        expect(r.success).toBe(true);
        expect(r.hasClientPublisher).toBe(true);
        expect(r.hasClientSubscriber).toBe(true);
      },
      browserConfig,
    );

    it("应该在浏览器中创建 ClientPublisher 实例并具备方法", async (t) => {
      const result = await (t as {
        browser?: { evaluate: (fn: () => unknown) => Promise<unknown> };
      }).browser!.evaluate(() => {
        const win = globalThis as unknown as {
          StreamClient?: {
            ClientPublisher?: new (id: string, opts?: unknown) => unknown;
          };
        };
        if (typeof win.StreamClient?.ClientPublisher === "undefined") {
          return { success: false, error: "ClientPublisher 未定义" };
        }
        try {
          const publisher = new win.StreamClient.ClientPublisher(
            "stream-1",
            {},
          );
          return {
            success: true,
            hasConnect: typeof (publisher as { connect?: unknown }).connect ===
              "function",
            hasPublish: typeof (publisher as { publish?: unknown }).publish ===
              "function",
            hasStop:
              typeof (publisher as { stop?: unknown }).stop === "function",
            hasOn: typeof (publisher as { on?: unknown }).on === "function",
            hasOff: typeof (publisher as { off?: unknown }).off === "function",
            hasGetStatistics: typeof (publisher as { getStatistics?: unknown })
              .getStatistics === "function",
            streamId: (publisher as { streamId?: string }).streamId,
          };
        } catch (err: unknown) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });
      const r = result as {
        success: boolean;
        hasConnect?: boolean;
        hasPublish?: boolean;
        hasStop?: boolean;
        hasOn?: boolean;
        hasOff?: boolean;
        hasGetStatistics?: boolean;
        streamId?: string;
      };
      expect(r.success).toBe(true);
      expect(r.hasConnect).toBe(true);
      expect(r.hasPublish).toBe(true);
      expect(r.hasStop).toBe(true);
      expect(r.hasOn).toBe(true);
      expect(r.hasOff).toBe(true);
      expect(r.hasGetStatistics).toBe(true);
      expect(r.streamId).toBe("stream-1");
    }, browserConfig);

    it("应该在浏览器中创建 ClientSubscriber 实例并具备方法", async (t) => {
      const result = await (t as {
        browser?: { evaluate: (fn: () => unknown) => Promise<unknown> };
      }).browser!.evaluate(() => {
        const win = globalThis as unknown as {
          StreamClient?: {
            ClientSubscriber?: new (id: string, opts?: unknown) => unknown;
          };
        };
        if (typeof win.StreamClient?.ClientSubscriber === "undefined") {
          return { success: false, error: "ClientSubscriber 未定义" };
        }
        try {
          const subscriber = new win.StreamClient.ClientSubscriber(
            "stream-1",
            {},
          );
          return {
            success: true,
            hasConnect: typeof (subscriber as { connect?: unknown }).connect ===
              "function",
            hasSubscribe:
              typeof (subscriber as { subscribe?: unknown }).subscribe ===
                "function",
            hasStop:
              typeof (subscriber as { stop?: unknown }).stop === "function",
            hasPlay:
              typeof (subscriber as { play?: unknown }).play === "function",
            hasPause:
              typeof (subscriber as { pause?: unknown }).pause === "function",
            hasOn: typeof (subscriber as { on?: unknown }).on === "function",
            hasOff: typeof (subscriber as { off?: unknown }).off === "function",
            hasGetStatistics: typeof (subscriber as { getStatistics?: unknown })
              .getStatistics === "function",
            streamId: (subscriber as { streamId?: string }).streamId,
          };
        } catch (err: unknown) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });
      const r = result as {
        success: boolean;
        hasConnect?: boolean;
        hasSubscribe?: boolean;
        hasStop?: boolean;
        hasPlay?: boolean;
        hasPause?: boolean;
        hasOn?: boolean;
        hasOff?: boolean;
        hasGetStatistics?: boolean;
        streamId?: string;
      };
      expect(r.success).toBe(true);
      expect(r.hasConnect).toBe(true);
      expect(r.hasSubscribe).toBe(true);
      expect(r.hasStop).toBe(true);
      expect(r.hasPlay).toBe(true);
      expect(r.hasPause).toBe(true);
      expect(r.hasOn).toBe(true);
      expect(r.hasOff).toBe(true);
      expect(r.hasGetStatistics).toBe(true);
      expect(r.streamId).toBe("stream-1");
    }, browserConfig);

    it("应该在浏览器中支持 ClientPublisher 事件 on/off", async (t) => {
      const result = await (t as {
        browser?: { evaluate: (fn: () => unknown) => Promise<unknown> };
      }).browser!.evaluate(() => {
        const win = globalThis as unknown as {
          StreamClient?: {
            ClientPublisher?: new (id: string, opts?: unknown) => unknown;
          };
        };
        if (typeof win.StreamClient?.ClientPublisher === "undefined") {
          return { success: false, error: "ClientPublisher 未定义" };
        }
        try {
          const publisher = new win.StreamClient.ClientPublisher(
            "stream-1",
            {},
          );
          const cb = () => {};
          (publisher as { on: (e: string, c: () => void) => void }).on(
            "connecting",
            cb,
          );
          (publisher as { off: (e: string, c?: () => void) => void }).off(
            "connecting",
            cb,
          );
          return { success: true, hasOn: true, hasOff: true };
        } catch (err: unknown) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });
      const r = result as {
        success: boolean;
        hasOn?: boolean;
        hasOff?: boolean;
      };
      expect(r.success).toBe(true);
      expect(r.hasOn).toBe(true);
      expect(r.hasOff).toBe(true);
    }, browserConfig);

    it("应该在浏览器中支持 ClientSubscriber 事件 on/off", async (t) => {
      const result = await (t as {
        browser?: { evaluate: (fn: () => unknown) => Promise<unknown> };
      }).browser!.evaluate(() => {
        const win = globalThis as unknown as {
          StreamClient?: {
            ClientSubscriber?: new (id: string, opts?: unknown) => unknown;
          };
        };
        if (typeof win.StreamClient?.ClientSubscriber === "undefined") {
          return { success: false, error: "ClientSubscriber 未定义" };
        }
        try {
          const subscriber = new win.StreamClient.ClientSubscriber(
            "stream-1",
            {},
          );
          const cb = () => {};
          (subscriber as { on: (e: string, c: () => void) => void }).on(
            "connecting",
            cb,
          );
          (subscriber as { off: (e: string, c?: () => void) => void }).off(
            "connecting",
            cb,
          );
          return { success: true, hasOn: true, hasOff: true };
        } catch (err: unknown) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });
      const r = result as {
        success: boolean;
        hasOn?: boolean;
        hasOff?: boolean;
      };
      expect(r.success).toBe(true);
      expect(r.hasOn).toBe(true);
      expect(r.hasOff).toBe(true);
    }, browserConfig);

    it("应该在浏览器中 ClientPublisher.getStatistics 返回对象", async (t) => {
      const result = await (t as {
        browser?: { evaluate: (fn: () => unknown) => Promise<unknown> };
      }).browser!.evaluate(() => {
        const win = globalThis as unknown as {
          StreamClient?: {
            ClientPublisher?: new (id: string, opts?: unknown) => unknown;
          };
        };
        if (typeof win.StreamClient?.ClientPublisher === "undefined") {
          return { success: false, error: "ClientPublisher 未定义" };
        }
        try {
          const publisher = new win.StreamClient.ClientPublisher(
            "stream-1",
            {},
          );
          const stats = (publisher as { getStatistics: () => unknown })
            .getStatistics();
          const s = stats as Record<string, unknown>;
          return {
            success: true,
            hasStreamId: typeof s.streamId === "string",
            hasStatus: typeof s.status === "string",
            hasUptime: typeof s.uptime === "number",
          };
        } catch (err: unknown) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });
      const r = result as {
        success: boolean;
        hasStreamId?: boolean;
        hasStatus?: boolean;
        hasUptime?: boolean;
      };
      expect(r.success).toBe(true);
      expect(r.hasStreamId).toBe(true);
      expect(r.hasStatus).toBe(true);
      expect(r.hasUptime).toBe(true);
    }, browserConfig);

    it("应该在浏览器中 ClientSubscriber.getStatistics 返回对象", async (t) => {
      const result = await (t as {
        browser?: { evaluate: (fn: () => unknown) => Promise<unknown> };
      }).browser!.evaluate(() => {
        const win = globalThis as unknown as {
          StreamClient?: {
            ClientSubscriber?: new (id: string, opts?: unknown) => unknown;
          };
        };
        if (typeof win.StreamClient?.ClientSubscriber === "undefined") {
          return { success: false, error: "ClientSubscriber 未定义" };
        }
        try {
          const subscriber = new win.StreamClient.ClientSubscriber(
            "stream-1",
            {},
          );
          const stats = (subscriber as { getStatistics: () => unknown })
            .getStatistics();
          const s = stats as Record<string, unknown>;
          return {
            success: true,
            hasStreamId: typeof s.streamId === "string",
            hasStatus: typeof s.status === "string",
            hasUptime: typeof s.uptime === "number",
          };
        } catch (err: unknown) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });
      const r = result as {
        success: boolean;
        hasStreamId?: boolean;
        hasStatus?: boolean;
        hasUptime?: boolean;
      };
      expect(r.success).toBe(true);
      expect(r.hasStreamId).toBe(true);
      expect(r.hasStatus).toBe(true);
      expect(r.hasUptime).toBe(true);
    }, browserConfig);

    it("应该在浏览器中支持 MediaStream API", async (t) => {
      const result = await (t as {
        browser?: { evaluate: (fn: () => unknown) => Promise<unknown> };
      }).browser!.evaluate(() => {
        try {
          const win = globalThis as unknown as {
            MediaStream?: new () => unknown;
          };
          const hasMediaStream = typeof win.MediaStream !== "undefined";
          if (!hasMediaStream) {
            return { success: false, error: "MediaStream 不可用" };
          }
          const stream = new win.MediaStream!();
          const s = stream as {
            getTracks?: () => unknown[];
            getAudioTracks?: () => unknown[];
            getVideoTracks?: () => unknown[];
          };
          return {
            success: true,
            hasGetTracks: typeof s.getTracks === "function",
            hasGetAudioTracks: typeof s.getAudioTracks === "function",
            hasGetVideoTracks: typeof s.getVideoTracks === "function",
          };
        } catch (err: unknown) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });
      const r = result as {
        success: boolean;
        hasGetTracks?: boolean;
        hasGetAudioTracks?: boolean;
        hasGetVideoTracks?: boolean;
      };
      expect(r.success).toBe(true);
      expect(r.hasGetTracks).toBe(true);
      expect(r.hasGetAudioTracks).toBe(true);
      expect(r.hasGetVideoTracks).toBe(true);
    }, browserConfig);

    it("应该在浏览器中支持 HTMLVideoElement", async (t) => {
      const result = await (t as {
        browser?: { evaluate: (fn: () => unknown) => Promise<unknown> };
      }).browser!.evaluate(() => {
        try {
          const video = document.createElement("video");
          return {
            success: true,
            hasSrcObject: "srcObject" in video,
            hasPlay: typeof video.play === "function",
            hasPause: typeof video.pause === "function",
          };
        } catch (err: unknown) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      });
      const r = result as {
        success: boolean;
        hasSrcObject?: boolean;
        hasPlay?: boolean;
        hasPause?: boolean;
      };
      expect(r.success).toBe(true);
      expect(r.hasSrcObject).toBe(true);
      expect(r.hasPlay).toBe(true);
      expect(r.hasPause).toBe(true);
    }, browserConfig);
  }, browserConfig);
}, browserConfig);
