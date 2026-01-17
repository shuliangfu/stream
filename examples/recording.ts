/**
 * @fileoverview 流录制示例
 *
 * 演示如何录制流
 */

import {
  recordStream,
  recordStreamRealtime,
  StreamManager,
} from "../src/mod.ts";

/**
 * 流录制示例
 */
async function recordingExample() {
  // 创建流管理器
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

  try {
    // 连接到 SRS 服务器
    await manager.connect();

    // 创建流
    const stream = await manager.createStream({
      name: "record-stream",
      protocol: "rtmp",
    });

    console.log("流创建成功:", stream);
    console.log("拉流地址:", stream.subscriberUrls.rtmp);

    // 方式1：使用管理器的录制功能（如果适配器支持）
    try {
      const outputPath = await manager.startRecording(stream.id, {
        output: "./recorded-stream.mp4",
        duration: 60, // 录制 60 秒
      });

      console.log("录制已开始，输出路径:", outputPath);

      // 60 秒后停止录制
      setTimeout(async () => {
        try {
          const finalPath = await manager.stopRecording(stream.id);
          console.log("录制已停止，最终路径:", finalPath);
        } catch (error) {
          console.error("停止录制失败:", error);
        }
      }, 60000);
    } catch (error) {
      console.warn("适配器不支持录制功能，跳过方式1:", error);
    }

    // 方式2：使用录制工具函数（实时录制）
    const subscriberUrl = stream.subscriberUrls.rtmp ||
      stream.subscriberUrls.hls;
    if (subscriberUrl) {
      const recording = await recordStreamRealtime(subscriberUrl, {
        output: "./recorded-realtime.mp4",
      });

      console.log("实时录制已开始，输出路径:", recording.outputPath);

      // 30 秒后停止录制
      setTimeout(async () => {
        await recording.stop();
        console.log("实时录制已停止");
      }, 30000);
    }

    // 方式3：使用录制工具函数（固定时长）
    if (subscriberUrl) {
      const result = await recordStream(subscriberUrl, {
        output: "./recorded-fixed.mp4",
        duration: 30, // 录制 30 秒
      });

      console.log("录制完成:");
      console.log("  输出路径:", result.outputPath);
      console.log("  文件大小:", result.size, "bytes");
      console.log("  录制时长:", result.duration, "秒");
    }
  } catch (error) {
    console.error("错误:", error);
  } finally {
    await manager.disconnect();
  }
}

// 运行示例（如果直接运行此文件）
if (import.meta.main) {
  await recordingExample().catch(console.error);
}
