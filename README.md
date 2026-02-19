# @dreamer/stream

> A live streaming library compatible with Deno and Bun, providing full push,
> pull, stream management, and processing.

**中文**: [README (中文)](./docs/zh-CN/README.md) · **Test report (EN)**:
[docs/en-US/TEST_REPORT.md](./docs/en-US/TEST_REPORT.md)

[![JSR](https://jsr.io/badges/@dreamer/stream)](https://jsr.io/@dreamer/stream)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![Tests: 217 passed](https://img.shields.io/badge/Tests-217%20passed-brightgreen)](./docs/en-US/TEST_REPORT.md)

---

## 🎯 Features

A live streaming library for push, pull, stream management, and processing.
Supports both server and client usage.

---

## 📦 Installation

### Deno

```bash
deno add jsr:@dreamer/stream
```

### Bun

```bash
bunx jsr add @dreamer/stream
```

---

## 🌍 Environment compatibility

| Environment  | Version | Status                                                                                                                                                                                                                                      |
| ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deno**     | 2.5+    | ✅ Fully supported                                                                                                                                                                                                                          |
| **Bun**      | 1.0+    | ✅ Fully supported                                                                                                                                                                                                                          |
| **Server**   | -       | ✅ Supported (Deno and Bun runtimes; SRS and FFmpeg adapters)                                                                                                                                                                               |
| **Client**   | -       | ✅ Supported (browser; use `jsr:@dreamer/stream/client` for client push/pull)                                                                                                                                                               |
| **Optional** | -       | 📦 SRS adapter: SRS server (optional)<br>📦 FFmpeg adapter: FFmpeg + external RTMP server (optional)<br>📦 nginx-rtmp adapter: nginx-rtmp-module with /stat (optional)<br>📦 LiveKit adapter: LiveKit service + apiKey/apiSecret (optional) |

---

## ✨ Capabilities

- **Publishing**:
  - Video file publishing (with optional loop)
  - Server: file path, Blob, File as media source; HLS publish via FFmpeg to
    m3u8+ts (`getHlsPlaylistPath()` for playlist path)
  - Real-time video stream publishing
  - Custom video quality (resolution, bitrate, frame rate)
  - Audio/video toggle
- **Subscribing**:
  - Pull streams from a streaming server
  - Multiple playback protocols
- **Stream management**:
  - Create, delete, query streams
  - Stream state and statistics
- **Room management**:
  - Create, delete, query rooms
  - Room–stream association and room statistics
- **Recording**:
  - Record live streams with configurable options
- **Protocols**:
  - RTMP, HLS, FLV, WebRTC, DASH
- **Servers**:
  - SRS adapter (recommended; HLS auto-generation)
  - FFmpeg adapter (requires external RTMP server)
  - nginx-rtmp adapter (/stat for stream list)
  - LiveKit adapter (Room API; apiKey/apiSecret required)
- **Adapter pattern**:
  - Unified `StreamAdapter` interface
  - SRS, FFmpeg, nginx-rtmp, LiveKit, custom
  - Switch adapters at runtime
- **Utilities**:
  - Protocol detection and validation
  - URL generation (publish, subscribe)
  - FFmpeg publish/subscribe (`publishWithFFmpeg`, `subscribeWithFFmpeg`), HLS
    transcode (`transcodeToHLS`)
  - State management (transition validation)
  - ID generation (stream, room)
  - Cache (LRU, stream cache), queue, connection pool, reconnect (exponential
    backoff), batch operations
- **Service container**:
  - `@dreamer/service` integration
  - Multiple StreamManager instances
  - `createStreamManager` factory

---

## 📌 Supported adapters and protocols

### Adapters

| Adapter        | Description                                                                  | Status  |
| -------------- | ---------------------------------------------------------------------------- | ------- |
| **srs**        | SRS (Simple Realtime Server); recommended; HLS auto-generation               | ✅ Done |
| **ffmpeg**     | Push/pull via FFmpeg; requires external RTMP server                          | ✅ Done |
| **nginx-rtmp** | nginx-rtmp-module; /stat for stream list; RTMP/HLS/FLV                       | ✅ Done |
| **livekit**    | LiveKit Room as stream; apiKey/apiSecret; push/pull with LiveKit SDK + token | ✅ Done |
| **custom**     | Inject custom `StreamAdapter` implementation                                 | ✅ Done |

### Server-side protocol notes

- **Publish**: Supports **file path, Blob, File**. Prefer **RTMP/FLV** (FFmpeg
  publish). **HLS** via FFmpeg to m3u8+ts; use `getHlsPlaylistPath()` and serve
  over HTTP. For WebRTC/MediaStream use the client publisher.
- **Subscribe**: Prefer **HLS / DASH** (return playback URL). RTMP/FLV via
  FFmpeg to file. WebRTC subscribe via client subscriber (signaling required).

### Rooms and listing

- **Rooms**: `createRoom` / `listRooms` etc. use **in-memory storage**; not
  synced with SRS/FFmpeg; lost on process restart.
- **List filters**: `listStreams(options)` and `listRooms(options)` support
  `options.filter`. Streams: `name`, `roomId`, `status`, `protocol`. Rooms:
  `name`, `isPrivate`.

---

## 🎨 Design principles

_All @dreamer/* packages follow these principles:_

- **Main package (@dreamer/xxx)**: For server (Deno and Bun)
- **Client subpath (@dreamer/xxx/client)**: For client (browser)

This provides:

- Clear separation of server and client code
- No server dependencies in client bundles
- Better type safety and editor support
- Better tree-shaking

---

## 🎯 Use cases

- **Live publishing**: Push video streams to a streaming server
- **VOD-style**: Video file publishing with optional loop
- **Stream management**: Create, manage, monitor streams
- **Room management**: Manage rooms and channels
- **Recording**: Record live streams to files
- **Multi-protocol**: RTMP, HLS, FLV, WebRTC, DASH
- **Multi-server**: SRS, FFmpeg, nginx-rtmp, LiveKit

---

## 🚀 Quick start

### SRS adapter (recommended)

SRS adapter supports auto-generated HLS URLs for browser playback.

```typescript
import { StreamManager } from "jsr:@dreamer/stream";

// Create stream manager (SRS adapter)
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

// Connect to server
await manager.connect();

// Create stream
const stream = await manager.createStream({
  name: "my-stream",
  protocol: "rtmp",
});

console.log("Publish URL:", stream.publisherUrl);
// rtmp://localhost:1935/live/stream-xxx

console.log("Subscribe URLs:", stream.subscriberUrls);
// {
//   rtmp: "rtmp://localhost:1935/live/stream-xxx",
//   hls: "http://localhost:8080/live/stream-xxx.m3u8",
//   flv: "http://localhost:8080/live/stream-xxx.flv",
//   webrtc: "webrtc://localhost:8000/live/stream-xxx"
// }

// Create publisher
const publisher = await manager.createPublisher(stream.id);

// Connect to publish server
await publisher.connect(stream.publisherUrl!, {
  loop: true, // enable loop
});

// Start publishing (video file)
await publisher.publish("./video.mp4");

// HLS URL is auto-generated for browser playback
console.log("HLS URL:", stream.subscriberUrls.hls);

// Stop
await publisher.stop();

// Cleanup
await manager.deleteStream(stream.id);
await manager.disconnect();
```

### FFmpeg adapter

FFmpeg adapter requires an external RTMP server (e.g. SRS or nginx-rtmp).

```typescript
import { StreamManager } from "jsr:@dreamer/stream";

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

const stream = await manager.createStream({
  name: "my-stream",
  protocol: "rtmp",
});

const publisher = await manager.createPublisher(stream.id);

await publisher.connect(stream.publisherUrl!, { loop: true });
await publisher.publish("./video.mp4");
await publisher.stop();

await manager.deleteStream(stream.id);
```

### Room management

```typescript
import { StreamManager } from "jsr:@dreamer/stream";

const manager = new StreamManager({
  adapter: "srs",
});

await manager.connect();

// Create room
const room = await manager.createRoom({
  name: "My live room",
  maxViewers: 100,
});

// Associate stream with room
const stream = await manager.createStream({
  name: "room-stream",
  protocol: "rtmp",
  roomId: room.id,
});

const roomInfo = await manager.getRoom(room.id);
console.log(roomInfo);

await manager.deleteStream(stream.id);
await manager.deleteRoom(room.id);
await manager.disconnect();
```

### Stream recording

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

// Start recording
const outputPath = await manager.startRecording(stream.id, {
  output: "./recorded-stream.mp4",
  duration: 60, // 60 seconds
});

console.log("Recording started, output:", outputPath);

const finalPath = await manager.stopRecording(stream.id);
console.log("Recording stopped, final path:", finalPath);

await manager.deleteStream(stream.id);
await manager.disconnect();
```

### Custom video quality

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

publisher.setVideoQuality({
  width: 1920,
  height: 1080,
  bitrate: 5000000, // 5Mbps
  fps: 30,
});

await publisher.connect(stream.publisherUrl!);
await publisher.publish("./video.mp4");

await publisher.stop();
await manager.deleteStream(stream.id);
```

---

## 📚 API overview

### StreamManager

Unified stream and room management.

**Constructor**: `new StreamManager(options: StreamManagerOptions)`

**Methods**:

- `connect()` / `disconnect()`
- `createStream(options)` / `getStream(id)` / `deleteStream(id)` /
  `listStreams(options?)`
- `createRoom(options)` / `getRoom(id)` / `deleteRoom(id)` /
  `listRooms(options?)`
- `getStatistics()`
- `createPublisher(streamId)` / `createSubscriber(streamId)`
- `startRecording(streamId, options?)` / `stopRecording(streamId)`

### Publisher

Publish video to a streaming server.

**Methods**: `connect(url, options?)`, `publish(source)`, `stop()`,
`setVideoQuality(quality)`

**Events**: `connecting`, `connected`, `publishing`, `disconnected`, `error`

### Subscriber

Subscribe to a stream from a server.

**Methods**: `connect(url, options?)`, `play()`, `stop()`

**Events**: `connecting`, `connected`, `playing`, `buffering`, `disconnected`,
`error`

### Adapter interface

All adapters implement:

```typescript
interface StreamAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  createStream(options: StreamOptions): Promise<Stream>;
  getStream(streamId: string): Promise<Stream | null>;
  deleteStream(streamId: string): Promise<void>;
  listStreams(options?: ListOptions): Promise<Stream[]>;
  createRoom(options: RoomOptions): Promise<Room>;
  getRoom(roomId: string): Promise<Room | null>;
  deleteRoom(roomId: string): Promise<void>;
  listRooms(options?: ListOptions): Promise<Room[]>;
  getStatistics(): Promise<StreamStatistics>;
}
```

### SRSAdapter options

- `host?`, `rtmpPort?`, `httpPort?`, `apiUrl?`, `webrtcPort?`, `app?`

### FFmpegAdapter options

- `host?`, `port?`, `app?`

---

## ⚡ Performance

- **Connection pool**: Reuse connections
- **Batch operations**: Batch create/delete/get streams
- **Caching**: LRU and stream cache
- **Async**: Non-blocking operations
- **State**: Validated state transitions

---

## 🐳 Run SRS with Docker

```bash
docker run -d \
  -p 1935:1935 \
  -p 8080:8080 \
  -p 1985:1985 \
  --name srs \
  ossrs/srs:latest

# Or use the provided script
./examples/start-srs.sh
```

---

## 📋 Supported protocols

**Legend**: ✅ Direct; ⚠️ Conditional/indirect (see notes).

| Protocol | Publish | Subscribe | Notes                                                                                    |
| -------- | ------- | --------- | ---------------------------------------------------------------------------------------- |
| RTMP     | ✅      | ✅        | Primary; server can publish RTMP directly                                                |
| HLS      | ⚠️      | ✅        | Publish via FFmpeg to m3u8+ts (`getHlsPlaylistPath()`); SRS auto-generates for subscribe |
| FLV      | ⚠️      | ✅        | Publish via FFmpeg/RTMP; SRS auto-generates for subscribe                                |
| WebRTC   | ⚠️      | ✅        | Publish via client publisher (browser MediaStream); subscribe via client subscriber      |
| DASH     | ⚠️      | ✅        | Mainly subscribe/playback; publish from origin or transcoding                            |

**Publish**: Besides RTMP (direct), HLS/FLV can use FFmpeg or RTMP then
server-generated; WebRTC publish use `@dreamer/stream/client`.

---

## 🌐 Client support

For client push/pull, see [client/README.md](./src/client/README.md).

---

## 📋 Changelog

### [1.0.0] - 2026-02-19

- **Added**: Initial stable release. StreamManager, createStreamManager,
  SRS/nginx-rtmp/LiveKit/FFmpeg adapters, ServerPublisher/ServerSubscriber,
  ClientPublisher/ClientSubscriber, utilities, i18n, ServiceContainer
  integration; 217 tests passing.
- **Compatibility**: Deno 2.6+, Bun 1.3.5+, browser (client subpath).

Full history: [docs/en-US/CHANGELOG.md](./docs/en-US/CHANGELOG.md)

---

## 📊 Test report

**217 tests** (21 files), all passing; date 2026-02-19. Details:
[docs/en-US/TEST_REPORT.md](./docs/en-US/TEST_REPORT.md).

| Item        | Value      |
| ----------- | ---------- |
| Total tests | 217        |
| Passed      | 217 ✅     |
| Test files  | 21         |
| Date        | 2026-02-19 |

**Run tests**:

```bash
deno test -A tests/
```

Single file: `deno test -A tests/manager.test.ts`. Integration (SRS required):
`deno test -A tests/integration/`.

---

## 🔗 ServiceContainer integration

StreamManager works with `@dreamer/service`:

```typescript
import { createStreamManager, StreamManager } from "jsr:@dreamer/stream";
import { ServiceContainer } from "jsr:@dreamer/service";

const container = new ServiceContainer();

container.registerSingleton(
  "stream:rtmp",
  () => createStreamManager({ adapter: "ffmpeg", name: "rtmp" }),
);

container.registerSingleton(
  "stream:srs",
  () => createStreamManager({ adapter: "srs", name: "srs" }),
);

const rtmpManager = container.get<StreamManager>("stream:rtmp");
const srsManager = StreamManager.fromContainer(container, "srs");
```

### StreamManager ServiceContainer methods

| Method                                   | Description           |
| ---------------------------------------- | --------------------- |
| `getName()`                              | Get manager name      |
| `setContainer(container)`                | Set service container |
| `getContainer()`                         | Get service container |
| `static fromContainer(container, name?)` | Get from container    |

---

## 📝 Notes

- **Server vs client**: Use `/client` subpath for browser; main package for
  server.
- **Unified API**: Same API on server and client.
- **Adapter pattern**: Pluggable streaming backends.
- **Protocols**: RTMP, HLS, FLV, WebRTC, DASH.
- **TypeScript**: Full type definitions.
- **Optional deps**: SRS adapter needs SRS server; FFmpeg adapter needs FFmpeg
  (optional).

---

## 🤝 Contributing

Issues and Pull Requests welcome.

---

## 📄 License

Apache License 2.0 — see [LICENSE](./LICENSE).

---

<div align="center">**Made with ❤️ by Dreamer Team**</div>
