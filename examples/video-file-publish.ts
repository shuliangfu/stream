/**
 * @fileoverview 视频文件推流示例
 *
 * 演示如何读取视频文件并推流到流媒体服务器
 */

import {
  addSignalListener,
  args,
  exists,
  exit,
} from "@dreamer/runtime-adapter";
import { StreamManager } from "../src/mod.ts";

/**
 * 视频文件推流示例
 *
 * @param videoPath 视频文件路径
 * @param rtmpUrl RTMP 推流地址（可选，如果不提供则使用 StreamManager 创建的流）
 */
export async function videoFilePublishExample(
  videoPath: string,
  rtmpUrl?: string,
) {
  // 创建流管理器（使用 FFmpeg 适配器）
  // ⚠️ 注意：FFmpeg 适配器需要先启动 RTMP 服务器（如 SRS 或 nginx-rtmp）
  // 如果没有运行 RTMP 服务器，推流会失败
  // 推荐使用 SRS 适配器（见 video-file-publish-srs.ts），它会自动连接到 SRS 服务器
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
      name: "video-file-stream",
      protocol: "rtmp",
    });

    console.log("流创建成功:", stream);
    console.log("推流地址:", stream.publisherUrl);
    console.log("拉流地址（播放地址）:");
    console.log("  RTMP:", stream.subscriberUrls.rtmp || "无");
    console.log("  HLS:", stream.subscriberUrls.hls || "无（需要 SRS 适配器）");
    console.log("  FLV:", stream.subscriberUrls.flv || "无（需要 SRS 适配器）");
    console.log("\n⚠️  重要提示:");
    console.log("  - FFmpeg 适配器需要先启动 RTMP 服务器（如 SRS）");
    console.log("  - 如果没有运行 RTMP 服务器，推流和播放都会失败");
    console.log(
      "  - 推荐使用 SRS 适配器（运行: deno run -A examples/video-file-publish-srs.ts）",
    );
    console.log(
      "  - 或先启动 SRS: docker run -p 1935:1935 -p 8080:8080 ossrs/srs:latest",
    );

    // 创建推流器
    const publisher = await manager.createPublisher(stream.id);

    // 连接到推流服务器（使用提供的 URL 或默认流地址）
    // 默认启用循环播放，视频文件会自动循环
    const publishUrl = rtmpUrl || stream.publisherUrl!;
    await publisher.connect(publishUrl, {
      loop: true, // 启用循环播放，视频文件会无限循环
    });

    // 设置视频质量（可选）
    publisher.setVideoQuality({
      width: 1920,
      height: 1080,
      bitrate: 2000000, // 2Mbps
      fps: 30,
    });

    // 监听事件
    publisher.on("publishing", (data) => {
      console.log("推流中:", data);
    });

    publisher.on("error", (error) => {
      console.error("推流错误:", error);
    });

    publisher.on("disconnected", () => {
      console.log("推流已断开");
    });

    // 开始推流（已启用循环播放，视频文件会自动循环）
    console.log(`开始推流视频文件: ${videoPath}（循环播放模式）`);
    await publisher.publish(videoPath);

    console.log("推流已开始，视频文件正在推流中...");

    // 返回 publisher 以便外部控制停止
    return {
      publisher,
      stream,
      manager,
      stop: async () => {
        await publisher.stop();
        console.log("推流已停止");
        await manager.deleteStream(stream.id);
        await manager.disconnect();
      },
    };
  } catch (error) {
    console.error("推流失败:", error);
    throw error;
  }
}

/**
 * 循环播放视频文件推流示例（使用 FFmpeg 内置循环功能）
 *
 * @param videoPath 视频文件路径
 * @param rtmpUrl RTMP 推流地址
 * @param loop 是否循环播放（true 表示无限循环，false 表示不循环）
 */
export async function videoFileLoopPublishExample(
  videoPath: string,
  rtmpUrl?: string,
  loop: boolean = true,
) {
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
    const stream = await manager.createStream({
      name: "video-file-loop-stream",
      protocol: "rtmp",
    });

    console.log("流创建成功:", stream);
    console.log("推流地址:", stream.publisherUrl);

    const publisher = await manager.createPublisher(stream.id);
    const publishUrl = rtmpUrl || stream.publisherUrl!;

    // 使用 FFmpeg 内置循环功能，在连接时设置 loop 选项
    await publisher.connect(publishUrl, {
      loop: loop, // true 表示无限循环
    });

    // 监听事件
    publisher.on("publishing", (data) => {
      console.log("推流中:", data);
    });

    publisher.on("error", (error) => {
      console.error("推流错误:", error);
    });

    publisher.on("disconnected", () => {
      console.log("推流已断开");
    });

    // 开始推流（FFmpeg 会自动处理循环）
    console.log(
      `开始循环推流视频文件: ${videoPath}，循环播放: ${
        loop ? "是（无限循环）" : "否"
      }`,
    );
    await publisher.publish(videoPath);

    return {
      publisher,
      stream,
      manager,
      stop: async () => {
        await publisher.stop();
        console.log("循环推流已停止");
        await manager.deleteStream(stream.id);
        await manager.disconnect();
      },
    };
  } catch (error) {
    console.error("循环推流失败:", error);
    throw error;
  }
}

// 运行示例（如果直接运行此文件）
if (import.meta.main) {
  // 示例 1: 单次推流
  console.log("=== 示例 1: 单次视频文件推流 ===");
  // 默认使用 examples/data/test.mp4，也可以通过命令行参数指定
  const commandArgs = args();
  const videoPath = commandArgs[0] || "./examples/data/test.mp4";

  // 检查文件是否存在
  if (!(await exists(videoPath))) {
    console.error(`视频文件不存在: ${videoPath}`);
    console.error("请确保文件存在，或通过命令行参数指定视频文件路径");
    exit(1);
  }

  try {
    console.log(`使用视频文件: ${videoPath}`);
    const result = await videoFilePublishExample(videoPath);

    console.log("\n✅ 推流已开始，将持续运行（循环播放模式）");
    console.log("按 Ctrl+C 停止推流\n");

    // 监听进程退出信号，优雅地停止推流
    const stopStream = async () => {
      console.log("\n正在停止推流...");
      await result.stop();
      exit(0);
    };

    // 监听 SIGINT (Ctrl+C) 和 SIGTERM 信号（跨运行时兼容）
    addSignalListener("SIGINT", stopStream);
    addSignalListener("SIGTERM", stopStream);

    // 保持进程运行，直到用户手动停止
    // 推流会持续运行，视频文件会自动循环播放
    // 使用一个永远不会解决的 Promise 来保持进程运行
    await new Promise(() => {});
  } catch (error) {
    console.error("推流失败:", error);
    exit(1);
  }
}
