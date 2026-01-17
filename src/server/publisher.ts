/**
 * @fileoverview 服务端推流器实现
 *
 * 使用 Socket.io 进行信令通信，支持 RTMP、HLS 等协议推流
 */

import { Server, type SocketIOSocket } from "@dreamer/socket-io";
import type {
  MediaSource,
  Publisher,
  PublisherOptions,
  PublisherStatistics,
  PublisherStatus,
  VideoQuality,
} from "../types.ts";
import { PublisherStateError } from "../utils/errors.ts";
import { publishWithFFmpeg } from "../utils/ffmpeg.ts";
import { detectProtocol } from "../utils/protocol.ts";

/**
 * 服务端推流器选项
 */
export interface ServerPublisherOptions extends PublisherOptions {
  /** Socket.io 服务器实例（可选，如果不提供则创建新实例） */
  io?: Server;
  /** Socket.io 服务器端口（如果创建新实例） */
  port?: number;
  /** 流 ID */
  streamId: string;
}

/**
 * 服务端推流器
 *
 * 使用 Socket.io 进行信令通信，通过 FFmpeg 或其他工具进行实际推流
 */
export class ServerPublisher implements Publisher {
  streamId: string;
  status: PublisherStatus = "idle";
  private url?: string;
  private options?: PublisherOptions;
  private io?: Server;
  private quality?: VideoQuality;
  private audioEnabled = true;
  private videoEnabled = true;
  private loop?: boolean;
  private eventListeners: Map<string, Array<(data?: unknown) => void>> =
    new Map();
  private startTime?: number;
  private ffmpegProcess?: { stop: () => Promise<void> };

  constructor(options: ServerPublisherOptions) {
    this.streamId = options.streamId;
    this.options = options;
    this.io = options.io;
    this.quality = options.quality;
    this.audioEnabled = options.audioEnabled ?? true;
    this.videoEnabled = options.videoEnabled ?? true;
    this.loop = options.loop;
  }

  /**
   * 连接到推流服务器
   */
  async connect(url: string, options?: PublisherOptions): Promise<void> {
    if (this.status !== "idle") {
      throw new Error(`推流器状态错误，当前状态: ${this.status}`);
    }

    this.url = url;
    this.options = { ...this.options, ...options };
    // 更新循环播放选项
    if (options?.loop !== undefined) {
      this.loop = options.loop;
    }
    this.status = "connecting";

    try {
      // 初始化 Socket.io 服务器（如果未提供）
      if (!this.io) {
        const port = (this.options as ServerPublisherOptions)?.port || 3001;
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
   * 开始推流
   */
  async publish(source: MediaSource): Promise<void> {
    if (this.status !== "connected") {
      throw new PublisherStateError(
        this.streamId,
        this.status,
        "connected",
      );
    }

    if (!this.url) {
      throw new Error("推流 URL 未设置");
    }

    this.status = "publishing";
    this.startTime = Date.now();

    try {
      // 通过 Socket.io 发送推流开始信号
      if (this.io) {
        // 获取默认命名空间并广播推流开始事件
        const namespace = this.io.of("/");
        namespace.emit("stream:publish:start", {
          streamId: this.streamId,
          url: this.url,
          source: typeof source === "string" ? source : "[MediaSource]",
        });
      }

      // 实际推流逻辑
      if (typeof source === "string") {
        // 文件路径，使用 FFmpeg 推流
        const protocol = detectProtocol(this.url);
        if (protocol === "rtmp") {
          const process = await publishWithFFmpeg({
            input: source,
            output: this.url,
            quality: this.quality,
            audioEnabled: this.audioEnabled,
            videoEnabled: this.videoEnabled,
            loop: this.loop,
          });
          this.ffmpegProcess = process;

          // 记录流进程到适配器（如果可能）
          try {
            const manager = (globalThis as unknown as {
              __streamManager?: {
                adapter?: {
                  recordStreamProcess?: (
                    streamId: string,
                    process: unknown,
                  ) => void;
                };
              };
            }).__streamManager;
            if (manager?.adapter?.recordStreamProcess) {
              manager.adapter.recordStreamProcess(this.streamId, process);
            }
          } catch {
            // 忽略错误，这不是关键功能
          }
        } else if (protocol === "hls") {
          // HLS 推流需要先转换为 HLS 格式
          throw new Error("HLS 推流需要先使用 FFmpeg 将流转换为 HLS 格式");
        } else if (protocol === "webrtc") {
          // WebRTC 推流需要信令服务器
          throw new Error(
            "WebRTC 推流需要信令服务器支持，请使用专门的 WebRTC 适配器",
          );
        } else {
          throw new Error(`协议 ${protocol} 的推流尚未实现`);
        }
      } else {
        // MediaStream 或其他类型，需要特殊处理
        // 可以尝试将 MediaStream 保存为临时文件后推流
        throw new Error("MediaStream 推流尚未实现，请使用文件路径");
      }

      this.emitEvent("publishing", { streamId: this.streamId, url: this.url });
    } catch (error) {
      this.status = "error";
      this.emitEvent("error", { error, streamId: this.streamId });
      throw error;
    }
  }

  /**
   * 停止推流
   */
  async stop(): Promise<void> {
    if (this.status === "idle" || this.status === "stopped") {
      return;
    }

    const previousStatus = this.status;
    this.status = "stopped";

    try {
      // 先关闭 Socket.IO 服务器（释放端口），避免后续测试端口冲突
      // 这应该在停止 FFmpeg 之前完成，因为关闭服务器应该很快
      if (this.io) {
        const namespace = this.io.of("/");
        namespace.emit("stream:publish:stop", {
          streamId: this.streamId,
        });

        // 关闭 Socket.IO 服务器（释放端口）
        // 添加超时保护，确保即使关闭失败也不会阻塞太久
        try {
          await Promise.race([
            this.io.close(),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error("关闭服务器超时")), 2000);
            }),
          ]);
        } catch {
          // 忽略关闭错误（可能已经关闭了或超时）
          // 即使关闭失败，也要继续执行，确保端口能被释放
        }
        this.io = undefined;
      }

      // 停止 FFmpeg 进程（这可能会卡住，所以放在后面）
      if (this.ffmpegProcess) {
        // 添加超时保护，避免卡住
        try {
          await Promise.race([
            this.ffmpegProcess.stop(),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error("停止 FFmpeg 超时")), 3000);
            }),
          ]);
        } catch {
          // 如果超时，强制清理
          this.ffmpegProcess = undefined;
        }
        this.ffmpegProcess = undefined;
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
   * 设置视频质量
   */
  setVideoQuality(quality: VideoQuality): void {
    this.quality = quality;

    // 通过 Socket.io 发送质量更新信号
    if (this.io && this.status === "publishing") {
      const namespace = this.io.of("/");
      namespace.emit("stream:publish:quality", {
        streamId: this.streamId,
        quality,
      });
    }
  }

  /**
   * 设置音频启用状态
   */
  setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled;

    // 通过 Socket.io 发送音频状态更新信号
    if (this.io && this.status === "publishing") {
      const namespace = this.io.of("/");
      namespace.emit("stream:publish:audio", {
        streamId: this.streamId,
        enabled,
      });
    }
  }

  /**
   * 设置视频启用状态
   */
  setVideoEnabled(enabled: boolean): void {
    this.videoEnabled = enabled;

    // 通过 Socket.io 发送视频状态更新信号
    if (this.io && this.status === "publishing") {
      const namespace = this.io.of("/");
      namespace.emit("stream:publish:video", {
        streamId: this.streamId,
        enabled,
      });
    }
  }

  /**
   * 监听事件
   */
  on(
    event: "connecting" | "connected" | "publishing" | "disconnected" | "error",
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
    event: "connecting" | "connected" | "publishing" | "disconnected" | "error",
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
  getStatistics(): PublisherStatistics {
    const uptime = this.startTime ? Date.now() - this.startTime : 0;

    return {
      streamId: this.streamId,
      status: this.status,
      bitrate: this.quality?.bitrate || 0,
      fps: this.quality?.fps || 0,
      resolution: {
        width: this.quality?.width || 0,
        height: this.quality?.height || 0,
      },
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
      // 监听推流相关事件
      socket.on(`stream:publish:${this.streamId}:ack`, (data?: unknown) => {
        // 处理服务器确认
        this.emitEvent("connected", data);
      });

      socket.on(`stream:publish:${this.streamId}:error`, (data?: unknown) => {
        this.status = "error";
        this.emitEvent("error", data);
      });
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
