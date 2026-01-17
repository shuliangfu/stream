/**
 * @fileoverview 使用 SRS 适配器进行视频文件推流示例
 *
 * 使用 SRS 适配器可以获得 HLS 播放地址，可在浏览器中直接播放
 */

import {
  addSignalListener,
  args,
  exists,
  exit,
} from "@dreamer/runtime-adapter";
import { StreamManager } from "../src/mod.ts";

/**
 * 使用 SRS 适配器进行视频文件推流
 *
 * @param videoPath 视频文件路径
 */
export async function videoFilePublishWithSRSExample(videoPath: string) {
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

  try {
    // 连接到 SRS 服务器
    // ⚠️ 注意：需要先启动 SRS 服务器
    // 运行: ./examples/start-srs.sh 或 docker run -d -p 1935:1935 -p 8080:8080 -p 1985:1985 --name srs ossrs/srs:latest
    await manager.connect();

    // 创建流
    const stream = await manager.createStream({
      name: "video-file-stream-srs",
      protocol: "rtmp",
    });

    console.log("流创建成功:", stream);
    console.log("推流地址:", stream.publisherUrl);
    console.log("\n播放地址（拉流地址）:");
    console.log("  RTMP:", stream.subscriberUrls.rtmp);
    console.log("  HLS:", stream.subscriberUrls.hls, "← 可在浏览器中播放");
    console.log("  FLV:", stream.subscriberUrls.flv);
    if (stream.subscriberUrls.webrtc) {
      console.log("  WebRTC:", stream.subscriberUrls.webrtc);
    }
    console.log("\n提示:");
    console.log("  - HLS 地址可直接在浏览器中打开播放");
    console.log("  - 或在 HTML5 video 标签中使用:");
    console.log(
      `    <video src="${stream.subscriberUrls.hls}" controls></video>`,
    );

    // 创建推流器
    const publisher = await manager.createPublisher(stream.id);

    // 连接到推流服务器，启用循环播放（视频文件会自动循环）
    await publisher.connect(stream.publisherUrl!, {
      loop: true, // 启用循环播放，视频文件会无限循环
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
    console.log(`\n开始推流视频文件: ${videoPath}（循环播放模式）`);
    await publisher.publish(videoPath);

    console.log("推流已开始，等待 SRS 识别流并生成 HLS 文件...");

    // 等待流被 SRS 识别（通常需要 2-5 秒）
    let streamReady = false;
    const maxWaitTime = 10000; // 最多等待 10 秒
    const checkInterval = 500; // 每 500ms 检查一次
    const startTime = Date.now();

    while (!streamReady && (Date.now() - startTime) < maxWaitTime) {
      try {
        // 检查流是否在 SRS 中存在
        const response = await fetch(
          `http://localhost:1985/api/v1/streams/${stream.id}`,
        );
        if (response.ok) {
          streamReady = true;
          console.log("✅ 流已被 SRS 识别，HLS 文件已生成");
          break;
        }
      } catch {
        // 忽略错误，继续等待
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      process.stdout.write(".");
    }

    if (!streamReady) {
      console.log(
        "\n⚠️  警告: 流可能还在初始化中，请稍等片刻后再尝试播放",
      );
    }

    console.log(
      `\n可以在浏览器中打开 HLS 地址观看: ${stream.subscriberUrls.hls}`,
    );
    console.log("或使用 mpv 播放:");
    console.log(`  mpv ${stream.subscriberUrls.hls}`);

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
    if (
      error instanceof Error && error.message.includes("Connection refused")
    ) {
      console.error("❌ 推流失败: 无法连接到 SRS 服务器");
      console.error("");
      console.error("请先启动 SRS 服务器:");
      console.error("  方式 1: 运行启动脚本");
      console.error("    ./examples/start-srs.sh");
      console.error("");
      console.error("  方式 2: 使用 Docker 手动启动");
      console.error(
        "    docker run -d -p 1935:1935 -p 8080:8080 -p 1985:1985 --name srs ossrs/srs:latest",
      );
      console.error("");
      console.error("  如果容器已存在，只需启动它:");
      console.error("    docker start srs");
      console.error("");
    } else {
      console.error("推流失败:", error);
    }
    throw error;
  }
}

// 运行示例（如果直接运行此文件）
if (import.meta.main) {
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
    console.log("使用 SRS 适配器，将自动生成 HLS 播放地址\n");
    const result = await videoFilePublishWithSRSExample(videoPath);

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
