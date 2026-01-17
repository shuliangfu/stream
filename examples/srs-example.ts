/**
 * @fileoverview SRS 流媒体服务器示例
 *
 * 演示如何使用 SRS 适配器进行推流和拉流
 */

import { StreamManager } from "../src/mod.ts";

/**
 * SRS 推流和拉流示例
 */
async function srsExample() {
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
    await manager.connect();

    // 创建流
    const stream = await manager.createStream({
      name: "srs-stream",
      protocol: "rtmp",
    });

    console.log("流创建成功:", stream);
    console.log("推流地址:", stream.publisherUrl);
    console.log("拉流地址:", stream.subscriberUrls);

    // 创建推流器
    const publisher = await manager.createPublisher(stream.id);
    await publisher.connect(stream.publisherUrl!);
    await publisher.publish("./input.mp4");

    console.log("推流已开始");

    // 创建拉流器
    const subscriber = await manager.createSubscriber(stream.id);
    await subscriber.connect(
      stream.subscriberUrls.hls || stream.subscriberUrls.rtmp,
    );
    const streamData = await subscriber.subscribe();

    console.log("拉流已开始:", streamData);

    // 监听事件
    publisher.on("publishing", (data) => {
      console.log("推流状态:", data);
    });

    subscriber.on("playing", (data) => {
      console.log("拉流状态:", data);
    });

    // 运行 60 秒后停止
    setTimeout(async () => {
      await publisher.stop();
      await subscriber.stop();
      await manager.deleteStream(stream.id);
      await manager.disconnect();
      console.log("已停止所有流");
    }, 60000);
  } catch (error) {
    console.error("错误:", error);
  }
}

// 运行示例（如果直接运行此文件）
if (import.meta.main) {
  await srsExample().catch(console.error);
}
