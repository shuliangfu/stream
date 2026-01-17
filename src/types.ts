/**
 * @fileoverview 流媒体库类型定义
 *
 * 定义所有流媒体相关的类型和接口
 */

/**
 * 流状态
 */
export type StreamStatus =
  | "idle"
  | "publishing"
  | "playing"
  | "stopped"
  | "error";

/**
 * 流协议
 */
export type StreamProtocol = "rtmp" | "hls" | "webrtc" | "dash" | "flv";

/**
 * 推流器状态
 */
export type PublisherStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "publishing"
  | "stopped"
  | "error";

/**
 * 拉流器状态
 */
export type SubscriberStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "playing"
  | "buffering"
  | "stopped"
  | "error";

/**
 * 视频质量
 */
export interface VideoQuality {
  width: number;
  height: number;
  bitrate: number;
  fps: number;
}

/**
 * 流选项
 */
export interface StreamOptions {
  name: string;
  roomId?: string;
  protocol: StreamProtocol;
  quality?: VideoQuality;
}

/**
 * 推流选项
 */
export interface PublisherOptions {
  url?: string;
  quality?: VideoQuality;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  /** 是否循环播放（true 表示无限循环，false 或不设置表示不循环，仅用于文件推流） */
  loop?: boolean;
}

/**
 * 拉流选项
 */
export interface SubscriberOptions {
  url?: string;
  quality?: string;
  autoplay?: boolean;
}

/**
 * 流对象
 */
export interface Stream {
  id: string;
  name: string;
  roomId?: string;
  status: StreamStatus;
  protocol: StreamProtocol;
  publisherUrl?: string;
  subscriberUrls: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 流统计信息
 */
export interface StreamStatistics {
  streamId: string;
  viewers: number;
  bitrate: number;
  fps: number;
  resolution: {
    width: number;
    height: number;
  };
  uptime: number;
}

/**
 * 房间选项
 */
export interface RoomOptions {
  name: string;
  description?: string;
  maxViewers?: number;
  isPrivate?: boolean;
}

/**
 * 房间对象
 */
export interface Room {
  id: string;
  name: string;
  description?: string;
  maxViewers?: number;
  isPrivate: boolean;
  streamIds: string[];
  viewerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 列表选项
 */
export interface ListOptions {
  limit?: number;
  offset?: number;
  filter?: Record<string, unknown>;
}

/**
 * 推流器统计信息
 */
export interface PublisherStatistics {
  streamId: string;
  status: PublisherStatus;
  bitrate: number;
  fps: number;
  resolution: {
    width: number;
    height: number;
  };
  uptime: number;
}

/**
 * 拉流器统计信息
 */
export interface SubscriberStatistics {
  streamId: string;
  status: SubscriberStatus;
  buffered: number;
  currentTime: number;
  duration: number;
  uptime: number;
}

/**
 * 媒体源类型
 * 服务端：文件路径（string）
 * 客户端：MediaStream、Blob、File
 */
export type MediaSource = string | Blob | File | {
  // 客户端 MediaStream 的简化表示
  getTracks(): Array<{ kind: string; enabled: boolean }>;
  [key: string]: unknown;
};

/**
 * 适配器配置
 */
export interface AdapterConfig {
  host?: string;
  port?: number;
  url?: string;
  [key: string]: unknown;
}

/**
 * 推流器接口
 */
export interface Publisher {
  streamId: string;
  status: PublisherStatus;

  /**
   * 连接到推流服务器
   */
  connect(url: string, options?: PublisherOptions): Promise<void>;

  /**
   * 开始推流
   */
  publish(source: MediaSource): Promise<void>;

  /**
   * 停止推流
   */
  stop(): Promise<void>;

  /**
   * 设置视频质量
   */
  setVideoQuality(quality: VideoQuality): void;

  /**
   * 设置音频启用状态
   */
  setAudioEnabled(enabled: boolean): void;

  /**
   * 设置视频启用状态
   */
  setVideoEnabled(enabled: boolean): void;

  /**
   * 监听事件
   */
  on(
    event: "connecting" | "connected" | "publishing" | "disconnected" | "error",
    callback: (data?: unknown) => void,
  ): void;

  /**
   * 移除事件监听器
   */
  off(
    event: "connecting" | "connected" | "publishing" | "disconnected" | "error",
    callback?: (data?: unknown) => void,
  ): void;

  /**
   * 清理所有事件监听器
   */
  removeAllListeners?(): void;

  /**
   * 获取统计信息
   */
  getStatistics(): PublisherStatistics;
}

/**
 * 拉流器接口
 */
export interface Subscriber {
  streamId: string;
  status: SubscriberStatus;

  /**
   * 连接到拉流服务器
   */
  connect(url: string, options?: SubscriberOptions): Promise<void>;

  /**
   * 开始拉流
   * 服务端返回文件路径或流对象
   * 客户端返回 MediaStream
   */
  subscribe(): Promise<unknown>;

  /**
   * 停止拉流
   */
  stop(): Promise<void>;

  /**
   * 播放（客户端）
   */
  play(): Promise<void>;

  /**
   * 暂停（客户端）
   */
  pause(): void;

  /**
   * 跳转到指定时间（客户端）
   */
  seek(time: number): void;

  /**
   * 设置质量（客户端）
   */
  setQuality(quality: string): void;

  /**
   * 监听事件
   */
  on(
    event:
      | "connecting"
      | "connected"
      | "playing"
      | "buffering"
      | "disconnected"
      | "error",
    callback: (data?: unknown) => void,
  ): void;

  /**
   * 移除事件监听器
   */
  off(
    event:
      | "connecting"
      | "connected"
      | "playing"
      | "buffering"
      | "disconnected"
      | "error",
    callback?: (data?: unknown) => void,
  ): void;

  /**
   * 清理所有事件监听器
   */
  removeAllListeners?(): void;

  /**
   * 获取统计信息
   */
  getStatistics(): SubscriberStatistics;
}
