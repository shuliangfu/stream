/**
 * @fileoverview 基础使用示例
 *
 * 演示如何使用 @dreamer/stream 进行基本的流管理
 */

import { StreamManager } from "../src/mod.ts";

/**
 * 基础流管理示例
 */
async function basicExample() {
  // 创建流管理器（使用 SRS 适配器）
  const manager = new StreamManager({
    adapter: "srs",
    adapterConfig: {
      config: {
        host: "localhost",
        rtmpPort: 1935,
        httpPort: 8080,
        apiUrl: "http://localhost:1985",
        app: "live",
      },
    },
  });

  // 连接到服务器
  await manager.connect();

  try {
    // 创建流
    const stream = await manager.createStream({
      name: "my-first-stream",
      protocol: "rtmp",
    });

    console.log("流创建成功:", stream);
    console.log("推流地址:", stream.publisherUrl);
    console.log("拉流地址:", stream.subscriberUrls);

    // 创建房间
    const room = await manager.createRoom({
      name: "我的直播间",
      description: "这是一个测试直播间",
      maxViewers: 100,
    });

    console.log("房间创建成功:", room);

    // 获取流统计信息
    const statistics = await manager.getStatistics(stream.id);
    console.log("流统计信息:", statistics);

    // 列出所有流
    const streams = await manager.listStreams();
    console.log("所有流:", streams);

    // 清理
    await manager.deleteStream(stream.id);
    await manager.deleteRoom(room.id);
  } finally {
    // 断开连接
    await manager.disconnect();
  }
}

/**
 * FFmpeg 适配器示例
 */
async function ffmpegExample() {
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
      name: "ffmpeg-stream",
      protocol: "rtmp",
    });

    console.log("FFmpeg 流创建成功:", stream);
    console.log("推流地址:", stream.publisherUrl);

    // 清理
    await manager.deleteStream(stream.id);
  } catch (error) {
    console.error("错误:", error);
  }
}

// 运行示例（如果直接运行此文件）
if (import.meta.main) {
  console.log("=== 基础流管理示例 ===");
  await basicExample().catch(console.error);

  console.log("\n=== FFmpeg 适配器示例 ===");
  await ffmpegExample().catch(console.error);
}
