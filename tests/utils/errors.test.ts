/**
 * @fileoverview 错误类测试
 */

import { describe, expect, it } from "@dreamer/test";
import {
  AdapterError,
  ConfigurationError,
  ConnectionError,
  ProtocolNotSupportedError,
  PublisherStateError,
  StreamAlreadyExistsError,
  StreamError,
  StreamNotFoundError,
  SubscriberStateError,
} from "../../src/utils/errors.ts";

describe("StreamError", () => {
  it("应该创建基础错误类", () => {
    const error = new StreamError("测试错误", "STREAM_ERROR");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(StreamError);
    expect(error.message).toBe("测试错误");
    expect(error.code).toBe("STREAM_ERROR");
    expect(error.name).toBe("StreamError");
  });

  it("应该支持带原因的错误", () => {
    const cause = new Error("原始错误");
    const error = new StreamError("包装错误", "STREAM_ERROR", cause);
    expect(error.message).toBe("包装错误");
    expect(error.code).toBe("STREAM_ERROR");
    expect(error.cause).toBe(cause);
  });
});

describe("StreamNotFoundError", () => {
  it("应该创建流不存在错误", () => {
    const error = new StreamNotFoundError("stream-123");
    expect(error).toBeInstanceOf(StreamError);
    expect(error.message).toBe("流不存在: stream-123");
    expect(error.code).toBe("STREAM_NOT_FOUND");
  });
});

describe("StreamAlreadyExistsError", () => {
  it("应该创建流已存在错误", () => {
    const error = new StreamAlreadyExistsError("stream-123");
    expect(error).toBeInstanceOf(StreamError);
    expect(error.message).toBe("流已存在: stream-123");
    expect(error.code).toBe("STREAM_ALREADY_EXISTS");
  });
});

describe("PublisherStateError", () => {
  it("应该创建推流器状态错误", () => {
    const error = new PublisherStateError("stream-123", "idle", "publishing");
    expect(error).toBeInstanceOf(StreamError);
    expect(error.message).toBe(
      "推流器状态错误: 当前状态 idle，期望状态 publishing",
    );
    expect(error.code).toBe("PUBLISHER_STATE_ERROR");
  });
});

describe("SubscriberStateError", () => {
  it("应该创建拉流器状态错误", () => {
    const error = new SubscriberStateError("stream-123", "idle", "playing");
    expect(error).toBeInstanceOf(StreamError);
    expect(error.message).toBe(
      "拉流器状态错误: 当前状态 idle，期望状态 playing",
    );
    expect(error.code).toBe("SUBSCRIBER_STATE_ERROR");
  });
});

describe("ConnectionError", () => {
  it("应该创建连接错误", () => {
    const error = new ConnectionError("连接失败");
    expect(error).toBeInstanceOf(StreamError);
    expect(error.message).toBe("连接失败");
  });

  it("应该支持带原因的连接错误", () => {
    const cause = new Error("网络错误");
    const error = new ConnectionError("连接失败", cause);
    expect(error.message).toBe("连接失败");
    expect(error.cause).toBe(cause);
  });
});

describe("ProtocolNotSupportedError", () => {
  it("应该创建协议不支持错误", () => {
    const error = new ProtocolNotSupportedError("invalid-protocol");
    expect(error).toBeInstanceOf(StreamError);
    expect(error.message).toBe("不支持的协议: invalid-protocol");
    expect(error.code).toBe("PROTOCOL_NOT_SUPPORTED");
  });
});

describe("AdapterError", () => {
  it("应该创建适配器错误", () => {
    const error = new AdapterError("适配器错误");
    expect(error).toBeInstanceOf(StreamError);
    expect(error.message).toBe("适配器错误");
  });
});

describe("ConfigurationError", () => {
  it("应该创建配置错误", () => {
    const error = new ConfigurationError("配置错误");
    expect(error).toBeInstanceOf(StreamError);
    expect(error.message).toBe("配置错误");
  });
});
