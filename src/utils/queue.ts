/**
 * @fileoverview 高性能数据队列
 *
 * 提供有界队列、背压机制和批量处理功能
 */

/**
 * 队列选项
 */
export interface QueueOptions {
  /** 最大队列大小（默认：100） */
  maxSize?: number;
  /** 批量处理大小（默认：10） */
  batchSize?: number;
  /** 批量处理间隔（毫秒，默认：100） */
  batchInterval?: number;
  /** 队列满时的回调 */
  onFull?: () => void;
  /** 队列空时的回调 */
  onEmpty?: () => void;
}

/**
 * 高性能数据队列
 *
 * 特性：
 * - 有界队列（防止内存溢出）
 * - 背压机制（队列满时暂停）
 * - 批量处理（提高效率）
 * - 自动清理
 */
export class DataQueue<T> {
  private queue: T[] = [];
  private readonly maxSize: number;
  private readonly batchSize: number;
  private readonly batchInterval: number;
  private processing = false;
  private timer?: number;
  private readonly onFull?: () => void;
  private readonly onEmpty?: () => void;

  constructor(options: QueueOptions = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.batchSize = options.batchSize ?? 10;
    this.batchInterval = options.batchInterval ?? 100;
    this.onFull = options.onFull;
    this.onEmpty = options.onEmpty;
  }

  /**
   * 添加数据到队列
   *
   * @param data 数据
   * @returns 是否成功添加（如果队列满则返回 false）
   */
  enqueue(data: T): boolean {
    if (this.queue.length >= this.maxSize) {
      // 队列满，触发背压
      this.onFull?.();
      return false;
    }

    this.queue.push(data);

    // 如果队列从空变为有数据，触发回调
    if (this.queue.length === 1) {
      this.onEmpty?.();
    }

    return true;
  }

  /**
   * 批量出队
   *
   * @returns 数据数组
   */
  dequeueBatch(): T[] {
    if (this.queue.length === 0) {
      return [];
    }

    const batch = this.queue.splice(0, this.batchSize);
    return batch;
  }

  /**
   * 获取队列大小
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * 检查队列是否为空
   */
  get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * 检查队列是否已满
   */
  get isFull(): boolean {
    return this.queue.length >= this.maxSize;
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * 开始自动处理队列
   *
   * @param processor 处理函数
   */
  startProcessing(processor: (batch: T[]) => Promise<void>): void {
    if (this.processing) {
      return;
    }

    this.processing = true;
    this.process(processor);
  }

  /**
   * 停止自动处理
   */
  stopProcessing(): void {
    this.processing = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * 处理队列
   */
  private async process(
    processor: (batch: T[]) => Promise<void>,
  ): Promise<void> {
    if (!this.processing) {
      return;
    }

    const batch = this.dequeueBatch();
    if (batch.length > 0) {
      try {
        await processor(batch);
      } catch (error) {
        console.error("队列处理错误:", error);
      }
    }

    // 继续处理
    if (this.processing) {
      this.timer = setTimeout(() => {
        this.process(processor);
      }, this.batchInterval) as unknown as number;
    }
  }
}
