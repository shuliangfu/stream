/**
 * @fileoverview 客户端拉流器实现
 *
 * 浏览器端拉流功能，支持 HLS、FLV、WebRTC 等协议
 */

import type {
  Subscriber,
  SubscriberOptions,
  SubscriberStatistics,
  SubscriberStatus,
} from "../types.ts";

/**
 * 视频元素接口（兼容 HTMLVideoElement）
 */
interface VideoElement {
  src: string;
  srcObject: MediaStream | null;
  currentTime: number;
  duration: number;
  paused: boolean;
  buffered: TimeRanges;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  canPlayType(type: string): string;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

/**
 * 时间范围接口
 */
interface TimeRanges {
  length: number;
  start(index: number): number;
  end(index: number): number;
}

/**
 * WebRTC 相关接口
 */
interface RTCPeerConnection {
  setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
  setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
  createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit>;
  ontrack: ((event: RTCTrackEvent) => void) | null;
  oniceconnectionstatechange: (() => void) | null;
  iceConnectionState: string;
  close(): void;
}

interface RTCSessionDescriptionInit {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp?: string;
}

interface RTCOfferOptions {
  offerToReceiveAudio?: boolean;
  offerToReceiveVideo?: boolean;
}

interface RTCTrackEvent {
  streams: ReadableStream[];
}

interface RTCConfiguration {
  iceServers?: Array<{ urls: string | string[] }>;
}

/**
 * 媒体流接口（兼容 MediaStream）
 */
interface MediaStream {
  getTracks(): MediaStreamTrack[];
  getAudioTracks(): MediaStreamTrack[];
  getVideoTracks(): MediaStreamTrack[];
}

/**
 * 媒体流轨道接口
 */
interface MediaStreamTrack {
  enabled: boolean;
  kind: string;
  stop(): void;
}

/**
 * 客户端拉流器选项
 */
export interface ClientSubscriberOptions extends SubscriberOptions {
  /** 视频元素（用于播放） */
  videoElement: VideoElement;
  /** 是否自动播放 */
  autoplay?: boolean;
}

/**
 * 客户端拉流器
 *
 * 使用浏览器原生 API 或第三方库（hls.js、flv.js）进行拉流
 */
export class ClientSubscriber implements Subscriber {
  streamId: string;
  status: SubscriberStatus = "idle";
  private url?: string;
  private options: ClientSubscriberOptions;
  private quality?: string;
  private eventListeners: Map<string, Array<(data?: unknown) => void>> =
    new Map();
  private startTime?: number;
  private videoElement?: VideoElement;
  private hls?: any; // hls.js 实例
  private flvPlayer?: any; // flv.js 实例
  private pc?: RTCPeerConnection; // WebRTC peer connection

  constructor(streamId: string, options: ClientSubscriberOptions) {
    this.streamId = streamId;
    this.options = options;
    this.quality = options.quality;
    this.videoElement = options.videoElement;
  }

  /**
   * 连接到拉流服务器
   */
  async connect(url: string, options?: SubscriberOptions): Promise<void> {
    if (this.status !== "idle") {
      throw new Error(`拉流器状态错误，当前状态: ${this.status}`);
    }

    this.url = url;
    // 合并选项，但保留必需的 videoElement
    this.options = {
      ...this.options,
      ...options,
      videoElement: this.options.videoElement, // 确保 videoElement 不被覆盖
    };
    this.status = "connecting";

    try {
      if (!this.videoElement) {
        throw new Error("视频元素未设置");
      }

      // 根据 URL 协议选择播放方式
      const protocol = this.detectProtocol(url);

      switch (protocol) {
        case "hls":
          await this.setupHLS(url);
          break;
        case "flv":
          await this.setupFLV(url);
          break;
        case "webrtc":
          await this.setupWebRTC(url);
          break;
        default:
          // 使用原生 video 元素播放
          this.videoElement.src = url;
          break;
      }

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
  subscribe(): Promise<unknown> {
    if (this.status !== "connected") {
      return Promise.reject(
        new Error(`拉流器未连接，当前状态: ${this.status}`),
      );
    }

    if (!this.url) {
      return Promise.reject(new Error("拉流 URL 未设置"));
    }

    this.status = "playing";
    this.startTime = Date.now();

    return this.play()
      .then(() => {
        this.emitEvent("playing", { streamId: this.streamId, url: this.url });
        return this.videoElement;
      })
      .catch((error) => {
        this.status = "error";
        this.emitEvent("error", { error, streamId: this.streamId });
        throw error;
      });
  }

  /**
   * 停止拉流
   */
  stop(): Promise<void> {
    if (this.status === "idle" || this.status === "stopped") {
      return Promise.resolve();
    }

    const previousStatus = this.status;
    this.status = "stopped";

    try {
      // 停止播放
      if (this.videoElement) {
        this.videoElement.pause();
        this.videoElement.src = "";
      }

      // 清理 HLS
      if (this.hls) {
        this.hls.destroy();
        this.hls = null;
      }

      // 清理 FLV
      if (this.flvPlayer) {
        this.flvPlayer.destroy();
        this.flvPlayer = null;
      }

      // 清理 WebRTC
      if (this.pc) {
        this.pc.close();
        this.pc = undefined;
      }

      // 清理所有事件监听器（防止内存泄漏）
      this.removeAllListeners();

      this.emitEvent("disconnected", { streamId: this.streamId });
      return Promise.resolve();
    } catch (error) {
      this.status = previousStatus;
      this.emitEvent("error", { error, streamId: this.streamId });
      return Promise.reject(error);
    }
  }

  /**
   * 播放（客户端）
   */
  play(): Promise<void> {
    if (this.status === "playing") {
      return Promise.resolve();
    }

    if (this.status !== "connected" && this.status !== "buffering") {
      return Promise.reject(
        new Error(`拉流器未连接，当前状态: ${this.status}`),
      );
    }

    if (!this.videoElement) {
      return Promise.reject(new Error("视频元素未设置"));
    }

    this.status = "playing";

    return this.videoElement.play()
      .then(() => {
        this.emitEvent("playing", { streamId: this.streamId });
      })
      .catch((error) => {
        this.status = "buffering";
        this.emitEvent("buffering", { streamId: this.streamId, error });
        throw error;
      });
  }

  /**
   * 暂停（客户端）
   */
  pause(): void {
    if (this.status !== "playing") {
      return;
    }

    if (this.videoElement) {
      this.videoElement.pause();
    }

    this.status = "buffering";
    this.emitEvent("buffering", { streamId: this.streamId });
  }

  /**
   * 跳转到指定时间（客户端）
   */
  seek(time: number): void {
    if (this.videoElement) {
      this.videoElement.currentTime = time;
    }
  }

  /**
   * 设置质量（客户端）
   */
  setQuality(quality: string): void {
    this.quality = quality;

    // 如果是 HLS 播放，切换质量级别
    if (this.hls) {
      try {
        // 尝试访问 levels 属性（hls.js 的类型定义）
        const hlsWithLevels = this.hls as unknown as {
          levels?: Array<{ height?: number; name?: string }>;
          currentLevel?: number;
        };

        if (hlsWithLevels.levels && hlsWithLevels.levels.length > 0) {
          const levelIndex = hlsWithLevels.levels.findIndex(
            (level) =>
              level.height?.toString() === quality || level.name === quality,
          );
          if (levelIndex >= 0) {
            hlsWithLevels.currentLevel = levelIndex;
            this.emitEvent("playing", { streamId: this.streamId, quality });
          }
        }
      } catch (error) {
        console.warn("质量切换失败:", error);
      }
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
      // 移除特定的监听器
      const listeners = this.eventListeners.get(event)!;
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
      // 如果该事件没有监听器了，删除事件键
      if (listeners.length === 0) {
        this.eventListeners.delete(event);
      }
    } else {
      // 移除该事件的所有监听器
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
    const buffered = this.videoElement?.buffered.length
      ? this.videoElement.buffered.end(0) - this.videoElement.buffered.start(0)
      : 0;
    const currentTime = this.videoElement?.currentTime || 0;
    const duration = this.videoElement?.duration || 0;

    return {
      streamId: this.streamId,
      status: this.status,
      buffered,
      currentTime,
      duration,
      uptime,
    };
  }

  /**
   * 检测协议类型
   */
  private detectProtocol(url: string): "hls" | "flv" | "webrtc" | "other" {
    if (url.includes(".m3u8") || url.includes("hls")) {
      return "hls";
    }
    if (url.includes(".flv") || url.includes("flv")) {
      return "flv";
    }
    if (url.startsWith("ws://") || url.startsWith("wss://")) {
      return "webrtc";
    }
    return "other";
  }

  /**
   * 设置 HLS 播放
   */
  private async setupHLS(url: string): Promise<void> {
    if (!this.videoElement) {
      throw new Error("视频元素未设置");
    }

    // 尝试动态加载 hls.js（如果可用）
    try {
      // 检查是否在浏览器环境且有 hls.js
      const hlsJsAvailable =
        typeof (globalThis as unknown as { Hls?: unknown }).Hls !== "undefined";

      if (hlsJsAvailable) {
        // 使用全局 Hls 对象
        const Hls = (globalThis as unknown as {
          Hls: {
            new (): {
              loadSource(url: string): void;
              attachMedia(element: VideoElement): void;
              destroy(): void;
              on(
                event: string,
                handler: (event: string, data?: unknown) => void,
              ): void;
            };
            isSupported(): boolean;
          };
        }).Hls;

        if (Hls.isSupported()) {
          this.hls = new Hls();
          this.hls.loadSource(url);
          this.hls.attachMedia(this.videoElement);

          // 监听事件
          this.hls.on("hlsError", (_event: unknown, data: unknown) => {
            console.error("HLS 播放错误:", data);
            this.emitEvent("error", { error: data, streamId: this.streamId });
          });

          this.hls.on("hlsManifestParsed", () => {
            this.emitEvent("playing", { streamId: this.streamId, url });
          });

          return;
        }
      }
    } catch (error) {
      console.warn("hls.js 不可用，使用原生 HLS 支持:", error);
    }

    // 回退到原生 video 元素（如果浏览器支持 HLS，如 Safari）
    if (this.videoElement.canPlayType("application/vnd.apple.mpegurl")) {
      this.videoElement.src = url;
      this.emitEvent("playing", { streamId: this.streamId, url });
    } else {
      throw new Error("浏览器不支持 HLS 播放，请引入 hls.js 库");
    }
  }

  /**
   * 设置 FLV 播放
   */
  private async setupFLV(url: string): Promise<void> {
    if (!this.videoElement) {
      throw new Error("视频元素未设置");
    }

    // 尝试动态加载 flv.js（如果可用）
    try {
      // 检查是否在浏览器环境且有 flv.js
      const flvJsAvailable = typeof (globalThis as unknown as {
        flvjs?: {
          createPlayer(options: { type: string; url: string }): {
            attachMediaElement(element: VideoElement): void;
            load(): void;
            destroy(): void;
            on(
              event: string,
              handler: (type: string, detail?: unknown) => void,
            ): void;
          };
          isSupported(): boolean;
        };
      }).flvjs !== "undefined";

      if (flvJsAvailable) {
        const flvjs = (globalThis as unknown as {
          flvjs: {
            createPlayer(options: { type: string; url: string }): {
              attachMediaElement(element: VideoElement): void;
              load(): void;
              destroy(): void;
              on(
                event: string,
                handler: (type: string, detail?: unknown) => void,
              ): void;
            };
            isSupported(): boolean;
          };
        }).flvjs;

        if (flvjs.isSupported()) {
          this.flvPlayer = flvjs.createPlayer({
            type: "flv",
            url: url,
          });
          this.flvPlayer.attachMediaElement(this.videoElement);
          this.flvPlayer.load();

          // 监听事件
          this.flvPlayer.on("error", (type: unknown, detail: unknown) => {
            console.error("FLV 播放错误:", type, detail);
            this.emitEvent("error", { error: detail, streamId: this.streamId });
          });

          this.flvPlayer.on("statistics_info", () => {
            this.emitEvent("playing", { streamId: this.streamId, url });
          });

          return;
        }
      }
    } catch (error) {
      console.warn("flv.js 不可用:", error);
    }

    throw new Error(
      "FLV 播放需要 flv.js 库支持。请引入 flv.js: <script src='https://cdn.jsdelivr.net/npm/flv.js@latest/dist/flv.min.js'></script>",
    );
  }

  /**
   * 设置 WebRTC 播放
   */
  private async setupWebRTC(url: string): Promise<void> {
    if (!this.videoElement) {
      throw new Error("视频元素未设置");
    }

    try {
      // 创建 RTCPeerConnection
      const RTCPeerConnectionClass = (globalThis as unknown as {
        RTCPeerConnection: new (
          configuration?: RTCConfiguration,
        ) => RTCPeerConnection;
      }).RTCPeerConnection;

      const pc = new RTCPeerConnectionClass({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
        ],
      });

      // 监听远程流
      pc.ontrack = (event: RTCTrackEvent) => {
        if (this.videoElement && event.streams[0]) {
          this.videoElement.srcObject = event
            .streams[0] as unknown as MediaStream;
          this.emitEvent("playing", { streamId: this.streamId, url });
        }
      };

      // 监听连接状态
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "connected") {
          this.emitEvent("connected", { streamId: this.streamId, url });
        } else if (
          pc.iceConnectionState === "disconnected" ||
          pc.iceConnectionState === "failed"
        ) {
          this.emitEvent("error", {
            error: new Error(`WebRTC 连接失败: ${pc.iceConnectionState}`),
            streamId: this.streamId,
          });
        }
      };

      // 创建 offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      // 通过信令服务器交换 SDP（这里需要根据实际信令服务器实现）
      // 假设通过 HTTP POST 发送 offer 并接收 answer
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "offer",
          sdp: offer.sdp,
          streamId: this.streamId,
        }),
      });

      if (!response.ok) {
        throw new Error(`信令服务器请求失败: ${response.status}`);
      }

      const answerData = await response.json();
      if (answerData.type === "answer") {
        await pc.setRemoteDescription(
          new RTCSessionDescription({
            type: "answer",
            sdp: answerData.sdp,
          }) as unknown as RTCSessionDescriptionInit,
        );
      } else {
        throw new Error("无效的信令响应");
      }

      // 保存 peer connection 以便后续清理
      (this as unknown as { pc?: RTCPeerConnection }).pc = pc;
    } catch (error) {
      console.error("WebRTC 设置失败:", error);
      this.emitEvent("error", { error, streamId: this.streamId });
      throw error;
    }
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
