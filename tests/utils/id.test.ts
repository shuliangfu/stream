/**
 * @fileoverview ID 生成工具测试
 */

import { describe, expect, it } from "@dreamer/test";
import {
  generateId,
  generateRoomId,
  generateStreamId,
} from "../../src/utils/id.ts";

describe("generateId", () => {
  it("应该生成带前缀的 ID", () => {
    const id = generateId("test");
    expect(typeof id).toBe("string");
    expect(id.startsWith("test-")).toBe(true);
  });

  it("应该生成唯一的 ID", () => {
    const id1 = generateId("test");
    const id2 = generateId("test");
    expect(id1).not.toBe(id2);
  });
});

describe("generateStreamId", () => {
  it("应该生成流 ID", () => {
    const id = generateStreamId();
    expect(typeof id).toBe("string");
    expect(id.startsWith("stream-")).toBe(true);
  });
});

describe("generateRoomId", () => {
  it("应该生成房间 ID", () => {
    const id = generateRoomId();
    expect(typeof id).toBe("string");
    expect(id.startsWith("room-")).toBe(true);
  });
});

describe("ID 生成器", () => {
  it("应该生成不同前缀的 ID", () => {
    const streamId = generateStreamId();
    const roomId = generateRoomId();

    expect(streamId.startsWith("stream-")).toBe(true);
    expect(roomId.startsWith("room-")).toBe(true);
    expect(streamId).not.toBe(roomId);
  });
});
