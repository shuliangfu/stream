/**
 * @fileoverview 服务端推流器实现
 *
 * 使用 Socket.io 进行信令通信，支持 RTMP、HLS 等协议推流。
 * 支持的媒体源：文件路径（string）、Blob、File；Blob/File 会先写入临时文件再推流。
 * 支持的协议：RTMP/FLV（FFmpeg 推流）、HLS（FFmpeg 转码为 m3u8+ts，通过 getHlsPlaylistPath 获取播放地址）。
 */

import {
  makeTempDir,
  makeTempFile,
  remove,
  writeFile,
} from "@dreamer/runtime-adapter";
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
import { publishWithFFmpeg, transcodeToHLS } from "../utils/ffmpeg.ts";
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
  /** RTMP/FLV 推流时的 FFmpeg 进程 */
  private ffmpegProcess?: { stop: () => Promise<void> };
  /** Blob/File 推流时写入的临时文件路径，stop 时删除 */
  private tempFilePath?: string;
  /** HLS 推流时的 m3u8 播放列表路径 */
  private hlsPlaylistPath?: string;
  /** HLS 转码输出临时目录，stop 时删除 */
  private hlsTempDir?: string;
  /** HLS 转码进程，stop 时终止 */
  private hlsProcess?: { stop: () => Promise<void> };

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
   * 将 MediaSource 解析为本地文件路径
   * 若为 string 则直接返回；若为 Blob/File 则写入临时文件后返回路径，并记录 tempPath 供 stop 时删除
   *
   * @param source 媒体源（文件路径、Blob、File）
   * @returns 本地文件路径及可选的临时路径（需在 stop 时删除）
   */
  private async resolveMediaSourceToFilePath(source: MediaSource): Promise<{
    path: string;
    tempPath?: string;
  }> {
    if (typeof source === "string") {
      return { path: source };
    }
    // Blob 或 File：写入临时文件
    const blob = source as Blob;
    const ext = this.getExtensionForBlob(blob);
    const tempPath = await makeTempFile({ prefix: "stream-", suffix: ext });
    const arrayBuffer = await blob.arrayBuffer();
    await writeFile(tempPath, new Uint8Array(arrayBuffer));
    this.tempFilePath = tempPath;
    return { path: tempPath, tempPath };
  }

  /**
   * 根据 Blob/File 的 type 或 name 推断文件扩展名
   */
  private getExtensionForBlob(blob: Blob): string {
    if (blob instanceof File && blob.name && blob.name.includes(".")) {
      return blob.name.slice(blob.name.lastIndexOf("."));
    }
    const mime = blob.type?.toLowerCase() || "";
    if (mime.includes("mp4") || mime === "video/mp4") return ".mp4";
    if (mime.includes("webm")) return ".webm";
    if (mime.includes("ogg")) return ".ogv";
    if (mime.includes("quicktime")) return ".mov";
    return ".mp4";
  }

  /**
   * HLS 推流时获取生成的 m3u8 播放列表路径，供应用层通过 HTTP 提供播放
   *
   * @returns 播放列表路径，非 HLS 推流或未就绪时为 undefined
   */
  getHlsPlaylistPath(): string | undefined {
    return this.hlsPlaylistPath;
  }

  /**
   * 开始推流
   *
   * 支持媒体源：文件路径（string）、Blob、File。
   * 支持协议：RTMP/FLV（推流到服务器）、HLS（转码为 m3u8+ts，通过 getHlsPlaylistPath 获取路径后由应用提供 HTTP 播放）。
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
      // 服务端不支持 MediaStream（浏览器 API），仅支持文件路径、Blob、File
      if (
        typeof source !== "string" &&
        !(source instanceof Blob)
      ) {
        throw new Error(
          "服务端推流仅支持文件路径、Blob、File；MediaStream 请使用客户端推流器",
        );
      }
      // 将 Blob/File 转为临时文件路径（string 直接使用）
      const { path: filePath } = await this.resolveMediaSourceToFilePath(
        source,
      );

      // 通过 Socket.io 发送推流开始信号
      if (this.io) {
        const namespace = this.io.of("/");
        namespace.emit("stream:publish:start", {
          streamId: this.streamId,
          url: this.url,
          source: typeof source === "string" ? source : "[Blob/File]",
        });
      }

      const protocol = detectProtocol(this.url);

      if (protocol === "rtmp" || protocol === "flv") {
        const process = await publishWithFFmpeg({
          input: filePath,
          output: this.url,
          quality: this.quality,
          audioEnabled: this.audioEnabled,
          videoEnabled: this.videoEnabled,
          loop: this.loop,
        });
        this.ffmpegProcess = process;
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
        this.hlsTempDir = await makeTempDir({ prefix: "stream-hls-" });
        const result = await transcodeToHLS(filePath, this.hlsTempDir, {
          quality: this.quality,
          loop: this.loop,
        });
        this.hlsPlaylistPath = result.playlistPath;
        this.hlsProcess = result;
      } else if (protocol === "webrtc") {
        throw new Error(
          "WebRTC 推流需要信令服务器支持，请使用专门的 WebRTC 适配器",
        );
      } else {
        throw new Error(`协议 ${protocol} 的推流尚未实现`);
      }

      this.emitEvent("publishing", {
        streamId: this.streamId,
        url: this.url,
        hlsPlaylistPath: this.hlsPlaylistPath,
      });
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

      // 停止 HLS 转码进程并删除临时目录
      if (this.hlsProcess) {
        try {
          await Promise.race([
            this.hlsProcess.stop(),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error("停止 HLS 超时")), 3000);
            }),
          ]);
        } catch {
          // ignore
        }
        this.hlsProcess = undefined;
      }
      if (this.hlsTempDir) {
        try {
          await remove(this.hlsTempDir, { recursive: true });
        } catch {
          // ignore
        }
        this.hlsTempDir = undefined;
        this.hlsPlaylistPath = undefined;
      }

      // 停止 RTMP/FLV FFmpeg 进程（这可能会卡住，所以放在后面）
      if (this.ffmpegProcess) {
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

      // 删除 Blob/File 推流时创建的临时文件
      if (this.tempFilePath) {
        try {
          await remove(this.tempFilePath);
        } catch {
          // ignore
        }
        this.tempFilePath = undefined;
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
