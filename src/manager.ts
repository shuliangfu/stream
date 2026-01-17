/**
 * @fileoverview 流管理器
 *
 * 职责：
 * - 管理所有流资源
 * - 提供统一的流操作接口
 * - 协调适配器和服务器
 */

import type {
  Stream,
  StreamOptions,
  StreamStatistics,
  Publisher,
  Subscriber,
  PublisherOptions,
  SubscriberOptions,
  Room,
  RoomOptions,
  ListOptions,
} from "./types.ts";
import type { StreamAdapter, AdapterOptions } from "./adapters/base.ts";
import { FFmpegAdapter, type FFmpegAdapterConfig } from "./adapters/ffmpeg.ts";
import { SRSAdapter, type SRSAdapterConfig } from "./adapters/srs.ts";

/**
 * 流管理器选项
 */
export interface StreamManagerOptions {
  /** 适配器类型 */
  adapter: "srs" | "nginx-rtmp" | "livekit" | "ffmpeg" | "custom";
  /** 适配器配置 */
  adapterConfig?: AdapterOptions;
  /** 服务器配置（兼容旧配置） */
  server?: {
    host?: string;
    port?: number;
    [key: string]: unknown;
  };
}

/**
 * 流管理器
 *
 * 提供统一的流管理接口，支持多种流媒体协议和服务器
 */
export class StreamManager {
  private adapter: StreamAdapter;
  private rooms: Map<string, Room> = new Map();

  constructor(options: StreamManagerOptions) {
    // 创建适配器实例
    this.adapter = this.createAdapter(options);
  }

  /**
   * 创建适配器实例
   */
  private createAdapter(options: StreamManagerOptions): StreamAdapter {
    const adapterType = options.adapter;
    const config = options.adapterConfig?.config || options.server || {};

    switch (adapterType) {
      case "ffmpeg":
        return new FFmpegAdapter(config as FFmpegAdapterConfig);
      case "srs":
        return new SRSAdapter(config as SRSAdapterConfig);
      case "custom":
        if (!options.adapterConfig?.adapter) {
          throw new Error("custom 适配器需要提供 adapter 实现");
        }
        return options.adapterConfig.adapter;
      default:
        throw new Error(`不支持的适配器类型: ${adapterType}`);
    }
  }

  /**
   * 连接适配器（如果需要）
   */
  async connect(): Promise<void> {
    if (this.adapter.connect) {
      await this.adapter.connect();
    }
  }

  /**
   * 断开适配器连接（如果需要）
   */
  async disconnect(): Promise<void> {
    if (this.adapter.disconnect) {
      await this.adapter.disconnect();
    }
  }

  /**
   * 创建流
   *
   * @param options 流选项
   * @returns 流对象
   */
  async createStream(options: StreamOptions): Promise<Stream> {
    return await this.adapter.createStream(options);
  }

  /**
   * 获取流
   *
   * @param streamId 流 ID
   * @returns 流对象
   */
  async getStream(streamId: string): Promise<Stream | null> {
    return await this.adapter.getStream(streamId);
  }

  /**
   * 删除流
   *
   * @param streamId 流 ID
   */
  async deleteStream(streamId: string): Promise<void> {
    await this.adapter.deleteStream(streamId);
  }

  /**
   * 列出所有流
   *
   * @param options 列表选项
   * @returns 流对象数组
   */
  async listStreams(options?: ListOptions): Promise<Stream[]> {
    return await this.adapter.listStreams({
      limit: options?.limit,
      offset: options?.offset,
    });
  }

  /**
   * 创建房间
   *
   * @param options 房间选项
   * @returns 房间对象
   */
  createRoom(options: RoomOptions): Promise<Room> {
    const roomId = `room-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const room: Room = {
      id: roomId,
      name: options.name,
      description: options.description,
      maxViewers: options.maxViewers,
      isPrivate: options.isPrivate || false,
      streamIds: [],
      viewerCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.rooms.set(roomId, room);
    return Promise.resolve(room);
  }

  /**
   * 获取房间
   *
   * @param roomId 房间 ID
   * @returns 房间对象
   */
  getRoom(roomId: string): Promise<Room | null> {
    return Promise.resolve(this.rooms.get(roomId) || null);
  }

  /**
   * 删除房间
   *
   * @param roomId 房间 ID
   */
  deleteRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
    return Promise.resolve();
  }

  /**
   * 列出所有房间
   *
   * @param options 列表选项
   * @returns 房间对象数组
   */
  listRooms(options?: ListOptions): Promise<Room[]> {
    const rooms = Array.from(this.rooms.values());
    const offset = options?.offset || 0;
    const limit = options?.limit || rooms.length;
    return Promise.resolve(rooms.slice(offset, offset + limit));
  }

  /**
   * 创建推流器
   *
   * @param streamId 流 ID
   * @param options 推流选项
   * @returns 推流器实例
   */
  async createPublisher(
    streamId: string,
    options?: PublisherOptions,
  ): Promise<Publisher> {
    return await this.adapter.createPublisher(streamId, options);
  }

  /**
   * 创建拉流器
   *
   * @param streamId 流 ID
   * @param options 拉流选项
   * @returns 拉流器实例
   */
  async createSubscriber(
    streamId: string,
    options?: SubscriberOptions,
  ): Promise<Subscriber> {
    return await this.adapter.createSubscriber(streamId, options);
  }

  /**
   * 获取流统计信息
   *
   * @param streamId 流 ID
   * @returns 流统计信息
   */
  async getStatistics(streamId: string): Promise<StreamStatistics> {
    return await this.adapter.getStatistics(streamId);
  }

  /**
   * 开始录制流（如果适配器支持）
   *
   * @param streamId 流 ID
   * @param options 录制选项
   * @returns 录制文件路径
   */
  async startRecording(
    streamId: string,
    options?: { output?: string; duration?: number },
  ): Promise<string> {
    if (!this.adapter.startRecording) {
      throw new Error("当前适配器不支持录制功能");
    }
    return await this.adapter.startRecording(streamId, options);
  }

  /**
   * 停止录制流（如果适配器支持）
   *
   * @param streamId 流 ID
   * @returns 录制文件路径
   */
  async stopRecording(streamId: string): Promise<string> {
    if (!this.adapter.stopRecording) {
      throw new Error("当前适配器不支持录制功能");
    }
    return await this.adapter.stopRecording(streamId);
  }
}
