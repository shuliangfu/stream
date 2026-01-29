/**
 * @fileoverview 流媒体库错误定义
 *
 * 定义所有流媒体相关的错误类型
 */

/**
 * 流媒体基础错误类
 */
export class StreamError extends Error {
  public override readonly cause?: Error;

  constructor(
    message: string,
    public readonly code: string,
    cause?: Error,
  ) {
    super(message, { cause });
    this.name = "StreamError";
    this.cause = cause;
  }
}

/**
 * 流不存在错误
 */
export class StreamNotFoundError extends StreamError {
  constructor(streamId: string) {
    super(`流不存在: ${streamId}`, "STREAM_NOT_FOUND");
    this.name = "StreamNotFoundError";
  }
}

/**
 * 流已存在错误
 */
export class StreamAlreadyExistsError extends StreamError {
  constructor(streamId: string) {
    super(`流已存在: ${streamId}`, "STREAM_ALREADY_EXISTS");
    this.name = "StreamAlreadyExistsError";
  }
}

/**
 * 推流器状态错误
 */
export class PublisherStateError extends StreamError {
  constructor(
    _streamId: string,
    currentStatus: string,
    expectedStatus: string,
  ) {
    super(
      `推流器状态错误: 当前状态 ${currentStatus}，期望状态 ${expectedStatus}`,
      "PUBLISHER_STATE_ERROR",
    );
    this.name = "PublisherStateError";
  }
}

/**
 * 拉流器状态错误
 */
export class SubscriberStateError extends StreamError {
  constructor(
    _streamId: string,
    currentStatus: string,
    expectedStatus: string,
  ) {
    super(
      `拉流器状态错误: 当前状态 ${currentStatus}，期望状态 ${expectedStatus}`,
      "SUBSCRIBER_STATE_ERROR",
    );
    this.name = "SubscriberStateError";
  }
}

/**
 * 连接错误
 */
export class ConnectionError extends StreamError {
  constructor(message: string, cause?: Error) {
    super(message, "CONNECTION_ERROR", cause);
    this.name = "ConnectionError";
  }
}

/**
 * 协议不支持错误
 */
export class ProtocolNotSupportedError extends StreamError {
  constructor(protocol: string) {
    super(`不支持的协议: ${protocol}`, "PROTOCOL_NOT_SUPPORTED");
    this.name = "ProtocolNotSupportedError";
  }
}

/**
 * 适配器错误
 */
export class AdapterError extends StreamError {
  constructor(message: string, cause?: Error) {
    super(message, "ADAPTER_ERROR", cause);
    this.name = "AdapterError";
  }
}

/**
 * 配置错误
 */
export class ConfigurationError extends StreamError {
  constructor(message: string) {
    super(message, "CONFIGURATION_ERROR");
    this.name = "ConfigurationError";
  }
}
