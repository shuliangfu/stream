/**
 * @fileoverview 服务端拉流器实现
 *
 * 使用 Socket.io 进行信令通信，支持 RTMP、HLS、FLV 等协议拉流
 */

import { Server, type SocketIOSocket } from "@dreamer/socket-io";
import type {
  Subscriber,
  SubscriberOptions,
  SubscriberStatistics,
  SubscriberStatus,
} from "../types.ts";
import { SubscriberStateError } from "../utils/errors.ts";
import { subscribeWithFFmpeg } from "../utils/ffmpeg.ts";
import { detectProtocol } from "../utils/protocol.ts";

/**
 * 服务端拉流器选项
 */
export interface ServerSubscriberOptions extends SubscriberOptions {
  /** Socket.io 服务器实例（可选，如果不提供则创建新实例） */
  io?: Server;
  /** Socket.io 服务器端口（如果创建新实例） */
  port?: number;
  /** 流 ID */
  streamId: string;
}

/**
 * 服务端拉流器
 *
 * 使用 Socket.io 进行信令通信，通过 FFmpeg 或其他工具进行实际拉流
 */
export class ServerSubscriber implements Subscriber {
  streamId: string;
  status: SubscriberStatus = "idle";
  private url?: string;
  private options?: SubscriberOptions;
  private io?: Server;
  private quality?: string;
  private eventListeners: Map<string, Array<(data?: unknown) => void>> =
    new Map();
  private startTime?: number;
  private buffered = 0;
  private currentTime = 0;
  private duration = 0;
  private ffmpegProcess?: { stop: () => Promise<void> };

  constructor(options: ServerSubscriberOptions) {
    this.streamId = options.streamId;
    this.options = options;
    this.io = options.io;
    this.quality = options.quality;
  }

  /**
   * 连接到拉流服务器
   */
  async connect(url: string, options?: SubscriberOptions): Promise<void> {
    if (this.status !== "idle") {
      throw new Error(`拉流器状态错误，当前状态: ${this.status}`);
    }

    this.url = url;
    this.options = { ...this.options, ...options };
    this.status = "connecting";

    try {
      // 初始化 Socket.io 服务器（如果未提供）
      if (!this.io) {
        const port = (this.options as ServerSubscriberOptions)?.port || 3001;
        this.io = new Server({
          port,
          path: "/stream-signaling/",
        });
        await this.io.listen();
      }

      // 设置 Socket.io 事件监听
      this.setupSocketIOListeners();

      // 发送连接请求
      this.emitEvent("connecting", { url, streamId: this.streamId });

      // 模拟连接过程（实际应该等待服务器确认）
      await new Promise((resolve) => setTimeout(resolve, 100));

      this.status = "connected";
      this.emitEvent("connected", { url, streamId: this.streamId });
    } catch (error) {
      this.status = "error";
      this.emitEvent("error", { error, streamId: this.streamId });
      throw error;
    }
  }

  /**
   * 开始拉流
   */
  async subscribe(): Promise<unknown> {
    if (this.status !== "connected") {
      throw new SubscriberStateError(
        this.streamId,
        this.status,
        "connected",
      );
    }

    if (!this.url) {
      throw new Error("拉流 URL 未设置");
    }

    this.status = "playing";
    this.startTime = Date.now();

    try {
      // 通过 Socket.io 发送拉流开始信号
      if (this.io) {
        const namespace = this.io.of("/");
        namespace.emit("stream:subscribe:start", {
          streamId: this.streamId,
          url: this.url,
          quality: this.quality,
        });
      }

      // 实际拉流逻辑
      const protocol = detectProtocol(this.url);
      let outputPath: string;

      if (protocol === "rtmp" || protocol === "flv") {
        // RTMP/FLV 使用 FFmpeg 拉流并保存到文件
        const { makeTempFile } = await import("@dreamer/runtime-adapter");
        outputPath = await makeTempFile({ suffix: ".flv" });

        const process = await subscribeWithFFmpeg({
          input: this.url,
          output: outputPath,
        });
        this.ffmpegProcess = process;
      } else if (protocol === "hls") {
        // HLS 直接返回 URL，由客户端播放
        outputPath = this.url;
      } else if (protocol === "dash") {
        // DASH 直接返回 URL，由客户端播放
        outputPath = this.url;
      } else if (protocol === "webrtc") {
        // WebRTC 需要信令服务器
        throw new Error("WebRTC 拉流需要信令服务器支持，请使用客户端拉流器");
      } else {
        throw new Error(`协议 ${protocol} 的拉流尚未实现`);
      }

      this.emitEvent("playing", { streamId: this.streamId, url: this.url });

      // 返回流对象
      return {
        streamId: this.streamId,
        url: this.url,
        outputPath,
        type: "stream",
        protocol,
      };
    } catch (error) {
      this.status = "error";
      this.emitEvent("error", { error, streamId: this.streamId });
      throw error;
    }
  }

  /**
   * 停止拉流
   */
  async stop(): Promise<void> {
    if (this.status === "idle" || this.status === "stopped") {
      return;
    }

    const previousStatus = this.status;
    this.status = "stopped";

    try {
      // 停止 FFmpeg 进程
      if (this.ffmpegProcess) {
        await this.ffmpegProcess.stop();
        this.ffmpegProcess = undefined;
      }

      // 通过 Socket.io 发送拉流停止信号
      if (this.io) {
        const namespace = this.io.of("/");
        namespace.emit("stream:subscribe:stop", {
          streamId: this.streamId,
        });
      }

      // 清理所有事件监听器（防止内存泄漏）
      this.removeAllListeners();

      this.emitEvent("disconnected", { streamId: this.streamId });
    } catch (error) {
      this.status = previousStatus;
      this.emitEvent("error", { error, streamId: this.streamId });
      throw error;
    }
  }

  /**
   * 播放（客户端）
   */
  async play(): Promise<void> {
    if (this.status === "playing") {
      return;
    }

    if (this.status !== "connected") {
      throw new Error(`拉流器未连接，当前状态: ${this.status}`);
    }

    this.status = "playing";

    // 通过 Socket.io 发送播放信号
    if (this.io) {
      const namespace = this.io.of("/");
      namespace.emit("stream:subscribe:play", {
        streamId: this.streamId,
      });
    }

    this.emitEvent("playing", { streamId: this.streamId });
  }

  /**
   * 暂停（客户端）
   */
  pause(): void {
    if (this.status !== "playing") {
      return;
    }

    this.status = "buffering";

    // 通过 Socket.io 发送暂停信号
    if (this.io) {
      const namespace = this.io.of("/");
      namespace.emit("stream:subscribe:pause", {
        streamId: this.streamId,
      });
    }

    this.emitEvent("buffering", { streamId: this.streamId });
  }

  /**
   * 跳转到指定时间（客户端）
   */
  seek(time: number): void {
    this.currentTime = time;

    // 通过 Socket.io 发送跳转信号
    if (this.io) {
      const namespace = this.io.of("/");
      namespace.emit("stream:subscribe:seek", {
        streamId: this.streamId,
        time,
      });
    }
  }

  /**
   * 设置质量（客户端）
   */
  setQuality(quality: string): void {
    this.quality = quality;

    // 通过 Socket.io 发送质量更新信号
    if (this.io && this.status === "playing") {
      const namespace = this.io.of("/");
      namespace.emit("stream:subscribe:quality", {
        streamId: this.streamId,
        quality,
      });
    }
  }

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
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * 移除事件监听器
   *
   * @param event 事件名称
   * @param callback 回调函数（可选，不提供则移除该事件的所有监听器）
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
  ): void {
    if (!this.eventListeners.has(event)) {
      return;
    }

    if (callback) {
      const listeners = this.eventListeners.get(event)!;
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
      if (listeners.length === 0) {
        this.eventListeners.delete(event);
      }
    } else {
      this.eventListeners.delete(event);
    }
  }

  /**
   * 清理所有事件监听器
   */
  removeAllListeners(): void {
    this.eventListeners.clear();
  }

  /**
   * 获取统计信息
   */
  getStatistics(): SubscriberStatistics {
    const uptime = this.startTime ? Date.now() - this.startTime : 0;

    return {
      streamId: this.streamId,
      status: this.status,
      buffered: this.buffered,
      currentTime: this.currentTime,
      duration: this.duration,
      uptime,
    };
  }

  /**
   * 设置 Socket.io 事件监听
   */
  private setupSocketIOListeners(): void {
    if (!this.io) {
      return;
    }

    this.io.on("connection", (socket: SocketIOSocket) => {
      // 监听拉流相关事件
      socket.on(`stream:subscribe:${this.streamId}:ack`, (data?: unknown) => {
        // 处理服务器确认
        this.emitEvent("connected", data);
      });

      socket.on(`stream:subscribe:${this.streamId}:error`, (data?: unknown) => {
        this.status = "error";
        this.emitEvent("error", data);
      });

      socket.on(
        `stream:subscribe:${this.streamId}:stats`,
        (
          data?: { buffered?: number; currentTime?: number; duration?: number },
        ) => {
          // 更新统计信息
          if (data?.buffered !== undefined) {
            this.buffered = data.buffered;
          }
          if (data?.currentTime !== undefined) {
            this.currentTime = data.currentTime;
          }
          if (data?.duration !== undefined) {
            this.duration = data.duration;
          }
        },
      );
    });
  }

  /**
   * 触发事件
   */
  private emitEvent(event: string, data?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (error) {
          console.error(`事件监听器错误 (${event}):`, error);
        }
      }
    }
  }
}
