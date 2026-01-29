/**
 * @module @dreamer/stream
 *
 * @fileoverview 直播流媒体库
 *
 * 提供完整的直播推流、拉流、管理和处理功能。
 * 支持多种流媒体协议（RTMP、HLS、WebRTC、DASH、FLV）和服务器（SRS、nginx-rtmp、LiveKit）。
 *
 * 功能特性：
 * - 推流功能：将视频流推送到流媒体服务器
 * - 拉流功能：从流媒体服务器拉取视频流
 * - 流管理：创建、删除、查询流资源
 * - 房间管理：管理直播房间和频道
 * - 录制功能：录制直播流
 * - 转码功能：实时转码和多码率输出
 * - 多协议支持：RTMP、HLS、WebRTC、DASH、FLV
 * - 服务端和客户端：同时支持服务端流管理和客户端推拉流
 *
 * @example
 * ```typescript
 * import { StreamManager } from "jsr:@dreamer/stream";
 *
 * // 创建流管理器
 * const manager = new StreamManager({
 *   adapter: "srs",
 *   server: {
 *     host: "localhost",
 *     port: 1985,
 *   },
 * });
 *
 * // 创建流
 * const stream = await manager.createStream({
 *   name: "my-stream",
 *   protocol: "rtmp",
 * });
 *
 * // 开始推流
 * const publisher = await manager.createPublisher(stream.id);
 * await publisher.connect(stream.publisherUrl);
 * await publisher.publish(mediaStream);
 * ```
 */

// 导出类型
export type {
  AdapterConfig,
  ListOptions,
  MediaSource,
  Publisher,
  PublisherOptions,
  PublisherStatistics,
  PublisherStatus,
  Room,
  RoomOptions,
  Stream,
  StreamOptions,
  StreamProtocol,
  StreamStatistics,
  StreamStatus,
  Subscriber,
  SubscriberOptions,
  SubscriberStatistics,
  SubscriberStatus,
  VideoQuality,
} from "./types.ts";

// 导出管理器
export {
  StreamManager,
  type StreamManagerOptions,
  type SupportedAdapterType,
} from "./manager.ts";

// 导出适配器
export type { AdapterOptions, StreamAdapter } from "./adapters/base.ts";
export { FFmpegAdapter, type FFmpegAdapterConfig } from "./adapters/ffmpeg.ts";
export { SRSAdapter, type SRSAdapterConfig } from "./adapters/srs.ts";

// 导出服务端推流和拉流
export {
  ServerPublisher,
  type ServerPublisherOptions,
} from "./server/publisher.ts";
export {
  ServerSubscriber,
  type ServerSubscriberOptions,
} from "./server/subscriber.ts";

// 导出客户端推流和拉流
export {
  ClientPublisher,
  type ClientPublisherOptions,
} from "./client/publisher.ts";
export {
  ClientSubscriber,
  type ClientSubscriberOptions,
} from "./client/subscriber.ts";

// 导出工具函数
export { type CacheOptions, LRUCache } from "./utils/cache.ts";
export {
  ConnectionPool,
  type ConnectionPoolOptions,
} from "./utils/connection-pool.ts";
export * from "./utils/errors.ts";
export {
  type FFmpegPublishOptions,
  type FFmpegSubscribeOptions,
  publishWithFFmpeg,
  subscribeWithFFmpeg,
  transcodeToHLS,
  type TranscodeToHLSOptions,
} from "./utils/ffmpeg.ts";
export { generateId, generateRoomId, generateStreamId } from "./utils/id.ts";
export * from "./utils/protocol.ts";
export { DataQueue, type QueueOptions } from "./utils/queue.ts";
export { ReconnectManager, type ReconnectOptions } from "./utils/reconnect.ts";
export {
  type RecordingOptions,
  type RecordingResult,
  recordStream,
  recordStreamRealtime,
} from "./utils/recording.ts";
export * from "./utils/state.ts";
export { StreamCache, type StreamCacheOptions } from "./utils/stream-cache.ts";
export {
  generateFlvUrl,
  generateHlsUrl,
  generatePublisherUrl,
  generateRtmpUrl,
  generateSubscriberUrl,
  generateWebRtcUrl,
} from "./utils/url.ts";
