/**
 * @fileoverview 流媒体适配器基础接口
 *
 * 定义所有流媒体适配器必须实现的接口
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

/**
 * 流媒体适配器接口
 *
 * 所有流媒体适配器必须实现此接口
 */
export interface StreamAdapter {
  /**
   * 适配器名称
   */
  readonly name: string;

  /**
   * 连接适配器（如果需要）
   */
  connect?(): Promise<void>;

  /**
   * 断开连接（如果需要）
   */
  disconnect?(): Promise<void>;

  /**
   * 创建流
   *
   * @param options 流选项
   * @returns 流对象
   */
  createStream(options: StreamOptions): Promise<Stream>;

  /**
   * 删除流
   *
   * @param streamId 流 ID
   */
  deleteStream(streamId: string): Promise<void>;

  /**
   * 获取流
   *
   * @param streamId 流 ID
   * @returns 流对象，如果不存在返回 null
   */
  getStream(streamId: string): Promise<Stream | null>;

  /**
   * 列出所有流
   *
   * @param options 列表选项
   * @returns 流对象数组
   */
  listStreams(options?: { limit?: number; offset?: number }): Promise<Stream[]>;

  /**
   * 创建推流器
   *
   * @param streamId 流 ID
   * @param options 推流选项
   * @returns 推流器实例
   */
  createPublisher(
    streamId: string,
    options?: PublisherOptions,
  ): Promise<Publisher>;

  /**
   * 创建拉流器
   *
   * @param streamId 流 ID
   * @param options 拉流选项
   * @returns 拉流器实例
   */
  createSubscriber(
    streamId: string,
    options?: SubscriberOptions,
  ): Promise<Subscriber>;

  /**
   * 获取流统计信息
   *
   * @param streamId 流 ID
   * @returns 流统计信息
   */
  getStatistics(streamId: string): Promise<StreamStatistics>;

  /**
   * 开始录制流（可选）
   *
   * @param streamId 流 ID
   * @param options 录制选项
   * @returns 录制文件路径
   */
  startRecording?(
    streamId: string,
    options?: { output?: string; duration?: number },
  ): Promise<string>;

  /**
   * 停止录制流（可选）
   *
   * @param streamId 流 ID
   * @returns 录制文件路径
   */
  stopRecording?(streamId: string): Promise<string>;
}

/**
 * 适配器配置选项
 */
export interface AdapterOptions {
  /** 适配器配置 */
  config?: AdapterConfig;
  /** 自定义适配器实现（用于 custom 适配器） */
  adapter?: StreamAdapter;
}
