# @dreamer/stream

> 一个兼容 Deno 和 Bun 的直播流媒体库，提供完整的直播推流、拉流、管理和处理功能

**English**: [README](../../README.md) · **Test report (EN)**:
[en-US/TEST_REPORT.md](../en-US/TEST_REPORT.md)

[![JSR](https://jsr.io/badges/@dreamer/stream)](https://jsr.io/@dreamer/stream)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](../../LICENSE)
[![Tests: 217 passed](https://img.shields.io/badge/Tests-217%20passed-brightgreen)](./TEST_REPORT.md)

---

## 🎯 功能

直播流媒体库，用于直播推流、拉流、流管理和处理等场景，支持服务端和客户端。

---

## 📦 安装

### Deno

```bash
deno add jsr:@dreamer/stream
```

### Bun

```bash
bunx jsr add @dreamer/stream
```

---

## 🌍 环境兼容性

| 环境       | 版本要求 | 状态                                                                                                                                                                                                                           |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Deno**   | 2.5+     | ✅ 完全支持                                                                                                                                                                                                                    |
| **Bun**    | 1.0+     | ✅ 完全支持                                                                                                                                                                                                                    |
| **服务端** | -        | ✅ 支持（兼容 Deno 和 Bun 运行时，支持 SRS 和 FFmpeg 适配器）                                                                                                                                                                  |
| **客户端** | -        | ✅ 支持（浏览器环境，通过 `jsr:@dreamer/stream/client` 使用客户端推拉流）                                                                                                                                                      |
| **依赖**   | -        | 📦 SRS 适配器需要 SRS 服务器（可选）<br>📦 FFmpeg 适配器需要 FFmpeg 和外部 RTMP 服务器（可选）<br>📦 nginx-rtmp 适配器需要 nginx-rtmp-module 与 /stat（可选）<br>📦 LiveKit 适配器需要 LiveKit 服务与 apiKey/apiSecret（可选） |

---

## ✨ 特性

- **推流功能**：
  - 视频文件推流（支持自动循环播放）
  - 服务端支持文件路径、Blob、File 作为媒体源；HLS 推流通过 FFmpeg 转码为
    m3u8+ts（`getHlsPlaylistPath()` 获取播放列表路径）
  - 实时视频流推流
  - 自定义视频质量（分辨率、码率、帧率）
  - 支持音频/视频开关控制
- **拉流功能**：
  - 从流媒体服务器拉取视频流
  - 支持多种播放协议
- **流管理**：
  - 创建、删除、查询流资源
  - 流状态管理
  - 流统计信息
- **房间管理**：
  - 创建、删除、查询直播房间
  - 房间与流关联
  - 房间统计信息
- **录制功能**：
  - 录制直播流
  - 自定义录制参数
- **多协议支持**：
  - RTMP（实时消息传输协议）
  - HLS（HTTP 直播流）
  - FLV（Flash 视频）
  - WebRTC（Web 实时通信）
  - DASH（动态自适应流）
- **多服务器支持**：
  - SRS 适配器（推荐，支持 HLS 自动生成）
  - FFmpeg 适配器（需要外部 RTMP 服务器）
  - nginx-rtmp 适配器（通过 /stat 获取流列表）
  - LiveKit 适配器（Room API，需 apiKey/apiSecret）
- **适配器模式**：
  - 统一的适配器接口（StreamAdapter）
  - SRS、FFmpeg、nginx-rtmp、LiveKit、自定义（custom）
  - 运行时切换适配器
- **工具函数**：
  - 协议检测和验证
  - URL 生成（推流、拉流）
  - FFmpeg 推拉流（`publishWithFFmpeg`、`subscribeWithFFmpeg`）、HLS
    转码（`transcodeToHLS`）
  - 状态管理（状态转换验证）
  - ID 生成（流 ID、房间 ID）
  - 缓存（LRU 缓存、流缓存）
  - 队列（数据队列）
  - 连接池（连接复用）
  - 重连管理（指数退避）
  - 批量操作（批量创建、删除、获取）
- **服务容器集成**：
  - 支持 `@dreamer/service` 依赖注入
  - 管理多个 StreamManager 实例
  - 提供 `createStreamManager` 工厂函数

---

## 📌 当前支持的适配器与协议

### 适配器

| 适配器         | 说明                                                                         | 状态      |
| -------------- | ---------------------------------------------------------------------------- | --------- |
| **srs**        | SRS (Simple Realtime Server)，推荐，支持 HLS 自动生成                        | ✅ 已实现 |
| **ffmpeg**     | 通过 FFmpeg 推拉流，需外部 RTMP 服务器                                       | ✅ 已实现 |
| **nginx-rtmp** | nginx-rtmp-module，通过 /stat 获取流列表，推拉流用 RTMP/HLS/FLV              | ✅ 已实现 |
| **livekit**    | LiveKit Room 映射为流，需 apiKey/apiSecret，推拉流需配合 LiveKit SDK + token | ✅ 已实现 |
| **custom**     | 注入自定义 `StreamAdapter` 实现                                              | ✅ 已实现 |

### 服务端协议建议

- **推流**：支持**文件路径、Blob、File**；推荐 **RTMP/FLV**（FFmpeg
  推流）；**HLS** 支持通过 FFmpeg 转码为 m3u8+ts，使用 `getHlsPlaylistPath()`
  获取播放列表路径后由应用提供 HTTP 播放；WebRTC/MediaStream
  请使用客户端推流器。
- **拉流**：推荐 **HLS / DASH**（返回播放 URL）；RTMP/FLV 使用 FFmpeg
  拉流到文件；WebRTC 拉流建议使用客户端拉流器（需信令服务器）。

### 房间与列表

- **房间**：`createRoom` / `listRooms` 等为**内存存储**，不与 SRS/FFmpeg
  同步，进程重启后丢失。
- **列表过滤**：`listStreams(options)` 和 `listRooms(options)` 支持
  `options.filter`。流支持 `name`、`roomId`、`status`、`protocol`；房间支持
  `name`、`isPrivate`。

---

## 🎨 设计原则

__所有 @dreamer/_ 库都遵循以下原则_*：

- **主包（@dreamer/xxx）**：用于服务端（兼容 Deno 和 Bun 运行时）
- **客户端子包（@dreamer/xxx/client）**：用于客户端（浏览器环境）

这样可以：

- 明确区分服务端和客户端代码
- 避免在客户端代码中引入服务端依赖
- 提供更好的类型安全和代码提示
- 支持更好的 tree-shaking

---

## 🎯 使用场景

- **直播推流**：将视频流推送到流媒体服务器
- **视频点播**：视频文件推流，支持循环播放
- **流管理**：创建、管理、监控直播流
- **房间管理**：管理直播房间和频道
- **流录制**：录制直播流为视频文件
- **多协议支持**：支持 RTMP、HLS、FLV、WebRTC、DASH 等多种协议
- **多服务器支持**：支持 SRS、FFmpeg、nginx-rtmp、LiveKit 等流媒体服务器

---

## 🚀 快速开始

### SRS 适配器（推荐）

SRS 适配器支持自动生成 HLS 播放地址，可在浏览器中直接播放。

```typescript
import { StreamManager } from "jsr:@dreamer/stream";

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

// 创建流
const stream = await manager.createStream({
  name: "my-stream",
  protocol: "rtmp",
});

console.log("推流地址:", stream.publisherUrl);
// rtmp://localhost:1935/live/stream-xxx

console.log("拉流地址:", stream.subscriberUrls);
// {
//   rtmp: "rtmp://localhost:1935/live/stream-xxx",
//   hls: "http://localhost:8080/live/stream-xxx.m3u8",
//   flv: "http://localhost:8080/live/stream-xxx.flv",
//   webrtc: "webrtc://localhost:8000/live/stream-xxx"
// }

// 创建推流器
const publisher = await manager.createPublisher(stream.id);

// 连接到推流服务器
await publisher.connect(stream.publisherUrl!, {
  loop: true, // 启用循环播放
});

// 开始推流（使用视频文件）
await publisher.publish("./video.mp4");

// HLS 播放地址会自动生成，可在浏览器中播放
console.log("HLS 播放地址:", stream.subscriberUrls.hls);

// 停止推流
await publisher.stop();

// 清理
await manager.deleteStream(stream.id);
await manager.disconnect();
```

### FFmpeg 适配器

FFmpeg 适配器需要外部 RTMP 服务器（如 SRS 或 nginx-rtmp）。

```typescript
import { StreamManager } from "jsr:@dreamer/stream";

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

// 创建流
const stream = await manager.createStream({
  name: "my-stream",
  protocol: "rtmp",
});

// 创建推流器
const publisher = await manager.createPublisher(stream.id);

// 连接到推流服务器
await publisher.connect(stream.publisherUrl!, {
  loop: true, // 启用循环播放
});

// 开始推流（使用视频文件）
await publisher.publish("./video.mp4");

// 停止推流
await publisher.stop();

// 清理
await manager.deleteStream(stream.id);
```

### 房间管理

```typescript
import { StreamManager } from "jsr:@dreamer/stream";

const manager = new StreamManager({
  adapter: "srs",
});

await manager.connect();

// 创建房间
const room = await manager.createRoom({
  name: "我的直播间",
  maxViewers: 100,
});

// 将流关联到房间
const stream = await manager.createStream({
  name: "room-stream",
  protocol: "rtmp",
  roomId: room.id,
});

// 获取房间信息
const roomInfo = await manager.getRoom(room.id);
console.log(roomInfo);

// 清理
await manager.deleteStream(stream.id);
await manager.deleteRoom(room.id);
await manager.disconnect();
```

### 流录制

```typescript
import { StreamManager } from "jsr:@dreamer/stream";

const manager = new StreamManager({
  adapter: "srs",
});

await manager.connect();

const stream = await manager.createStream({
  name: "record-stream",
  protocol: "rtmp",
});

// 开始录制
const outputPath = await manager.startRecording(stream.id, {
  output: "./recorded-stream.mp4",
  duration: 60, // 录制 60 秒
});

console.log("录制已开始，输出路径:", outputPath);

// 停止录制
const finalPath = await manager.stopRecording(stream.id);
console.log("录制已停止，最终路径:", finalPath);

// 清理
await manager.deleteStream(stream.id);
await manager.disconnect();
```

### 自定义视频质量

```typescript
import { StreamManager } from "jsr:@dreamer/stream";

const manager = new StreamManager({
  adapter: "ffmpeg",
});

const stream = await manager.createStream({
  name: "quality-stream",
  protocol: "rtmp",
});

const publisher = await manager.createPublisher(stream.id);

// 设置视频质量
publisher.setVideoQuality({
  width: 1920,
  height: 1080,
  bitrate: 5000000, // 5Mbps
  fps: 30,
});

await publisher.connect(stream.publisherUrl!);
await publisher.publish("./video.mp4");

// 停止推流
await publisher.stop();
await manager.deleteStream(stream.id);
```

---

## 📚 API 文档

### StreamManager

流管理器，提供统一的流和房间管理接口。

**构造函数**：

- `new StreamManager(options: StreamManagerOptions)`: 创建流管理器

**方法**：

- `connect()`: 连接到服务器（SRS 适配器需要）
- `disconnect()`: 断开连接
- `createStream(options: StreamOptions)`: 创建流
- `getStream(streamId: string)`: 获取流
- `deleteStream(streamId: string)`: 删除流
- `listStreams(options?: ListOptions)`: 列出所有流
- `createRoom(options: RoomOptions)`: 创建房间
- `getRoom(roomId: string)`: 获取房间
- `deleteRoom(roomId: string)`: 删除房间
- `listRooms(options?: ListOptions)`: 列出所有房间
- `getStatistics()`: 获取统计信息
- `createPublisher(streamId: string)`: 创建推流器
- `createSubscriber(streamId: string)`: 创建拉流器
- `startRecording(streamId: string, options?: RecordingOptions)`: 开始录制
- `stopRecording(streamId: string)`: 停止录制

### Publisher

推流器，用于将视频流推送到流媒体服务器。

**方法**：

- `connect(url: string, options?: PublisherOptions)`: 连接到推流服务器
- `publish(source: MediaSource)`: 开始推流
- `stop()`: 停止推流
- `setVideoQuality(quality: VideoQuality)`: 设置视频质量

**事件**：

- `connecting`: 连接中
- `connected`: 已连接
- `publishing`: 推流中
- `disconnected`: 已断开
- `error`: 错误

### Subscriber

拉流器，用于从流媒体服务器拉取视频流。

**方法**：

- `connect(url: string, options?: SubscriberOptions)`: 连接到拉流服务器
- `play()`: 开始播放
- `stop()`: 停止播放

**事件**：

- `connecting`: 连接中
- `connected`: 已连接
- `playing`: 播放中
- `buffering`: 缓冲中
- `disconnected`: 已断开
- `error`: 错误

### 适配器接口

所有适配器都实现统一的接口：

```typescript
interface StreamAdapter {
  // 连接到服务器
  connect(): Promise<void>;

  // 断开连接
  disconnect(): Promise<void>;

  // 创建流
  createStream(options: StreamOptions): Promise<Stream>;

  // 获取流
  getStream(streamId: string): Promise<Stream | null>;

  // 删除流
  deleteStream(streamId: string): Promise<void>;

  // 列出所有流
  listStreams(options?: ListOptions): Promise<Stream[]>;

  // 创建房间
  createRoom(options: RoomOptions): Promise<Room>;

  // 获取房间
  getRoom(roomId: string): Promise<Room | null>;

  // 删除房间
  deleteRoom(roomId: string): Promise<void>;

  // 列出所有房间
  listRooms(options?: ListOptions): Promise<Room[]>;

  // 获取统计信息
  getStatistics(): Promise<StreamStatistics>;
}
```

### SRSAdapter

SRS 适配器，通过 SRS HTTP API 管理流。

**选项**：

- `host?: string`: SRS 服务器地址（默认：localhost）
- `rtmpPort?: number`: RTMP 端口（默认：1935）
- `httpPort?: number`: HTTP 端口（默认：8080）
- `apiUrl?: string`: API 地址（默认：http://localhost:1985）
- `webrtcPort?: number`: WebRTC 端口（默认：8000）
- `app?: string`: 应用名称（默认：live）

### FFmpegAdapter

FFmpeg 适配器，使用 FFmpeg 进行推流。

**选项**：

- `host?: string`: RTMP 服务器地址（默认：localhost）
- `port?: number`: RTMP 端口（默认：1935）
- `app?: string`: 应用名称（默认：live）

---

## ⚡ 性能优化

- **连接池**：复用连接，减少连接开销
- **批量操作**：支持批量创建、删除、获取流
- **缓存机制**：LRU 缓存和流缓存，提高查询性能
- **异步操作**：所有操作都是异步的，不阻塞主线程
- **状态管理**：统一的状态转换验证，避免状态错误

---

## 🐳 使用 Docker 运行 SRS

```bash
# 启动 SRS 服务器
docker run -d \
  -p 1935:1935 \
  -p 8080:8080 \
  -p 1985:1985 \
  --name srs \
  ossrs/srs:latest

# 或使用提供的脚本
./examples/start-srs.sh
```

---

## 📋 支持的协议

**图例**：✅ 直接支持；⚠️ 有条件/间接支持（见下表说明）。

| 协议   | 推流 | 拉流 | 说明                                                                                     |
| ------ | ---- | ---- | ---------------------------------------------------------------------------------------- |
| RTMP   | ✅   | ✅   | 实时消息传输协议；服务端可直接推 RTMP，最常用                                            |
| HLS    | ⚠️   | ✅   | HTTP 直播流；推流通过 FFmpeg 转码为 m3u8+ts（`getHlsPlaylistPath()`），拉流 SRS 自动生成 |
| FLV    | ⚠️   | ✅   | Flash 视频；推流经 FFmpeg 走 RTMP 等，拉流 SRS 自动生成                                  |
| WebRTC | ⚠️   | ✅   | Web 实时通信；推流建议用客户端推流器（浏览器 MediaStream），拉流可用客户端拉流器         |
| DASH   | ⚠️   | ✅   | 动态自适应流；主要用于拉流/播放，推流由源站或转码提供                                    |

**推流说明**：除 RTMP 可服务端直推外，HLS/FLV 可通过 FFmpeg 转码或经 RTMP
后由服务器生成；WebRTC 推流请用 `@dreamer/stream/client` 客户端。

---

## 🌐 客户端支持

客户端推拉流支持请查看 [client/README.md](./src/client/README.md)。

---

## 📋 变更日志

### [1.0.0] - 2026-02-19

- **新增**：首个稳定版。StreamManager、createStreamManager、SRS/nginx-rtmp/LiveKit/FFmpeg
  适配器，ServerPublisher/ServerSubscriber、ClientPublisher/ClientSubscriber，工具函数与
  i18n，ServiceContainer 集成；217 个测试全部通过。
- **兼容**：Deno 2.6+、Bun 1.3.5+、浏览器（client 子路径）。

完整历史：[CHANGELOG.md](./CHANGELOG.md)

---

## 📊 测试报告

本库共 **217 个测试**（21 个测试文件），全部通过；测试时间 2026-02-19。
详细数据与场景见 [TEST_REPORT.md](./TEST_REPORT.md)。

| 项目     | 说明       |
| -------- | ---------- |
| 测试总数 | 217 个     |
| 通过数量 | 217 个 ✅  |
| 测试文件 | 21 个      |
| 测试时间 | 2026-02-19 |

**运行测试**：

```bash
deno test -A tests/
```

运行特定文件：`deno test -A tests/manager.test.ts`；集成测试（需
SRS）：`deno test -A tests/integration/`。

---

## 🔗 ServiceContainer 集成

StreamManager 支持与 `@dreamer/service` 服务容器集成：

```typescript
import { createStreamManager, StreamManager } from "jsr:@dreamer/stream";
import { ServiceContainer } from "jsr:@dreamer/service";

const container = new ServiceContainer();

// 注册 StreamManager
container.registerSingleton(
  "stream:rtmp",
  () => createStreamManager({ adapter: "ffmpeg", name: "rtmp" }),
);

container.registerSingleton(
  "stream:srs",
  () => createStreamManager({ adapter: "srs", name: "srs" }),
);

// 获取实例
const rtmpManager = container.get<StreamManager>("stream:rtmp");

// 或者使用静态方法
const srsManager = StreamManager.fromContainer(container, "srs");
```

### StreamManager ServiceContainer 方法

| 方法                                     | 描述               |
| ---------------------------------------- | ------------------ |
| `getName()`                              | 获取管理器名称     |
| `setContainer(container)`                | 设置服务容器       |
| `getContainer()`                         | 获取服务容器       |
| `static fromContainer(container, name?)` | 从服务容器获取实例 |

---

## 📝 注意事项

- **服务端和客户端分离**：通过 `/client` 子路径明确区分服务端和客户端代码
- **统一接口**：服务端和客户端使用相同的 API 接口，降低学习成本
- **适配器模式**：支持多种流媒体服务器，易于扩展
- **多协议支持**：支持 RTMP、HLS、FLV、WebRTC、DASH 等多种协议
- **类型安全**：完整的 TypeScript 类型支持
- **无外部依赖**：纯 TypeScript 实现（SRS 适配器需要 SRS 服务器，FFmpeg
  适配器需要 FFmpeg，可选）

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

Apache License 2.0 - 详见 [LICENSE](../../LICENSE)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>
