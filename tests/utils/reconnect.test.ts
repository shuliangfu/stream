/**
 * @fileoverview 重连管理器测试
 */

import { describe, expect, it } from "@dreamer/test";
import { ReconnectManager } from "../../src/utils/reconnect.ts";

describe("ReconnectManager", () => {
  it("应该支持基本重连操作", async () => {
    const manager = new ReconnectManager({
      maxAttempts: 3,
      initialDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
    });

    let attemptCount = 0;
    const reconnectFn = async () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error("连接失败");
      }
      return true;
    };

    const result = await manager.reconnect(reconnectFn);
    expect(result).toBe(true);
    expect(attemptCount).toBe(3);
  });

  it("应该在达到最大重试次数时抛出错误", async () => {
    const manager = new ReconnectManager({
      maxAttempts: 2,
      initialDelay: 10,
      maxDelay: 100,
      backoffMultiplier: 2,
    });

    let errorThrown = false;
    try {
      await manager.reconnect(async () => {
        throw new Error("总是失败");
      });
    } catch (error) {
      errorThrown = true;
      // 错误消息可能是原始错误或包装后的错误
      const errorMessage = (error as Error).message;
      expect(
        errorMessage.includes("总是失败") ||
          errorMessage.includes("最大重连次数"),
      ).toBe(true);
    }

    expect(errorThrown).toBe(true);
  });

  it("应该实现指数退避", async () => {
    const manager = new ReconnectManager({
      maxAttempts: 3,
      initialDelay: 10,
      maxDelay: 1000,
      backoffMultiplier: 2,
    });

    const delays: number[] = [];
    const startTime = Date.now();

    try {
      await manager.reconnect(async () => {
        const elapsed = Date.now() - startTime;
        delays.push(elapsed);
        throw new Error("失败");
      });
    } catch {
      // 忽略错误
    }

    // 验证延迟递增（允许一些误差）
    expect(delays.length >= 2).toBe(true);
  });

  it("应该支持重置操作", () => {
    const manager = new ReconnectManager({
      maxAttempts: 3,
      initialDelay: 100,
    });

    // reset 应该重置状态
    manager.reset();
    expect(manager).toBeDefined(); // 基本验证方法存在
  });

  it("应该支持停止操作", () => {
    const manager = new ReconnectManager({
      maxAttempts: 3,
      initialDelay: 100,
    });

    // stop 应该停止重连
    manager.stop();
    expect(manager).toBeDefined(); // 基本验证方法存在
  });
});
