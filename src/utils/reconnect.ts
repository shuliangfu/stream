/**
 * @fileoverview 重连工具
 *
 * 提供自动重连机制
 */

/**
 * 重连选项
 */
export interface ReconnectOptions {
  /** 最大重连次数（默认：Infinity） */
  maxAttempts?: number;
  /** 初始延迟（毫秒，默认：1000） */
  initialDelay?: number;
  /** 最大延迟（毫秒，默认：30000） */
  maxDelay?: number;
  /** 延迟增长倍数（默认：2） */
  backoffMultiplier?: number;
  /** 重连回调函数 */
  onReconnect?: (attempt: number) => void;
  /** 重连失败回调函数 */
  onFailed?: (error: Error) => void;
}

/**
 * 重连管理器
 */
export class ReconnectManager {
  private attempts = 0;
  private timer?: number;
  private readonly options:
    & Required<
      Pick<
        ReconnectOptions,
        "maxAttempts" | "initialDelay" | "maxDelay" | "backoffMultiplier"
      >
    >
    & ReconnectOptions;

  constructor(options: ReconnectOptions = {}) {
    this.options = {
      maxAttempts: options.maxAttempts ?? Infinity,
      initialDelay: options.initialDelay ?? 1000,
      maxDelay: options.maxDelay ?? 30000,
      backoffMultiplier: options.backoffMultiplier ?? 2,
      ...options,
    };
  }

  /**
   * 执行重连
   *
   * @param connectFn 连接函数
   * @returns Promise，成功时 resolve，失败时 reject
   */
  async reconnect<T>(connectFn: () => Promise<T>): Promise<T> {
    // 清除之前的定时器
    if (this.timer) {
      clearTimeout(this.timer);
    }

    // 检查是否超过最大重连次数
    if (this.attempts >= this.options.maxAttempts) {
      const error = new Error(
        `重连失败：已达到最大重连次数 ${this.options.maxAttempts}`,
      );
      this.options.onFailed?.(error);
      throw error;
    }

    // 计算延迟时间（指数退避）
    const delay = Math.min(
      this.options.initialDelay *
        Math.pow(this.options.backoffMultiplier, this.attempts),
      this.options.maxDelay,
    );

    // 等待延迟时间
    await new Promise<void>((resolve) => {
      this.timer = setTimeout(resolve, delay) as unknown as number;
    });

    this.attempts++;

    try {
      // 调用连接函数
      const result = await connectFn();
      // 连接成功，重置重连次数
      this.attempts = 0;
      this.options.onReconnect?.(this.attempts);
      return result;
    } catch (_error) {
      // 连接失败，继续重连
      return this.reconnect(connectFn);
    }
  }

  /**
   * 重置重连状态
   */
  reset(): void {
    this.attempts = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * 停止重连
   */
  stop(): void {
    this.reset();
  }
}
