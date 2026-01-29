/**
 * @fileoverview nginx-rtmp 流媒体适配器
 *
 * 基于 nginx-rtmp-module 的 /stat 页面获取直播流列表，
 * 推拉流使用 RTMP/HLS/FLV URL，与 SRS/FFmpeg 用法一致。
 * 需在 nginx 中配置 location /stat { rtmp_stat all; }
 */

import type {
  AdapterConfig,
  Publisher,
  PublisherOptions,
  Stream,
  StreamOptions,
  StreamStatistics,
  Subscriber,
  SubscriberOptions,
} from "../types.ts";
import { ConnectionError, StreamNotFoundError } from "../utils/errors.ts";
import { generateId } from "../utils/id.ts";
import { generatePublisherUrl, generateSubscriberUrl } from "../utils/url.ts";
import type { StreamAdapter } from "./base.ts";

/**
 * nginx-rtmp 适配器配置
 */
export interface NginxRtmpAdapterConfig extends AdapterConfig {
  /** stat 页面地址（默认: "http://localhost:80/stat"） */
  statUrl?: string;
  /** RTMP 端口（默认: 1935） */
  rtmpPort?: number;
  /** HTTP 端口（用于 HLS/FLV，默认: 80） */
  httpPort?: number;
  /** 应用名称（默认: "live"） */
  app?: string;
}

/**
 * 从 nginx-rtmp /stat 返回的 XML 中解析出流名称列表
 * 结构: rtmp > server > application > live > stream[] > name
 * 优先用 DOMParser，不可用时用正则回退
 */
function parseStreamNamesFromStatXml(
  xmlText: string,
  appName: string,
): string[] {
  const names: string[] = [];
  try {
    if (typeof globalThis.DOMParser !== "undefined") {
      const parser = new globalThis.DOMParser();
      const doc = parser.parseFromString(xmlText, "text/xml");
      const apps = doc.getElementsByTagName("application");
      for (let i = 0; i < apps.length; i++) {
        const app = apps[i];
        const nameEl = app.getElementsByTagName("name")[0];
        if (!nameEl || nameEl.textContent?.trim() !== appName) continue;
        const live = app.getElementsByTagName("live")[0];
        if (!live) continue;
        const streamEls = live.getElementsByTagName("stream");
        for (let j = 0; j < streamEls.length; j++) {
          const streamEl = streamEls[j];
          const streamNameEl = streamEl.getElementsByTagName("name")[0];
          if (streamNameEl?.textContent) {
            names.push(streamNameEl.textContent.trim());
          }
        }
      }
    }
    // 正则回退：匹配 <application>...<name>appName</name>...<live>...<stream><name>流名</name>
    if (names.length === 0 && appName) {
      const appBlock = new RegExp(
        `<application>[\\s\\S]*?<name>\\s*${
          escapeRe(appName)
        }\\s*</name>[\\s\\S]*?<live>([\\s\\S]*?)</live>`,
        "i",
      ).exec(xmlText);
      if (appBlock) {
        const liveContent = appBlock[1];
        const streamNameRe = /<stream>\s*<name>\s*([^<]+?)\s*<\/name>/gi;
        let m: RegExpExecArray | null;
        while ((m = streamNameRe.exec(liveContent)) !== null) {
          names.push(m[1].trim());
        }
      }
    }
  } catch {
    // 解析失败返回空，不抛错
  }
  return names;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * nginx-rtmp 流媒体适配器
 *
 * 通过 HTTP /stat 获取当前直播流列表；createStream 仅做本地登记，
 * 实际流由推流端连接 rtmp://host:port/app/streamKey 时在 nginx 上产生。
 */
export class NginxRtmpAdapter implements StreamAdapter {
  readonly name = "nginx-rtmp";
  private config: NginxRtmpAdapterConfig;
  /** 本地登记的流（createStream 创建或从 stat 同步） */
  private streams: Map<string, Stream> = new Map();
  private statUrl: string;

  constructor(config?: NginxRtmpAdapterConfig) {
    this.config = {
      host: config?.host || "localhost",
      rtmpPort: config?.rtmpPort ?? 1935,
      httpPort: config?.httpPort ?? 80,
      app: config?.app || "live",
      statUrl: config?.statUrl || "http://localhost:80/stat",
      ...config,
    };
    this.statUrl = this.config.statUrl!;
  }

  /**
   * 请求 /stat 并解析 XML
   */
  private async fetchStatXml(): Promise<string> {
    const response = await fetch(this.statUrl);
    if (!response.ok) {
      throw new ConnectionError(
        `nginx-rtmp stat 请求失败: ${response.statusText}`,
      );
    }
    return await response.text();
  }

  /**
   * 从 nginx-rtmp 同步当前在播流到本地缓存
   */
  private async syncStreamsFromStat(): Promise<void> {
    const app = this.config.app!;
    const xml = await this.fetchStatXml();
    const streamNames = parseStreamNamesFromStatXml(xml, app);
    for (const name of streamNames) {
      if (this.streams.has(name)) {
        const s = this.streams.get(name)!;
        s.status = "publishing";
        s.updatedAt = new Date();
      } else {
        const stream: Stream = {
          id: name,
          name,
          status: "publishing",
          protocol: "rtmp",
          publisherUrl: generatePublisherUrl(
            "rtmp",
            this.config.host!,
            this.config.rtmpPort!,
            app,
            name,
          ),
          subscriberUrls: {
            rtmp: generateSubscriberUrl(
              "rtmp",
              this.config.host!,
              this.config.rtmpPort!,
              app,
              name,
            ),
            hls: generateSubscriberUrl(
              "hls",
              this.config.host!,
              this.config.httpPort!,
              app,
              name,
            ),
            flv: generateSubscriberUrl(
              "flv",
              this.config.host!,
              this.config.httpPort!,
              app,
              name,
            ),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.streams.set(name, stream);
      }
    }
  }

  /**
   * 连接：检查 stat 是否可达
   */
  async connect(): Promise<void> {
    try {
      await this.fetchStatXml();
    } catch (error) {
      throw new ConnectionError(
        `无法连接 nginx-rtmp stat (${this.statUrl}): ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async disconnect(): Promise<void> {
    // 无长连接
  }

  /**
   * 创建流：仅在本地登记，实际流在推流到 rtmp://.../app/streamKey 时产生
   */
  async createStream(options: StreamOptions): Promise<Stream> {
    const streamId = options.name || generateId("stream");
    const streamKey = streamId;
    const app = this.config.app!;

    const stream: Stream = {
      id: streamId,
      name: options.name || streamId,
      roomId: options.roomId,
      status: "idle",
      protocol: options.protocol,
      publisherUrl: generatePublisherUrl(
        "rtmp",
        this.config.host!,
        this.config.rtmpPort!,
        app,
        streamKey,
      ),
      subscriberUrls: {
        rtmp: generateSubscriberUrl(
          "rtmp",
          this.config.host!,
          this.config.rtmpPort!,
          app,
          streamKey,
        ),
        hls: generateSubscriberUrl(
          "hls",
          this.config.host!,
          this.config.httpPort!,
          app,
          streamKey,
        ),
        flv: generateSubscriberUrl(
          "flv",
          this.config.host!,
          this.config.httpPort!,
          app,
          streamKey,
        ),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.streams.set(streamId, stream);
    return stream;
  }

  /**
   * 删除流：仅从本地移除；nginx 端流会随推流断开自动消失
   */
  async deleteStream(streamId: string): Promise<void> {
    this.streams.delete(streamId);
  }

  /**
   * 获取流：先同步 stat 再查本地
   */
  async getStream(streamId: string): Promise<Stream | null> {
    try {
      await this.syncStreamsFromStat();
    } catch {
      // 忽略，用本地缓存
    }
    const stream = this.streams.get(streamId) ?? null;
    return stream;
  }

  /**
   * 列出流：先同步 stat 再分页返回
   */
  async listStreams(
    options?: { limit?: number; offset?: number },
  ): Promise<Stream[]> {
    try {
      await this.syncStreamsFromStat();
    } catch {
      // 忽略
    }
    const list = Array.from(this.streams.values());
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? list.length;
    return list.slice(offset, offset + limit);
  }

  /**
   * 创建推流器
   */
  async createPublisher(
    streamId: string,
    options?: PublisherOptions,
  ): Promise<Publisher> {
    const stream = await this.getStream(streamId);
    if (!stream) {
      throw new StreamNotFoundError(streamId);
    }
    const { ServerPublisher } = await import("../server/publisher.ts");
    return new ServerPublisher({ streamId, ...options });
  }

  /**
   * 创建拉流器
   */
  async createSubscriber(
    streamId: string,
    options?: SubscriberOptions,
  ): Promise<Subscriber> {
    const stream = await this.getStream(streamId);
    if (!stream) {
      throw new StreamNotFoundError(streamId);
    }
    const { ServerSubscriber } = await import("../server/subscriber.ts");
    return new ServerSubscriber({ streamId, ...options });
  }

  /**
   * 获取流统计：nginx-rtmp stat 无细粒度接口，返回基础信息
   */
  async getStatistics(streamId: string): Promise<StreamStatistics> {
    const stream = await this.getStream(streamId);
    if (!stream) {
      throw new StreamNotFoundError(streamId);
    }
    return {
      streamId,
      viewers: 0,
      bitrate: 0,
      fps: 0,
      resolution: { width: 0, height: 0 },
      uptime: 0,
    };
  }
}
