/**
 * @fileoverview 数据队列测试
 */

import { describe, expect, it } from "@dreamer/test";
import { DataQueue } from "../../src/utils/queue.ts";

describe("DataQueue", () => {
  it("应该支持基本操作", () => {
    const queue = new DataQueue<number>();

    expect(queue.enqueue(1)).toBe(true);
    expect(queue.enqueue(2)).toBe(true);
    expect(queue.size).toBe(2);
    expect(queue.isEmpty).toBe(false);
  });

  it("应该支持批量出队", () => {
    const queue = new DataQueue<number>({ batchSize: 3 });

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    queue.enqueue(4);

    const batch = queue.dequeueBatch();
    expect(batch.length).toBe(3);
    expect(batch).toEqual([1, 2, 3]);
    expect(queue.size).toBe(1);
  });

  it("应该限制队列大小", () => {
    const queue = new DataQueue<number>({ maxSize: 2 });
    let onFullCalled = false;

    const queueWithCallback = new DataQueue<number>({
      maxSize: 2,
      onFull: () => {
        onFullCalled = true;
      },
    });

    expect(queue.enqueue(1)).toBe(true);
    expect(queue.enqueue(2)).toBe(true);
    expect(queue.enqueue(3)).toBe(false); // 队列满，返回 false

    queueWithCallback.enqueue(1);
    queueWithCallback.enqueue(2);
    queueWithCallback.enqueue(3);
    expect(onFullCalled).toBe(true);
  });

  it("应该正确判断 isEmpty 和 isFull", () => {
    const queue = new DataQueue<number>({ maxSize: 2 });

    expect(queue.isEmpty).toBe(true);
    expect(queue.isFull).toBe(false);

    queue.enqueue(1);
    expect(queue.isEmpty).toBe(false);
    expect(queue.isFull).toBe(false);

    queue.enqueue(2);
    expect(queue.isFull).toBe(true);
  });

  it("应该支持清空操作", () => {
    const queue = new DataQueue<number>();

    queue.enqueue(1);
    queue.enqueue(2);
    queue.clear();

    expect(queue.size).toBe(0);
    expect(queue.isEmpty).toBe(true);
  });

  it("应该支持自动处理", async () => {
    const queue = new DataQueue<number>({
      batchSize: 2,
      batchInterval: 50,
    });

    const processed: number[] = [];

    queue.startProcessing(async (batch) => {
      processed.push(...batch);
    });

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    // 等待处理
    await new Promise((resolve) => setTimeout(resolve, 100));

    queue.stopProcessing();

    // 应该处理了至少一批数据
    expect(processed.length >= 2).toBe(true);
  });
});
