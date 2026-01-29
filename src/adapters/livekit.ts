/**
 * @fileoverview LiveKit 流媒体适配器
 *
 * 将 LiveKit Room 映射为流：createStream = CreateRoom，listStreams = ListRooms，
 * 推拉流需配合 LiveKit SDK 与 token 使用，publisherUrl/subscriberUrls 为房间信息供前端连接。
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
import type { StreamAdapter } from "./base.ts";
import { ConnectionError, StreamNotFoundError } from "../utils/errors.ts";

/**
 * LiveKit 适配器配置
 */
export interface LiveKitAdapterConfig extends AdapterConfig {
  /** LiveKit 服务地址（如 https://my.livekit.cloud 或 http://localhost:7880） */
  host?: string;
  /** API Key（项目设置中获取） */
  apiKey?: string;
  /** API Secret（项目设置中获取） */
  apiSecret?: string;
  /** 是否使用 TLS（默认根据 host 的 protocol 判断） */
  useTls?: boolean;
}

/** LiveKit Room 类型（API 返回） */
interface LiveKitRoom {
  sid?: string;
  name?: string;
  num_participants?: number;
  creation_time?: number;
  metadata?: string;
  [key: string]: unknown;
}

/**
 * 使用 HMAC-SHA256 生成 JWT（仅用于 LiveKit API 认证）
 * 格式: base64url(header).base64url(payload).base64url(signature)
 */
async function createLiveKitJwt(
  apiKey: string,
  apiSecret: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: apiKey,
    exp: now + expiresInSeconds,
    nbf: now,
    video: { roomAdmin: true, roomCreate: true, roomList: true },
  };

  const base64url = (data: string): string =>
    btoa(data)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const encoder = new TextEncoder();
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const message = `${headerB64}.${payloadB64}`;

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  const sigB64 = base64url(
    String.fromCharCode(...new Uint8Array(signature)),
  );
  return `${message}.${sigB64}`;
}

/**
 * 调用 LiveKit RoomService Twirp API
 */
async function callLiveKitApi(
  baseUrl: string,
  token: string,
  method: string,
  body: Record<string, unknown> = {},
): Promise<unknown> {
  const url = `${
    baseUrl.replace(/\/$/, "")
  }/twirp/livekit.RoomService/${method}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ConnectionError(
      `LiveKit API ${method} 失败: ${response.status} ${text}`,
    );
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return await response.json();
  }
  return await response.text();
}

/**
 * LiveKit 流媒体适配器
 *
 * 流与 LiveKit Room 一一对应；实际推拉流需使用 LiveKit 前端/服务端 SDK 配合 token。
 */
export class LiveKitAdapter implements StreamAdapter {
  readonly name = "livekit";
  private config: LiveKitAdapterConfig;
  /** 本地缓存的流（Room 名 -> Stream） */
  private streams: Map<string, Stream> = new Map();
  private baseUrl: string;

  constructor(config?: LiveKitAdapterConfig) {
    this.config = {
      host: config?.host || "http://localhost:7880",
      apiKey: config?.apiKey || "",
      apiSecret: config?.apiSecret || "",
      ...config,
    };
    const host = this.config.host!;
    this.baseUrl = host.startsWith("http") ? host : `https://${host}`;
  }

  /**
   * 获取 API 用 JWT
   */
  private async getToken(): Promise<string> {
    const { apiKey, apiSecret } = this.config;
    if (!apiKey || !apiSecret) {
      throw new ConnectionError("LiveKit 需配置 apiKey 和 apiSecret");
    }
    return await createLiveKitJwt(apiKey, apiSecret);
  }

  /**
   * 连接：调用 ListRooms 校验配置
   */
  async connect(): Promise<void> {
    try {
      const token = await this.getToken();
      await callLiveKitApi(this.baseUrl, token, "ListRooms", {});
    } catch (error) {
      throw new ConnectionError(
        `无法连接 LiveKit (${this.baseUrl}): ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async disconnect(): Promise<void> {}

  /**
   * 创建流：在 LiveKit 创建 Room，并登记为 Stream
   */
  async createStream(options: StreamOptions): Promise<Stream> {
    const roomName = options.name || generateId("stream");
    const token = await this.getToken();

    await callLiveKitApi(this.baseUrl, token, "CreateRoom", {
      name: roomName,
      empty_timeout: 300,
      departure_timeout: 20,
    });

    const wsProtocol = this.baseUrl.startsWith("https") ? "wss" : "ws";
    const wsHost = this.baseUrl.replace(/^https?:\/\//, "");

    const stream: Stream = {
      id: roomName,
      name: options.name || roomName,
      roomId: options.roomId,
      status: "idle",
      protocol: "webrtc",
      publisherUrl: `${wsProtocol}://${wsHost}`,
      subscriberUrls: {
        webrtc: `${wsProtocol}://${wsHost}`,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.streams.set(roomName, stream);
    return stream;
  }

  /**
   * 删除流：调用 DeleteRoom 并移除本地缓存
   */
  async deleteStream(streamId: string): Promise<void> {
    try {
      const token = await this.getToken();
      await callLiveKitApi(this.baseUrl, token, "DeleteRoom", {
        room: streamId,
      });
    } catch {
      // 房间可能已不存在
    }
    this.streams.delete(streamId);
  }

  /**
   * 获取流：先 ListRooms 同步，再查本地
   */
  async getStream(streamId: string): Promise<Stream | null> {
    try {
      const token = await this.getToken();
      const res = await callLiveKitApi(this.baseUrl, token, "ListRooms", {
        names: [streamId],
      }) as { rooms?: LiveKitRoom[] };
      if (res.rooms?.length) {
        const room = res.rooms[0];
        const wsProtocol = this.baseUrl.startsWith("https") ? "wss" : "ws";
        const wsHost = this.baseUrl.replace(/^https?:\/\//, "");
        const stream: Stream = {
          id: room.name || streamId,
          name: room.name || streamId,
          status: (room.num_participants ?? 0) > 0 ? "publishing" : "idle",
          protocol: "webrtc",
          publisherUrl: `${wsProtocol}://${wsHost}`,
          subscriberUrls: { webrtc: `${wsProtocol}://${wsHost}` },
          createdAt: new Date((room.creation_time ?? 0) * 1000),
          updatedAt: new Date(),
        };
        this.streams.set(streamId, stream);
        return stream;
      }
    } catch {
      // 忽略，返回本地缓存
    }
    return this.streams.get(streamId) ?? null;
  }

  /**
   * 列出流：调用 ListRooms 并转为 Stream[]
   */
  async listStreams(
    options?: { limit?: number; offset?: number },
  ): Promise<Stream[]> {
    try {
      const token = await this.getToken();
      const res = await callLiveKitApi(
        this.baseUrl,
        token,
        "ListRooms",
        {},
      ) as {
        rooms?: LiveKitRoom[];
      };
      const wsProtocol = this.baseUrl.startsWith("https") ? "wss" : "ws";
      const wsHost = this.baseUrl.replace(/^https?:\/\//, "");
      if (res.rooms) {
        for (const room of res.rooms) {
          const name = room.name || "";
          if (!name) continue;
          const stream: Stream = {
            id: name,
            name,
            status: (room.num_participants ?? 0) > 0 ? "publishing" : "idle",
            protocol: "webrtc",
            publisherUrl: `${wsProtocol}://${wsHost}`,
            subscriberUrls: { webrtc: `${wsProtocol}://${wsHost}` },
            createdAt: new Date((room.creation_time ?? 0) * 1000),
            updatedAt: new Date(),
          };
          this.streams.set(name, stream);
        }
      }
    } catch {
      // 忽略
    }
    const list = Array.from(this.streams.values());
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? list.length;
    return list.slice(offset, offset + limit);
  }

  /**
   * 创建推流器：返回 ServerPublisher，实际推流需用 LiveKit SDK + token
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
   * 创建拉流器：返回 ServerSubscriber，实际拉流需用 LiveKit SDK + token
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
   * 获取流统计：从 ListRooms 的 room 信息映射
   */
  async getStatistics(streamId: string): Promise<StreamStatistics> {
    const stream = await this.getStream(streamId);
    if (!stream) {
      throw new StreamNotFoundError(streamId);
    }
    try {
      const token = await this.getToken();
      const res = await callLiveKitApi(this.baseUrl, token, "ListRooms", {
        names: [streamId],
      }) as { rooms?: LiveKitRoom[] };
      const room = res.rooms?.[0];
      const numParticipants = room?.num_participants ?? 0;
      const creationTime = room?.creation_time ?? 0;
      const uptime = creationTime
        ? Math.floor(Date.now() / 1000 - creationTime)
        : 0;
      return {
        streamId,
        viewers: numParticipants,
        bitrate: 0,
        fps: 0,
        resolution: { width: 0, height: 0 },
        uptime,
      };
    } catch {
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
}
