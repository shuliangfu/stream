/**
 * @fileoverview 连接池管理
 *
 * 提供连接复用、保活和智能管理功能
 */

/**
 * 连接池选项
 */
export interface ConnectionPoolOptions {
  /** 最大连接数（默认：10） */
  maxConnections?: number;
  /** 连接超时时间（毫秒，默认：30000） */
  timeout?: number;
  /** 连接保活间隔（毫秒，默认：30000） */
  keepAliveInterval?: number;
  /** 连接空闲超时（毫秒，默认：60000） */
  idleTimeout?: number;
}

/**
 * 连接信息
 */
interface ConnectionInfo {
  id: string;
  url: string;
  connection: unknown; // WebSocket, HTTP Client 等
  createdAt: number;
  lastUsed: number;
  isActive: boolean;
}

/**
 * 连接池
 *
 * 特性：
 * - 连接复用（减少连接开销）
 * - 自动保活（防止连接断开）
 * - 空闲清理（释放未使用连接）
 * - 连接限制（防止资源耗尽）
 */
export class ConnectionPool {
  private connections: Map<string, ConnectionInfo> = new Map();
  private readonly maxConnections: number;
  private readonly timeout: number;
  private readonly keepAliveInterval: number;
  private readonly idleTimeout: number;
  private keepAliveTimer?: number;
  private cleanupTimer?: number;

  constructor(options: ConnectionPoolOptions = {}) {
    this.maxConnections = options.maxConnections ?? 10;
    this.timeout = options.timeout ?? 30000;
    this.keepAliveInterval = options.keepAliveInterval ?? 30000;
    this.idleTimeout = options.idleTimeout ?? 60000;

    // 启动保活和清理定时器
    this.startKeepAlive();
    this.startCleanup();
  }

  /**
   * 获取或创建连接
   *
   * @param url 连接 URL
   * @param factory 连接工厂函数
   * @returns 连接对象
   */
  async getConnection<T>(
    url: string,
    factory: () => Promise<T>,
  ): Promise<T> {
    const connectionId = this.getConnectionId(url);

    // 检查是否已有连接
    const existing = this.connections.get(connectionId);
    if (existing && existing.isActive) {
      existing.lastUsed = Date.now();
      return existing.connection as T;
    }

    // 检查连接数限制
    if (this.connections.size >= this.maxConnections) {
      // 尝试清理空闲连接
      this.cleanupIdleConnections();

      // 如果仍然超过限制，等待或抛出错误
      if (this.connections.size >= this.maxConnections) {
        throw new Error(
          `连接池已满（最大 ${this.maxConnections} 个连接）`,
        );
      }
    }

    // 创建新连接
    let timeoutId: number | undefined;
    try {
      const connection = await Promise.race([
        factory(),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error("连接超时")),
            this.timeout,
          ) as unknown as number;
        }),
      ]);

      // 清理超时定时器
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      // 记录连接信息
      this.connections.set(connectionId, {
        id: connectionId,
        url,
        connection,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isActive: true,
      });

      return connection;
    } catch (error) {
      // 清理超时定时器
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      throw new Error(
        `创建连接失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * 释放连接
   *
   * @param url 连接 URL
   * @param close 是否关闭连接（默认：false，仅标记为非活跃）
   */
  releaseConnection(url: string, close = false): void {
    const connectionId = this.getConnectionId(url);
    const connection = this.connections.get(connectionId);

    if (connection) {
      if (close) {
        // 关闭连接并移除
        this.closeConnection(connection);
        this.connections.delete(connectionId);
      } else {
        // 仅标记为非活跃
        connection.isActive = false;
      }
    }
  }

  /**
   * 关闭连接
   */
  private closeConnection(connection: ConnectionInfo): void {
    try {
      // 尝试关闭连接（如果支持）
      const conn = connection.connection as {
        close?: () => void;
        destroy?: () => void;
      };
      if (conn.close) {
        conn.close();
      } else if (conn.destroy) {
        conn.destroy();
      }
    } catch (error) {
      console.warn("关闭连接时出错:", error);
    }
  }

  /**
   * 清理空闲连接
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, connection] of this.connections.entries()) {
      // 清理空闲时间超过阈值的非活跃连接
      if (
        !connection.isActive &&
        now - connection.lastUsed > this.idleTimeout
      ) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      const connection = this.connections.get(id);
      if (connection) {
        this.closeConnection(connection);
        this.connections.delete(id);
      }
    }
  }

  /**
   * 启动保活机制
   */
  private startKeepAlive(): void {
    // 只在需要时启动定时器
    if (this.keepAliveInterval > 0) {
      this.keepAliveTimer = setInterval(() => {
        // 定期检查连接状态（如果需要）
        // 这里可以发送 ping 消息或检查连接状态
      }, this.keepAliveInterval) as unknown as number;
    }
  }

  /**
   * 启动清理机制
   */
  private startCleanup(): void {
    // 只在需要时启动定时器
    if (this.idleTimeout > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupIdleConnections();
      }, this.idleTimeout) as unknown as number;
    }
  }

  /**
   * 停止连接池
   */
  stop(): void {
    // 停止定时器
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // 关闭所有连接
    for (const connection of this.connections.values()) {
      this.closeConnection(connection);
    }
    this.connections.clear();
  }

  /**
   * 获取连接 ID
   */
  private getConnectionId(url: string): string {
    try {
      const urlObj = new URL(url);
      // 使用协议 + 主机 + 端口作为连接 ID（忽略路径和查询参数）
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch {
      return url;
    }
  }

  /**
   * 获取连接池统计信息
   */
  getStats(): {
    total: number;
    active: number;
    idle: number;
  } {
    let active = 0;
    for (const connection of this.connections.values()) {
      if (connection.isActive) {
        active++;
      }
    }

    return {
      total: this.connections.size,
      active,
      idle: this.connections.size - active,
    };
  }
}
