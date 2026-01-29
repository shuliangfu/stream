/**
 * @fileoverview 批量操作测试
 */

import { describe, expect, it } from "@dreamer/test";
import {
  batchCreateStreams,
  batchDeleteStreams,
  batchGetStreams,
  batchProcess,
} from "../../src/utils/batch-operations.ts";

describe("batchProcess", () => {
  it("应该支持基本批量处理", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await batchProcess(
      items,
      async (item) => item * 2,
      { concurrency: 2 },
    );

    expect(results.successes.length).toBe(5);
    expect(results.failures.length).toBe(0);
    expect(results.successes[0].result).toBe(2);
    expect(results.successes[4].result).toBe(10);
  });

  it("应该支持错误处理", async () => {
    const items = [1, 2, 3];
    const results = await batchProcess(
      items,
      async (item) => {
        if (item === 2) {
          throw new Error("测试错误");
        }
        return item * 2;
      },
      { concurrency: 2, continueOnError: true },
    );

    expect(results.successes.length).toBe(2);
    expect(results.failures.length).toBe(1);
    expect(results.failures[0].error.message).toBe("测试错误");
  });

  it("应该在不继续错误时抛出异常", async () => {
    const items = [1, 2, 3];
    let errorThrown = false;

    try {
      await batchProcess(
        items,
        async (item) => {
          if (item === 2) {
            throw new Error("测试错误");
          }
          return item * 2;
        },
        { concurrency: 2, continueOnError: false },
      );
    } catch (error) {
      errorThrown = true;
      expect((error as Error).message).toBe("测试错误");
    }

    expect(errorThrown).toBe(true);
  });

  it("应该控制并发数", async () => {
    const items = [1, 2, 3, 4, 5];
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    await batchProcess(
      items,
      async (item) => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentConcurrent--;
        return item;
      },
      { concurrency: 2 },
    );

    // 最大并发数应该不超过 2
    expect(maxConcurrent <= 2).toBe(true);
  });
});

describe("batchCreateStreams", () => {
  it("应该批量创建流", async () => {
    const items = ["stream-1", "stream-2"];
    const results = await batchCreateStreams(
      items,
      async (id) => ({ id, name: `Stream ${id}` }),
    );

    expect(results.successes.length).toBe(2);
    expect(results.failures.length).toBe(0);
  });
});

describe("batchDeleteStreams", () => {
  it("应该批量删除流", async () => {
    const streamIds = ["stream-1", "stream-2"];
    const results = await batchDeleteStreams(
      streamIds,
      async (id) => {
        // 模拟删除操作
        if (id === "stream-1") {
          throw new Error("删除失败");
        }
      },
      { continueOnError: true },
    );

    expect(results.successes.length).toBe(1);
    expect(results.failures.length).toBe(1);
  });
});

describe("batchGetStreams", () => {
  it("应该批量获取流", async () => {
    const streamIds = ["stream-1", "stream-2", "stream-3"];
    const results = await batchGetStreams(
      streamIds,
      async (id) => ({ id, name: `Stream ${id}` }),
    );

    expect(results.successes.length).toBe(3);
    expect((results.successes[0].result as { id: string }).id).toBe("stream-1");
  });
});
