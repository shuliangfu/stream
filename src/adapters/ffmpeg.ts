/**
 * @fileoverview FFmpeg 流媒体适配器
 *
 * 使用 FFmpeg 进行推流和拉流的基础适配器
 * 适用于简单的推流/拉流场景，不依赖外部流媒体服务器
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
import { StreamNotFoundError } from "../utils/errors.ts";
import { generateId } from "../utils/id.ts";
import { generatePublisherUrl, generateSubscriberUrl } from "../utils/url.ts";
import type { StreamAdapter } from "./base.ts";

/**
 * FFmpeg 适配器配置
 */
export interface FFmpegAdapterConfig extends AdapterConfig {
  /** 应用名称（默认: "live"） */
  app?: string;
  /** 流密钥前缀 */
  streamKeyPrefix?: string;
}

/**
 * FFmpeg 流媒体适配器
 *
 * 使用 FFmpeg 进行推流和拉流
 * 注意：此适配器功能有限，主要用于简单的推流/拉流场景
 */
export class FFmpegAdapter implements StreamAdapter {
  readonly name = "ffmpeg";
  private config: FFmpegAdapterConfig;
  private streams: Map<string, Stream> = new Map();
  private streamProcesses: Map<
    string,
    { process: unknown; startTime: number }
  > = new Map();

  constructor(config?: FFmpegAdapterConfig) {
    this.config = {
      host: config?.host || "localhost",
      port: config?.port || 1935,
      app: config?.app || "live",
      streamKeyPrefix: config?.streamKeyPrefix || "stream",
      ...config,
    };
  }

  /**
   * 创建流
   */
  createStream(options: StreamOptions): Promise<Stream> {
    const streamId = generateId("stream");
    const streamKey = `${this.config.streamKeyPrefix}-${streamId}`;

    const stream: Stream = {
      id: streamId,
      name: options.name,
      roomId: options.roomId,
      status: "idle",
      protocol: options.protocol,
      publisherUrl: generatePublisherUrl(
        options.protocol,
        this.config.host!,
        this.config.port!,
        this.config.app!,
        streamKey,
      ),
      subscriberUrls: {
        [options.protocol]: generateSubscriberUrl(
          options.protocol,
          this.config.host!,
          this.config.port!,
          this.config.app!,
          streamKey,
        ),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.streams.set(streamId, stream);
    return Promise.resolve(stream);
  }

  /**
   * 删除流
   */
  deleteStream(streamId: string): Promise<void> {
    this.streams.delete(streamId);
    return Promise.resolve();
  }

  /**
   * 获取流
   */
  getStream(streamId: string): Promise<Stream | null> {
    return Promise.resolve(this.streams.get(streamId) || null);
  }

  /**
   * 列出所有流
   */
  listStreams(
    options?: { limit?: number; offset?: number },
  ): Promise<Stream[]> {
    const streams = Array.from(this.streams.values());
    const offset = options?.offset || 0;
    const limit = options?.limit || streams.length;
    return Promise.resolve(streams.slice(offset, offset + limit));
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

    // 获取流进程信息
    const streamProcess = this.streamProcesses.get(streamId);
    const uptime = streamProcess ? Date.now() - streamProcess.startTime : 0;

    // 从流选项获取质量信息（如果创建流时提供了）
    // 注意：Stream 接口不包含 quality，需要从创建时的选项推断
    const quality = {
      width: 0,
      height: 0,
      bitrate: 0,
      fps: 0,
    };

    return {
      streamId,
      viewers: 0, // FFmpeg 适配器无法获取观看人数
      bitrate: quality.bitrate || 0,
      fps: quality.fps || 0,
      resolution: {
        width: quality.width || 0,
        height: quality.height || 0,
      },
      uptime,
    };
  }

  /**
   * 记录流进程（供 ServerPublisher/ServerSubscriber 调用）
   */
  recordStreamProcess(streamId: string, process: unknown): void {
    this.streamProcesses.set(streamId, {
      process,
      startTime: Date.now(),
    });
  }

  /**
   * 移除流进程记录
   */
  removeStreamProcess(streamId: string): void {
    this.streamProcesses.delete(streamId);
  }

  /**
   * 开始录制流
   */
  async startRecording(
    streamId: string,
    options?: { output?: string; duration?: number },
  ): Promise<string> {
    const stream = await this.getStream(streamId);
    if (!stream) {
      throw new StreamNotFoundError(streamId);
    }

    // 使用录制工具函数
    const { recordStreamRealtime } = await import("../utils/recording.ts");
    const subscriberUrl = stream.subscriberUrls[stream.protocol] ||
      stream.subscriberUrls.rtmp ||
      stream.subscriberUrls.hls;

    if (!subscriberUrl) {
      throw new Error(`流 ${streamId} 没有可用的拉流 URL`);
    }

    const result = await recordStreamRealtime(subscriberUrl, {
      output: options?.output,
      duration: options?.duration,
    });

    // 保存录制进程
    this.streamProcesses.set(`recording-${streamId}`, {
      process: result.process,
      startTime: Date.now(),
    });

    return result.outputPath;
  }

  /**
   * 停止录制流
   */
  async stopRecording(streamId: string): Promise<string> {
    const recordingProcess = this.streamProcesses.get(`recording-${streamId}`);
    if (!recordingProcess) {
      throw new Error(`流 ${streamId} 没有正在进行的录制`);
    }

    // 停止录制进程
    const processWithStop = recordingProcess.process as {
      stop?: () => Promise<void>;
    };
    if (processWithStop.stop) {
      await processWithStop.stop();
    }

    // 移除录制进程记录
    this.streamProcesses.delete(`recording-${streamId}`);

    // 返回输出路径（需要从进程信息中获取，这里简化处理）
    return "";
  }

  /**
   * 清理所有资源
   * 用于性能优化：清理已停止的流进程
   */
  cleanup(): void {
    // 清理已停止的流进程（这里简化处理，实际应该检查进程状态）
    // 可以定期调用此方法清理资源
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 分钟

    for (const [streamId, processInfo] of this.streamProcesses.entries()) {
      if (now - processInfo.startTime > maxAge) {
        // 尝试停止进程
        const processWithStop = processInfo.process as {
          stop?: () => Promise<void>;
        };
        if (processWithStop.stop) {
          processWithStop.stop().catch(console.error);
        }
        this.streamProcesses.delete(streamId);
      }
    }
  }
}
