# 变更日志

@dreamer/stream 的所有重要变更均记录于此。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.1.0] - 2026-07-23

### 新增

- **Node.js 22+ 兼容**：服务端包（适配器、StreamManager、ServerPublisher/ServerSubscriber、
  工具函数）现可在 Node.js 22+ 运行。源码无 `Deno.*` API、无 `IS_NODE` 分支——所有运行时
  差异经 `@dreamer/runtime-adapter` 抽象。client 子路径（`@dreamer/stream/client`）仍仅限浏览器。

### 变更

- 升级 `@dreamer/runtime-adapter` 至 ^1.2.2（IS_NODE 支持）。
- 升级 `@dreamer/socket-io` 至 ^1.2.0——关键：socket-io 1.2.0 在 `connect()` 内懒加载
  mongodb，修复 Bun 下 `import { Server }` 触发的 `NotImplementedError: node:v8
  isBuildingSnapshot`（bson CJS 模块）错误。
- 升级 `@dreamer/service` 至 ^1.1.0、`@dreamer/i18n` 至 ^1.1.2、`@dreamer/video` 至
  ^1.1.0、`@dreamer/test` 至 ^1.2.3。
- `deno.json` `compilerOptions.lib` 增加 `deno.ns` + `esnext`（防止 `nodeModulesDir:
  "auto"` 加载 `@types/node` 覆盖 `ImportMeta`）。

### 基础设施

- 9-job CI 矩阵：3 Deno v2.9 + 3 Bun + 3 Node 22（Linux/macOS/Windows），无 Chromium、
  无外部流媒体服务。适配器测试用 mock `fetch`。
- `tsconfig.json`（Bundler 模式，供 tsx/Node 使用）。
- `test-node.mjs`——Node 测试运行器，主进程内执行（不带 `--test` 标志→无 fork/IPC，
  避免 logger 输出污染 stdout）。
- `--minimum-dependency-age=0` 解析 JSR 依赖。
- 集成测试（`tests/integration/`，需真实流媒体服务器 + `test.mp4`）与浏览器测试
  （`tests/client/browser-client.test.ts`，需 Playwright）拆为 `test:integration`；
  CI 仅跑 18 个单元测试文件。
- `package.json` `engines.node >= 22`、`test:node` 脚本；`.npmrc` @jsr registry。

---

## [1.0.0] - 2026-02-19

### 新增

首个稳定版本。提供完整的直播推拉流、流与房间管理、多协议支持（RTMP、HLS、FLV、WebRTC、DASH），支持服务端与客户端使用。

#### 核心：流管理器与工厂

- **StreamManager**
  - 通过适配器创建、获取、删除、列出流。
  - 创建、获取、删除、列出房间。
  - `createPublisher(streamId)`、`createSubscriber(streamId)`
    用于服务端推流/拉流。
  - `getStatistics()` 获取全局统计。
  - 构造选项：`adapter`（类型或实例）、`name`、`server`（host/port）及可选适配器配置。
  - `listStreams` / `listRooms` 支持
    `filter`（name、roomId、status、protocol；房间支持
    name、isPrivate）及分页（`limit`、`offset`）。
- **createStreamManager**
  - 工厂函数创建 StreamManager 实例；可选 `name`、`registerInContainer` 以与
    @dreamer/service 集成。
- **支持的适配器类型**
  - `"srs"` | `"nginx-rtmp"` | `"livekit"` | `"ffmpeg"`；类型
    `SupportedAdapterType`。

#### 类型与接口（主入口导出）

- **流 / 房间**
  - `Stream`：id、name、roomId、protocol、status、publisherUrl、subscriberUrl、createdAt
    等。
  - `Room`：id、name、isPrivate、streamIds、createdAt。
  - `StreamOptions`、`RoomOptions`、`StreamProtocol`、`StreamStatus`、`StreamStatistics`。
- **推流器 / 拉流器**
  - `Publisher`、`PublisherOptions`、`PublisherStatus`、`PublisherStatistics`。
  - `Subscriber`、`SubscriberOptions`、`SubscriberStatus`、`SubscriberStatistics`。
- **媒体与画质**
  - `MediaSource`、`VideoQuality`。
- **适配器**
  - `AdapterConfig`、`ListOptions`；`AdapterOptions`、`StreamAdapter`（基类）。

#### 适配器（`src/adapters/`）

- **SRSAdapter**
  - 对接 SRS 服务器 HTTP
    API：创建/获取/删除/列出流、统计、connect。配置：`server`（host、port）、可选
    API 路径。
- **NginxRtmpAdapter**
  - 对接 nginx-rtmp：/stat 获取在播流、本地登记
    create/get/list/delete、统计、connect。配置：`server`、可选 stat 路径。
- **LiveKitAdapter**
  - 对接 LiveKit RoomService
    API：CreateRoom、ListRooms、DeleteRoom；createStream/getStream/listStreams/deleteStream/getStatistics；对已有房间
    createPublisher/createSubscriber。
- **FFmpegAdapter**
  - 内存流登记；创建/获取/删除/列出流、分页、getStatistics、清理。无外服，适用于本地或
    mock。
- **基类**
  - `StreamAdapter`
    接口：createStream、getStream、deleteStream、listStreams、getStatistics、可选
    connect；各适配器选项类型。

#### 服务端推拉流（`src/server/`）

- **ServerPublisher**
  - 连接推流 URL（RTMP/文件路径），发布媒体（Blob、字符串路径或
    MediaSource），停止、getStatistics。事件：on/off。状态：idle → connecting →
    connected → publishing → stopped/error。HLS 推流时提供
    `getHlsPlaylistPath()`。对 WebRTC URL 或非法媒体源抛出明确错误。
- **ServerSubscriber**
  - 连接拉流 URL，订阅流、停止、getStatistics。事件：on/off。状态：idle →
    connecting → connected → playing/buffering → stopped/error。

#### 客户端推拉流（子路径 `./client`）

- **ClientPublisher**
  - 面向浏览器：connect、publish（MediaStream 或
    HTMLVideoElement）、stop、on/off、getStatistics。从
    `jsr:@dreamer/stream/client` 导出。
- **ClientSubscriber**
  - 面向浏览器：connect、subscribe、play、pause、stop、on/off、getStatistics。从
    `jsr:@dreamer/stream/client` 导出。
- **StreamClient**
  - 客户端包挂载点；暴露 ClientPublisher、ClientSubscriber。

#### 工具函数（`src/utils/`）

- **错误**
  - `StreamError`、`StreamNotFoundError`、`StreamAlreadyExistsError`、`PublisherStateError`、`SubscriberStateError`、`ConnectionError`、`ProtocolNotSupportedError`、`AdapterError`、`ConfigurationError`。
- **协议**
  - `detectProtocol(url)`、`clearProtocolCache()`、`validateProtocol()`、`parseRtmpUrl()`、`parseHlsUrl()`、`getDefaultPort()`、`supportsPublishing()`、`supportsSubscribing()`。
- **URL 生成**
  - `generateRtmpUrl`、`generateHlsUrl`、`generateFlvUrl`、`generateWebRtcUrl`、`generatePublisherUrl`、`generateSubscriberUrl`。
- **状态**
  - `isValidStreamTransition`、`isValidPublisherTransition`、`isValidSubscriberTransition`、`getStreamStatusName`、`getPublisherStatusName`、`getSubscriberStatusName`、`isActiveStatus`、`isErrorStatus`。
- **ID**
  - `generateId(prefix?)`、`generateStreamId()`、`generateRoomId()`。
- **缓存**
  - `LRUCache`：TTL、最大容量、get/set/delete/clear/has、过期清理。
- **流缓存**
  - `StreamCache`：缓存流信息与统计；needsUpdate、clear、stats。
- **队列**
  - `DataQueue`：enqueue、dequeue、批量
    dequeue、最大长度、isEmpty、isFull、clear、可选自动处理。
- **连接池**
  - `ConnectionPool`：按 URL
    复用连接；acquire、release、maxConnections、统计、stop。
- **重连**
  - `ReconnectManager`：重试、maxRetries、指数退避、reset、stop。
- **批量操作**
  - `batchProcess`、`batchCreateStreams`、`batchDeleteStreams`、`batchGetStreams`；支持并发与
    continueOnError。
- **录制**
  - `recordStream`、`recordStreamRealtime`；`RecordingOptions`、`RecordingResult`。
- **FFmpeg 辅助**
  - `publishWithFFmpeg`、`subscribeWithFFmpeg`、`transcodeToHLS` 及对应选项。

#### 国际化（i18n）

- **语言**
  - 支持：`en-US`、`zh-CN`。默认：`en-US`。类型 `Locale`。
- **API**
  - `detectLocale()`：从环境变量 `LANGUAGE` / `LC_ALL` / `LANG` 检测。
  - `setStreamLocale(lang)`：设置服务端文案当前语言。
  - `$tr(key)`：按 key 翻译；用于推流/拉流状态错误、URL 未设置、SRS 连接失败等。
- **文案**
  - `src/locales/en-US.json`、`src/locales/zh-CN.json`，基于 @dreamer/i18n。

#### 服务容器集成

- **@dreamer/service**
  - StreamManager
    可注册到服务容器；`setServiceContainer`、`getServiceContainer`、`fromContainer(container, name?)`
    获取默认或指定名称的 StreamManager。

#### 测试与质量

- **测试**
  - 21 个测试文件共 217 个用例（Deno
    测试）：管理器、适配器、服务端推流/拉流、客户端浏览器、集成（流生命周期、视频文件推流）及全部工具；全部通过，执行时间约
    17s。
- **兼容性**
  - Deno 2.6+、Bun
    1.3.5+。客户端子路径支持浏览器（MediaStream、HTMLVideoElement）。

### 兼容性

- Deno 2.6+
- Bun 1.3.5+
- 浏览器（用于 `jsr:@dreamer/stream/client`）
