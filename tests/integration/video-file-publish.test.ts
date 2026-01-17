/**
 * @fileoverview 视频文件推流测试
 *
 * 测试视频文件推流功能
 */

import { assertRejects, describe, expect, it } from "@dreamer/test";
import { StreamManager } from "../../src/mod.ts";

/**
 * 获取测试视频文件路径
 */
function getTestVideoPath(): string {
  // 从当前文件位置计算测试数据目录
  // tests/integration/video-file-publish.test.ts -> tests/data/test.mp4
  const currentFile = new URL(import.meta.url).pathname;
  const currentDir = currentFile.substring(0, currentFile.lastIndexOf("/"));
  return `${currentDir}/../data/test.mp4`;
}

describe("视频文件推流", () => {
  it("应该能够使用视频文件进行推流", async () => {
    // 检查测试视频文件是否存在
    const videoPath = getTestVideoPath();
    try {
      await Deno.stat(videoPath);
    } catch {
      console.warn(`测试视频文件不存在: ${videoPath}，跳过测试`);
      return;
    }

    // 创建流管理器（使用 FFmpeg 适配器）
    const manager = new StreamManager({
      adapter: "ffmpeg",
      adapterConfig: {
        config: {
          host: "localhost",
          port: 1935,
          app: "live",
        },
      },
    });

    try {
      // 创建流
      const stream = await manager.createStream({
        name: "test-video-stream",
        protocol: "rtmp",
      });

      expect(stream).toBeTruthy();
      expect(stream.publisherUrl).toBeTruthy();

      // 创建推流器
      const publisher = await manager.createPublisher(stream.id);

      // 连接到推流服务器
      await publisher.connect(stream.publisherUrl!);

      // 开始推流（使用测试视频文件）
      await publisher.publish(videoPath);

      // 验证推流状态
      expect(publisher.status).toBe("publishing");

      // 等待一小段时间确保推流已开始（但不要太长，避免卡住）
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 停止推流（添加超时保护）
      const stopPromise = publisher.stop();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("停止推流超时")), 5000);
      });
      await Promise.race([stopPromise, timeoutPromise]);

      // 清理
      await manager.deleteStream(stream.id);
    } finally {
      await manager.disconnect();
    }
  }, {
    sanitizeOps: false,
    sanitizeResources: false,
  });

  it("应该支持循环播放视频文件", async () => {
    // 检查测试视频文件是否存在
    const videoPath = getTestVideoPath();
    try {
      await Deno.stat(videoPath);
    } catch {
      console.warn(`测试视频文件不存在: ${videoPath}，跳过测试`);
      return;
    }

    // 创建流管理器
    const manager = new StreamManager({
      adapter: "ffmpeg",
      adapterConfig: {
        config: {
          host: "localhost",
          port: 1935,
          app: "live",
        },
      },
    });

    try {
      // 创建流
      const stream = await manager.createStream({
        name: "test-video-loop-stream",
        protocol: "rtmp",
      });

      // 创建推流器
      const publisher = await manager.createPublisher(stream.id);

      // 连接到推流服务器，启用循环播放
      await publisher.connect(stream.publisherUrl!, {
        loop: true, // 启用循环播放
      });

      // 开始推流
      await publisher.publish(videoPath);

      // 验证推流状态
      expect(publisher.status).toBe("publishing");

      // 等待一小段时间确保推流已开始（但不要太长，避免卡住）
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 停止推流（添加超时保护）
      const stopPromise = publisher.stop();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("停止推流超时")), 5000);
      });
      await Promise.race([stopPromise, timeoutPromise]);

      // 清理
      await manager.deleteStream(stream.id);
    } finally {
      await manager.disconnect();
    }
  }, {
    sanitizeOps: false,
    sanitizeResources: false,
  });

  it("应该能够设置视频质量", async () => {
    // 检查测试视频文件是否存在
    const videoPath = getTestVideoPath();
    try {
      await Deno.stat(videoPath);
    } catch {
      console.warn(`测试视频文件不存在: ${videoPath}，跳过测试`);
      return;
    }

    // 创建流管理器
    const manager = new StreamManager({
      adapter: "ffmpeg",
      adapterConfig: {
        config: {
          host: "localhost",
          port: 1935,
          app: "live",
        },
      },
    });

    try {
      // 创建流
      const stream = await manager.createStream({
        name: "test-video-quality-stream",
        protocol: "rtmp",
      });

      // 创建推流器
      const publisher = await manager.createPublisher(stream.id);

      // 连接到推流服务器
      await publisher.connect(stream.publisherUrl!);

      // 设置视频质量
      publisher.setVideoQuality({
        width: 1280,
        height: 720,
        bitrate: 1500000, // 1.5Mbps
        fps: 30,
      });

      // 开始推流
      await publisher.publish(videoPath);

      // 验证推流状态
      expect(publisher.status).toBe("publishing");

      // 等待一小段时间确保推流已开始（但不要太长，避免卡住）
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 停止推流（添加超时保护）
      const stopPromise = publisher.stop();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("停止推流超时")), 5000);
      });
      await Promise.race([stopPromise, timeoutPromise]);

      // 清理
      await manager.deleteStream(stream.id);
    } finally {
      await manager.disconnect();
    }
  }, {
    sanitizeOps: false,
    sanitizeResources: false,
  });

  it("应该在不存在的视频文件时抛出错误", async () => {
    // 创建流管理器
    const manager = new StreamManager({
      adapter: "ffmpeg",
      adapterConfig: {
        config: {
          host: "localhost",
          port: 1935,
          app: "live",
        },
      },
    });

    try {
      // 创建流
      const stream = await manager.createStream({
        name: "test-invalid-video-stream",
        protocol: "rtmp",
      });

      // 创建推流器
      const publisher = await manager.createPublisher(stream.id);

      // 连接到推流服务器
      await publisher.connect(stream.publisherUrl!);

      // 尝试使用不存在的文件推流，应该抛出错误
      await assertRejects(
        async () => {
          await publisher.publish("./non-existent-video.mp4");
        },
        Error,
      );

      // 清理
      await manager.deleteStream(stream.id);
    } finally {
      await manager.disconnect();
    }
  }, {
    sanitizeOps: false,
    sanitizeResources: false,
  });
});
