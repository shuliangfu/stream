/**
 * @fileoverview 批量操作工具
 *
 * 提供批量流操作的并行处理功能
 */

/**
 * 批量操作选项
 */
export interface BatchOptions {
  /** 并发数（默认：5） */
  concurrency?: number;
  /** 是否在错误时继续（默认：false） */
  continueOnError?: boolean;
}

/**
 * 批量操作结果
 */
export interface BatchResult<T> {
  /** 成功的结果 */
  successes: Array<{ index: number; result: T }>;
  /** 失败的结果 */
  failures: Array<{ index: number; error: Error }>;
}

/**
 * 批量执行异步操作
 *
 * @param items 要处理的项
 * @param processor 处理函数
 * @param options 选项
 * @returns 批量操作结果
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: BatchOptions = {},
): Promise<BatchResult<R>> {
  const concurrency = options.concurrency ?? 5;
  const continueOnError = options.continueOnError ?? false;

  const successes: Array<{ index: number; result: R }> = [];
  const failures: Array<{ index: number; error: Error }> = [];

  // 分批处理
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map(async (item, batchIndex) => {
      const index = i + batchIndex;
      try {
        const result = await processor(item, index);
        successes.push({ index, result });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        failures.push({ index, error: err });

        if (!continueOnError) {
          throw err;
        }
      }
    });

    await Promise.all(batchPromises);
  }

  return { successes, failures };
}

/**
 * 批量创建流
 */
export async function batchCreateStreams<T>(
  items: T[],
  creator: (item: T) => Promise<unknown>,
  options?: BatchOptions,
): Promise<BatchResult<unknown>> {
  return batchProcess(items, creator, options);
}

/**
 * 批量删除流
 */
export async function batchDeleteStreams(
  streamIds: string[],
  deleter: (streamId: string) => Promise<void>,
  options?: BatchOptions,
): Promise<BatchResult<void>> {
  return batchProcess(streamIds, deleter, options);
}

/**
 * 批量获取流
 */
export async function batchGetStreams(
  streamIds: string[],
  getter: (streamId: string) => Promise<unknown>,
  options?: BatchOptions,
): Promise<BatchResult<unknown>> {
  return batchProcess(streamIds, getter, options);
}
