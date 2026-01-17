/**
 * @fileoverview SRS (Simple Realtime Server) 流媒体适配器
 *
 * SRS 是一个开源的流媒体服务器，支持 RTMP、HLS、WebRTC、HTTP-FLV 等协议
 * 此适配器通过 SRS HTTP API 与服务器交互
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
import { generateId } from "../utils/id.ts";
import { generatePublisherUrl, generateSubscriberUrl } from "../utils/url.ts";
import type { StreamAdapter } from "./base.ts";
import { StreamNotFoundError, ConnectionError } from "../utils/errors.ts";

/**
 * SRS 适配器配置
 */
export interface SRSAdapterConfig extends AdapterConfig {
  /** SRS HTTP API 地址（默认: "http://localhost:1985"） */
  apiUrl?: string;
  /** RTMP 端口（默认: 1935） */
  rtmpPort?: number;
  /** HTTP 端口（默认: 8080） */
  httpPort?: number;
  /** WebRTC 端口（默认: 8000） */
  webrtcPort?: number;
  /** 应用名称（默认: "live"） */
  app?: string;
  /** API Token（如果需要认证） */
  token?: string;
}

/**
 * SRS 流信息（来自 SRS API）
 */
interface SRSStreamInfo {
  id: number;
  name: string;
  vhost: string;
  app: string;
  stream: string;
  client_id: number;
  ip: string;
  [key: string]: unknown;
}

/**
 * SRS 流媒体适配器
 *
 * 通过 SRS HTTP API 管理流
 */
export class SRSAdapter implements StreamAdapter {
  readonly name = "srs";
  private config: SRSAdapterConfig;
  private streams: Map<string, Stream> = new Map();
  private apiUrl: string;

  constructor(config?: SRSAdapterConfig) {
    this.config = {
      host: config?.host || "localhost",
      rtmpPort: config?.rtmpPort || 1935,
      httpPort: config?.httpPort || 8080,
      webrtcPort: config?.webrtcPort || 8000,
      app: config?.app || "live",
      apiUrl: config?.apiUrl || "http://localhost:1985",
      ...config,
    };
    this.apiUrl = this.config.apiUrl!;
  }

  /**
   * 连接到 SRS 服务器
   */
  async connect(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/api/v1/summaries`);
      if (!response.ok) {
        throw new Error(`SRS 服务器连接失败: ${response.statusText}`);
      }
    } catch (error) {
      throw new ConnectionError(
        `无法连接到 SRS 服务器 (${this.apiUrl}): ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    // SRS 使用 HTTP API，无需维护连接
  }

  /**
   * 调用 SRS API
   */
  private async callApi(
    endpoint: string,
    options?: RequestInit,
  ): Promise<unknown> {
    const url = `${this.apiUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string> || {}),
    };

    if (this.config.token) {
      headers["Authorization"] = `Bearer ${this.config.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`SRS API 调用失败: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 创建流
   */
  async createStream(options: StreamOptions): Promise<Stream> {
    const streamId = generateId("stream");
    const streamKey = `${streamId}`;

    const stream: Stream = {
      id: streamId,
      name: options.name,
      roomId: options.roomId,
      status: "idle",
      protocol: options.protocol,
      publisherUrl: generatePublisherUrl(
        options.protocol,
        this.config.host!,
        this.config.rtmpPort!,
        this.config.app!,
        streamKey,
      ),
      subscriberUrls: {
        rtmp: generateSubscriberUrl(
          "rtmp",
          this.config.host!,
          this.config.rtmpPort!,
          this.config.app!,
          streamKey,
        ),
        hls: generateSubscriberUrl(
          "hls",
          this.config.host!,
          this.config.httpPort!,
          this.config.app!,
          streamKey,
        ),
        flv: generateSubscriberUrl(
          "flv",
          this.config.host!,
          this.config.httpPort!,
          this.config.app!,
          streamKey,
        ),
        webrtc: generateSubscriberUrl(
          "webrtc",
          this.config.host!,
          this.config.webrtcPort!,
          this.config.app!,
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
   * 删除流
   */
  async deleteStream(streamId: string): Promise<void> {
    const stream = await this.getStream(streamId);
    if (!stream) {
      return;
    }

    // 从 SRS 服务器删除流（如果存在）
    try {
      // 提取流密钥（从 URL 中）
      const url = new URL(stream.publisherUrl || "");
      const streamKey = url.pathname.split("/").pop() || "";

      // 调用 SRS API 删除流
      await this.callApi(`/api/v1/streams/${streamKey}`, {
        method: "DELETE",
      });
    } catch (error) {
      // 忽略错误，流可能已经不存在
    }

    this.streams.delete(streamId);
  }

  /**
   * 获取流
   */
  async getStream(streamId: string): Promise<Stream | null> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      return null;
    }

    // 从 SRS 服务器获取实时流信息
    try {
      const streams = await this.callApi("/api/v1/streams") as {
        streams?: SRSStreamInfo[];
      };
      if (streams.streams) {
        // 更新流状态
        const srsStream = streams.streams.find((s) => s.stream === streamId);
        if (srsStream) {
          stream.status = "publishing";
        }
      }
    } catch (error) {
      // 忽略错误，使用本地流信息
    }

    return stream;
  }

  /**
   * 列出所有流
   */
  async listStreams(
    options?: { limit?: number; offset?: number },
  ): Promise<Stream[]> {
    // 从 SRS 服务器获取所有流
    try {
      const response = await this.callApi("/api/v1/streams") as {
        streams?: SRSStreamInfo[];
      };
      if (response.streams) {
        // 同步 SRS 流到本地
        for (const srsStream of response.streams) {
          const streamId = srsStream.stream;
          if (!this.streams.has(streamId)) {
            // 创建本地流对象
            const stream: Stream = {
              id: streamId,
              name: srsStream.name || streamId,
              status: "publishing",
              protocol: "rtmp",
              subscriberUrls: {},
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            this.streams.set(streamId, stream);
          }
        }
      }
    } catch (error) {
      // 忽略错误，返回本地流列表
    }

    const streams = Array.from(this.streams.values());
    const offset = options?.offset || 0;
    const limit = options?.limit || streams.length;
    return streams.slice(offset, offset + limit);
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

    // 导入服务端推流器
    const { ServerPublisher } = await import("../server/publisher.ts");

    return new ServerPublisher({
      streamId,
      ...options,
    });
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

    // 导入服务端拉流器
    const { ServerSubscriber } = await import("../server/subscriber.ts");

    return new ServerSubscriber({
      streamId,
      ...options,
    });
  }

  /**
   * 获取流统计信息
   */
  async getStatistics(streamId: string): Promise<StreamStatistics> {
    const stream = await this.getStream(streamId);
    if (!stream) {
      throw new StreamNotFoundError(streamId);
    }

    try {
      // 调用 SRS API 获取流统计信息
      const response = await this.callApi(`/api/v1/streams/${streamId}`) as {
        stream?: SRSStreamInfo;
        [key: string]: unknown;
      };

      if (response.stream) {
        return {
          streamId,
          viewers: 1, // SRS API 可能不提供观看人数
          bitrate: 0, // 需要从 SRS API 获取
          fps: 0, // 需要从 SRS API 获取
          resolution: {
            width: 0,
            height: 0,
          },
          uptime: 0,
        };
      }
    } catch (error) {
      // 返回默认统计信息
    }

    return {
      streamId,
      viewers: 0,
      bitrate: 0,
      fps: 0,
      resolution: {
        width: 0,
        height: 0,
      },
      uptime: 0,
    };
  }
}
