/**
 * @fileoverview FFmpeg 推流示例
 *
 * 演示如何使用 FFmpeg 适配器进行推流
 */

import { StreamManager } from "../src/mod.ts";

/**
 * FFmpeg 推流示例
 */
async function ffmpegPublishExample() {
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

    console.log("流创建成功:", stream);
    console.log("推流地址:", stream.publisherUrl);

    // 创建推流器
    const publisher = await manager.createPublisher(stream.id);

    // 连接到推流服务器
    await publisher.connect(stream.publisherUrl!);

    // 开始推流（使用文件路径）
    await publisher.publish("./input.mp4");

    console.log("推流已开始");

    // 监听事件
    publisher.on("publishing", (data) => {
      console.log("推流中:", data);
    });

    publisher.on("error", (error) => {
      console.error("推流错误:", error);
    });

    // 运行 30 秒后停止
    setTimeout(async () => {
      await publisher.stop();
      console.log("推流已停止");
      await manager.deleteStream(stream.id);
    }, 30000);
  } catch (error) {
    console.error("错误:", error);
  }
}

// 运行示例（如果直接运行此文件）
if (import.meta.main) {
  await ffmpegPublishExample().catch(console.error);
}
