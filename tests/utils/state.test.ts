/**
 * @fileoverview 状态工具测试
 */

import { describe, expect, it } from "@dreamer/test";
import {
  isValidStreamTransition,
  isValidPublisherTransition,
  isValidSubscriberTransition,
  getStreamStatusName,
  getPublisherStatusName,
  getSubscriberStatusName,
  isActiveStatus,
  isErrorStatus,
} from "../../src/utils/state.ts";

describe("isValidStreamTransition", () => {
  it("应该验证有效的流状态转换", () => {
    expect(isValidStreamTransition("idle", "publishing")).toBe(true);
    expect(isValidStreamTransition("publishing", "stopped")).toBe(true);
    expect(isValidStreamTransition("publishing", "error")).toBe(true);
    expect(isValidStreamTransition("stopped", "idle")).toBe(true);
  });

  it("应该拒绝无效的流状态转换", () => {
    expect(isValidStreamTransition("error", "publishing")).toBe(false);
    expect(isValidStreamTransition("idle", "error")).toBe(false);
  });
});

describe("isValidPublisherTransition", () => {
  it("应该验证有效的推流器状态转换", () => {
    expect(isValidPublisherTransition("idle", "connecting")).toBe(true);
    expect(isValidPublisherTransition("connecting", "connected")).toBe(true);
    expect(isValidPublisherTransition("connected", "publishing")).toBe(true);
    expect(isValidPublisherTransition("publishing", "stopped")).toBe(true);
  });

  it("应该拒绝无效的推流器状态转换", () => {
    expect(isValidPublisherTransition("idle", "publishing")).toBe(false);
    expect(isValidPublisherTransition("stopped", "publishing")).toBe(false);
  });
});

describe("isValidSubscriberTransition", () => {
  it("应该验证有效的拉流器状态转换", () => {
    expect(isValidSubscriberTransition("idle", "connecting")).toBe(true);
    expect(isValidSubscriberTransition("connecting", "connected")).toBe(true);
    expect(isValidSubscriberTransition("connected", "playing")).toBe(true);
    expect(isValidSubscriberTransition("playing", "buffering")).toBe(true);
    expect(isValidSubscriberTransition("buffering", "playing")).toBe(true);
  });

  it("应该拒绝无效的拉流器状态转换", () => {
    expect(isValidSubscriberTransition("idle", "playing")).toBe(false);
    expect(isValidSubscriberTransition("stopped", "playing")).toBe(false);
  });
});

describe("getStreamStatusName", () => {
  it("应该返回流状态的显示名称", () => {
    expect(getStreamStatusName("idle")).toBe("空闲");
    expect(getStreamStatusName("publishing")).toBe("推流中");
    expect(getStreamStatusName("error")).toBe("错误");
    // 未知状态可能返回状态名本身或 "未知"
    const unknownName = getStreamStatusName("unknown" as any);
    expect(unknownName === "未知" || unknownName === "unknown").toBe(true);
  });
});

describe("getPublisherStatusName", () => {
  it("应该返回推流器状态的显示名称", () => {
    expect(getPublisherStatusName("idle")).toBe("空闲");
    expect(getPublisherStatusName("connecting")).toBe("连接中");
    expect(getPublisherStatusName("connected")).toBe("已连接");
    expect(getPublisherStatusName("publishing")).toBe("推流中");
    expect(getPublisherStatusName("stopped")).toBe("已停止");
    expect(getPublisherStatusName("error")).toBe("错误");
    // 未知状态可能返回状态名本身或 "未知"
    const unknownName = getPublisherStatusName("unknown" as any);
    expect(unknownName === "未知" || unknownName === "unknown").toBe(true);
  });
});

describe("getSubscriberStatusName", () => {
  it("应该返回拉流器状态的显示名称", () => {
    expect(getSubscriberStatusName("idle")).toBe("空闲");
    expect(getSubscriberStatusName("connecting")).toBe("连接中");
    expect(getSubscriberStatusName("connected")).toBe("已连接");
    expect(getSubscriberStatusName("playing")).toBe("播放中");
    expect(getSubscriberStatusName("buffering")).toBe("缓冲中");
    expect(getSubscriberStatusName("stopped")).toBe("已停止");
    expect(getSubscriberStatusName("error")).toBe("错误");
    // 未知状态可能返回状态名本身或 "未知"
    const unknownName = getSubscriberStatusName("unknown" as any);
    expect(unknownName === "未知" || unknownName === "unknown").toBe(true);
  });
});

describe("isActiveStatus", () => {
  it("应该正确判断流状态是否为活动状态", () => {
    expect(isActiveStatus("idle")).toBe(false);
    expect(isActiveStatus("publishing")).toBe(true);
    expect(isActiveStatus("error")).toBe(false);
    expect(isActiveStatus("playing")).toBe(true);
    expect(isActiveStatus("stopped")).toBe(false);
  });
});

describe("isErrorStatus", () => {
  it("应该正确判断状态是否为错误状态", () => {
    expect(isErrorStatus("idle")).toBe(false);
    expect(isErrorStatus("publishing")).toBe(false);
    expect(isErrorStatus("error")).toBe(true);
    expect(isErrorStatus("playing")).toBe(false);
  });
});
