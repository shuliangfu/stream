/**
 * @fileoverview 客户端推流器实现
 *
 * 浏览器端推流功能，使用 MediaRecorder API 或 WebRTC 进行推流
 */

import type {
  Publisher,
  PublisherOptions,
  PublisherStatistics,
  PublisherStatus,
  VideoQuality,
} from "../types.ts";

/**
 * 视频元素接口（兼容 HTMLVideoElement）
 */
interface VideoElement {
  srcObject: MediaStream | null;
  play(): Promise<void>;
  pause(): void;
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
 * 媒体流约束接口
 */
interface MediaStreamConstraints {
  audio?: boolean | MediaTrackConstraints;
  video?: boolean | MediaTrackConstraints;
}

/**
 * WebRTC 相关接口
 */
interface RTCPeerConnection {
  addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender;
  setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
  setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
  createOffer(options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit>;
  createAnswer(options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit>;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
  oniceconnectionstatechange: (() => void) | null;
  iceConnectionState: string;
  localDescription: RTCSessionDescriptionInit | null;
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

/**
 * RTCAnswerOptions 类型
 *
 * 用于 RTCPeerConnection.createAnswer() 方法的选项
 * 根据 WebRTC 标准，RTCAnswerOptions 继承自 RTCOfferAnswerOptions，
 * 但目前没有定义自己的属性。使用类型别名避免空接口警告。
 *
 * 注意：虽然 RTCOfferAnswerOptions 有 voiceActivityDetection 属性，
 * 但该属性已被废弃且浏览器支持不一致，因此不在此处定义。
 */
type RTCAnswerOptions = Record<string, never>;

interface RTCPeerConnectionIceEvent {
  candidate: RTCIceCandidate | null;
}

interface RTCIceCandidate {
  candidate: string;
  sdpMLineIndex: number | null;
  sdpMid: string | null;
}

interface RTCRtpSender {
  track: MediaStreamTrack | null;
}

/**
 * 媒体轨道约束接口
 */
interface MediaTrackConstraints {
  width?: { ideal?: number };
  height?: { ideal?: number };
  frameRate?: { ideal?: number };
}

/**
 * MediaRecorder 接口
 */
interface MediaRecorder {
  state: "inactive" | "recording" | "paused";
  mimeType: string;
  start(timeslice?: number): void;
  stop(): void;
  pause(): void;
  resume(): void;
  ondataavailable: ((event: BlobEvent) => void) | null;
}

/**
 * MediaRecorder 构造函数接口
 */
interface MediaRecorderConstructor {
  new (
    stream: MediaStream,
    options?: { mimeType?: string; videoBitsPerSecond?: number },
  ): MediaRecorder;
  isTypeSupported(mimeType: string): boolean;
}

/**
 * Blob 事件接口
 */
interface BlobEvent {
  data: Blob;
}

/**
 * 客户端推流器选项
 */
export interface ClientPublisherOptions extends PublisherOptions {
  /** 视频元素（可选，用于显示预览） */
  videoElement?: VideoElement;
  /** 是否自动开始推流 */
  autoStart?: boolean;
}

/**
 * 客户端推流器
 *
 * 使用浏览器 MediaRecorder API 或 WebRTC 进行推流
 */
export class ClientPublisher implements Publisher {
  streamId: string;
  status: PublisherStatus = "idle";
  private url?: string;
  private options?: ClientPublisherOptions;
  private quality?: VideoQuality;
  private audioEnabled = true;
  private videoEnabled = true;
  private eventListeners: Map<string, Array<(data?: unknown) => void>> =
    new Map();
  private startTime?: number;
  private mediaStream?: MediaStream;
  private mediaRecorder?: MediaRecorder;
  private ws?: WebSocket;
  private dataQueue: Blob[] = [];
  private isSending = false;
  private pc?: RTCPeerConnection; // WebRTC peer connection
  private readonly maxQueueSize = 100; // 最大队列大小，防止内存溢出

  constructor(streamId: string, options?: ClientPublisherOptions) {
    this.streamId = streamId;
    this.options = options;
    this.quality = options?.quality;
    this.audioEnabled = options?.audioEnabled ?? true;
    this.videoEnabled = options?.videoEnabled ?? true;
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
    this.status = "connecting";

    try {
      // 如果是 WebSocket URL，建立连接
      const urlObj = new URL(url);
      if (urlObj.protocol === "ws:" || urlObj.protocol === "wss:") {
        this.ws = new WebSocket(url);
        await new Promise<void>((resolve, reject) => {
          if (!this.ws) {
            reject(new Error("WebSocket 创建失败"));
            return;
          }
          this.ws.onopen = () => resolve();
          this.ws.onerror = (error) => reject(error);
        });
      }

      // 获取用户媒体流
      const constraints: MediaStreamConstraints = {
        audio: this.audioEnabled,
        video: this.videoEnabled
          ? {
            width: { ideal: this.quality?.width },
            height: { ideal: this.quality?.height },
            frameRate: { ideal: this.quality?.fps },
          }
          : false,
      };

      // 使用 globalThis 访问浏览器 API（通过 unknown 转换避免类型冲突）
      const navigator = (globalThis as unknown as {
        navigator: {
          mediaDevices: {
            getUserMedia(
              constraints: MediaStreamConstraints,
            ): Promise<MediaStream>;
          };
        };
      }).navigator;
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // 如果提供了视频元素，显示预览
      if (this.options?.videoElement && this.mediaStream) {
        (this.options.videoElement as { srcObject: MediaStream | null })
          .srcObject = this.mediaStream;
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
   * 开始推流
   */
  async publish(_source?: unknown): Promise<void> {
    if (this.status !== "connected") {
      throw new Error(`推流器未连接，当前状态: ${this.status}`);
    }

    if (!this.mediaStream) {
      throw new Error("媒体流未初始化");
    }

    if (!this.url) {
      throw new Error("推流 URL 未设置");
    }

    this.status = "publishing";
    this.startTime = Date.now();

    try {
      // 检测协议，如果是 WebRTC，使用 RTCPeerConnection
      const urlObj = new URL(this.url);
      if (urlObj.protocol === "webrtc:" || urlObj.searchParams.has("webrtc")) {
        await this.publishWithWebRTC();
        return;
      }

      // 使用 MediaRecorder 录制并推流
      const mimeType = this.getSupportedMimeType();
      if (!mimeType) {
        throw new Error("浏览器不支持 MediaRecorder");
      }

      // 使用 globalThis 访问 MediaRecorder（通过 unknown 转换避免类型冲突）
      const MediaRecorderClass = (globalThis as unknown as {
        MediaRecorder: new (
          stream: MediaStream,
          options?: { mimeType?: string; videoBitsPerSecond?: number },
        ) => MediaRecorder;
      }).MediaRecorder;
      this.mediaRecorder = new MediaRecorderClass(this.mediaStream, {
        mimeType,
        videoBitsPerSecond: this.quality?.bitrate,
      });

      // 监听数据事件
      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          await this.sendStreamData(event.data);
        }
      };

      // 开始录制
      this.mediaRecorder.start(1000); // 每 1 秒发送一次数据

      this.emitEvent("publishing", { streamId: this.streamId, url: this.url });
    } catch (error) {
      this.status = "error";
      this.emitEvent("error", { error, streamId: this.streamId });
      throw error;
    }
  }

  /**
   * 使用 WebRTC 推流
   */
  private async publishWithWebRTC(): Promise<void> {
    if (!this.mediaStream) {
      throw new Error("媒体流未初始化");
    }

    try {
      // 创建 RTCPeerConnection
      const RTCPeerConnectionClass = (globalThis as unknown as {
        RTCPeerConnection: new (
          configuration?: RTCConfiguration,
        ) => RTCPeerConnection;
      }).RTCPeerConnection;

      this.pc = new RTCPeerConnectionClass({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
        ],
      });

      // 添加媒体轨道
      this.mediaStream.getTracks().forEach((track) => {
        this.pc!.addTrack(track, this.mediaStream!);
      });

      // 监听 ICE 候选
      this.pc.onicecandidate = async (event) => {
        if (event.candidate && this.url) {
          // 发送 ICE 候选到信令服务器
          try {
            await fetch(this.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                type: "ice-candidate",
                candidate: event.candidate.candidate,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
                sdpMid: event.candidate.sdpMid,
                streamId: this.streamId,
              }),
            });
          } catch (error) {
            console.error("发送 ICE 候选失败:", error);
          }
        }
      };

      // 监听连接状态
      this.pc.oniceconnectionstatechange = () => {
        if (this.pc!.iceConnectionState === "connected") {
          this.emitEvent("publishing", {
            streamId: this.streamId,
            url: this.url,
          });
        } else if (
          this.pc!.iceConnectionState === "disconnected" ||
          this.pc!.iceConnectionState === "failed"
        ) {
          this.emitEvent("error", {
            error: new Error(`WebRTC 连接失败: ${this.pc!.iceConnectionState}`),
            streamId: this.streamId,
          });
        }
      };

      // 创建 offer
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await this.pc.setLocalDescription(offer);

      // 通过信令服务器交换 SDP
      if (!this.url) {
        throw new Error("推流 URL 未设置");
      }

      const response = await fetch(this.url, {
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
        await this.pc.setRemoteDescription({
          type: "answer",
          sdp: answerData.sdp,
        });
      } else {
        throw new Error("无效的信令响应");
      }

      this.emitEvent("publishing", { streamId: this.streamId, url: this.url });
    } catch (error) {
      console.error("WebRTC 推流设置失败:", error);
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
      // 停止录制
      if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
        this.mediaRecorder.stop();
      }

      // 停止媒体流
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      }

      // 清理视频元素
      if (this.options?.videoElement) {
        (this.options.videoElement as { srcObject: MediaStream | null })
          .srcObject = null;
      }

      // 关闭 WebSocket 连接
      if (this.ws) {
        this.ws.close();
        this.ws = undefined;
      }

      // 关闭 WebRTC 连接
      if (this.pc) {
        this.pc.close();
        this.pc = undefined;
      }

      // 清空数据队列
      this.dataQueue = [];
      this.isSending = false;

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

    // 如果正在推流，需要重新配置 MediaRecorder
    if (this.status === "publishing" && this.mediaRecorder) {
      const previousStatus = this.status;
      this.status = "connected"; // 临时状态，准备重新配置

      try {
        // 停止当前录制
        if (this.mediaRecorder.state !== "inactive") {
          this.mediaRecorder.stop();
        }

        // 重新创建 MediaRecorder 并开始录制
        const mimeType = this.getSupportedMimeType();
        if (mimeType && this.mediaStream) {
          const MediaRecorderClass = (globalThis as unknown as {
            MediaRecorder: new (
              stream: MediaStream,
              options?: { mimeType?: string; videoBitsPerSecond?: number },
            ) => MediaRecorder;
          }).MediaRecorder;

          this.mediaRecorder = new MediaRecorderClass(this.mediaStream, {
            mimeType,
            videoBitsPerSecond: quality.bitrate,
          });

          // 重新设置事件监听
          this.mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
              await this.sendStreamData(event.data);
            }
          };

          // 重新开始录制
          this.mediaRecorder.start(1000);
          this.status = previousStatus;
        }
      } catch (error) {
        this.status = previousStatus;
        this.emitEvent("error", { error, streamId: this.streamId });
        throw error;
      }
    }
  }

  /**
   * 设置音频启用状态
   */
  setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * 设置视频启用状态
   */
  setVideoEnabled(enabled: boolean): void {
    this.videoEnabled = enabled;
    if (this.mediaStream) {
      this.mediaStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
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
   * 获取支持的 MIME 类型
   */
  private getSupportedMimeType(): string | null {
    const types = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ];

    // 使用 globalThis 访问 MediaRecorder（通过 unknown 转换避免类型冲突）
    const MediaRecorderClass = (globalThis as unknown as {
      MediaRecorder: MediaRecorderConstructor;
    }).MediaRecorder;
    for (const type of types) {
      if (MediaRecorderClass.isTypeSupported(type)) {
        return type;
      }
    }

    return null;
  }

  /**
   * 发送流数据到服务器
   *
   * 支持多种发送方式：
   * 1. WebSocket - 实时推送（优先）
   * 2. HTTP POST - 分块上传（备用）
   */
  private async sendStreamData(data: Blob): Promise<void> {
    // 优先使用 WebSocket 发送
    if (this.url) {
      const urlObj = new URL(this.url);
      if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
        // 检查队列大小，防止内存溢出
        if (this.dataQueue.length >= this.maxQueueSize) {
          console.warn("数据队列已满，丢弃数据包");
          this.emitEvent("error", {
            error: new Error("数据队列已满"),
            streamId: this.streamId,
          });
          return;
        }

        // 将数据添加到队列，批量发送以提高效率
        this.dataQueue.push(data);
        if (!this.isSending) {
          this.processDataQueue();
        }
        return;
      }
    }

    // 如果都不支持，记录警告
    console.warn("无法发送流数据：未配置有效的传输方式");
  }

  /**
   * 处理数据队列
   * 批量发送数据以提高效率
   */
  private async processDataQueue(): Promise<void> {
    if (this.isSending || this.dataQueue.length === 0) {
      return;
    }

    this.isSending = true;

    try {
      while (this.dataQueue.length > 0) {
        const data = this.dataQueue.shift();
        if (!data || !this.url) {
          continue;
        }

        // 使用 fetch API 发送数据
        const response = await fetch(this.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Stream-Id": this.streamId,
          },
          body: data,
        });

        if (!response.ok) {
          throw new Error(
            `HTTP 发送失败: ${response.status} ${response.statusText}`,
          );
        }
      }
    } catch (error) {
      console.error("处理数据队列时出错:", error);
      this.emitEvent("error", { error, streamId: this.streamId });
    } finally {
      this.isSending = false;
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
