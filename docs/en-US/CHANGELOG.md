# Changelog

All notable changes to @dreamer/stream are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.0.0] - 2026-02-19

### Added

Initial stable release. Full-featured live streaming library for push/pull
streams, stream and room management, multiple protocols (RTMP, HLS, FLV, WebRTC,
DASH), and server-side or client-side usage.

#### Core: Stream manager and factory

- **StreamManager**
  - Create, get, delete, and list streams via adapter.
  - Create, get, delete, and list rooms.
  - `createPublisher(streamId)` and `createSubscriber(streamId)` for server-side
    push/pull.
  - `getStatistics()` for global stats.
  - Constructor options: `adapter` (type or instance), `name`, `server`
    (host/port), and optional adapter-specific config.
  - `listStreams` / `listRooms` support `filter` (name, roomId, status,
    protocol; name, isPrivate for rooms) and pagination (`limit`, `offset`).
- **createStreamManager**
  - Factory to create a StreamManager instance; optional `name` and
    `registerInContainer` for @dreamer/service integration.
- **Supported adapter types**
  - `"srs"` | `"nginx-rtmp"` | `"livekit"` | `"ffmpeg"`; type
    `SupportedAdapterType`.

#### Types and interfaces (exported from main entry)

- **Stream / Room**
  - `Stream`: id, name, roomId, protocol, status, publisherUrl, subscriberUrl,
    createdAt, etc.
  - `Room`: id, name, isPrivate, streamIds, createdAt.
  - `StreamOptions`, `RoomOptions`, `StreamProtocol`, `StreamStatus`,
    `StreamStatistics`.
- **Publisher / Subscriber**
  - `Publisher`, `PublisherOptions`, `PublisherStatus`, `PublisherStatistics`.
  - `Subscriber`, `SubscriberOptions`, `SubscriberStatus`,
    `SubscriberStatistics`.
- **Media and quality**
  - `MediaSource`, `VideoQuality`.
- **Adapter**
  - `AdapterConfig`, `ListOptions`; `AdapterOptions`, `StreamAdapter` (base).

#### Adapters (`src/adapters/`)

- **SRSAdapter**
  - Integrates with SRS server HTTP API: create/get/delete/list streams,
    statistics, connect. Config: `server` (host, port), optional API path.
- **NginxRtmpAdapter**
  - Integrates with nginx-rtmp: /stat for live streams, local registry for
    create/get/list/delete, statistics, connect. Config: `server`, optional stat
    path.
- **LiveKitAdapter**
  - Integrates with LiveKit RoomService API: CreateRoom, ListRooms, DeleteRoom;
    createStream/getStream/listStreams/deleteStream/getStatistics;
    createPublisher/createSubscriber for existing rooms.
- **FFmpegAdapter**
  - In-memory stream registry; create/get/delete/list streams, pagination,
    getStatistics, cleanup. No external server; for local or mock usage.
- **Base**
  - `StreamAdapter` interface: createStream, getStream, deleteStream,
    listStreams, getStatistics, optional connect; adapter-specific options
    types.

#### Server-side push/pull (`src/server/`)

- **ServerPublisher**
  - Connect to a push URL (RTMP/file path), publish media (Blob, string path, or
    MediaSource), stop, getStatistics. Events: on/off. State: idle → connecting
    → connected → publishing → stopped/error. `getHlsPlaylistPath()` when
    publishing HLS. Rejects WebRTC URL or invalid media source with clear
    errors.
- **ServerSubscriber**
  - Connect to a pull URL, subscribe to stream, stop, getStatistics. Events:
    on/off.
  - State: idle → connecting → connected → playing/buffering → stopped/error.

#### Client-side push/pull (subpath `./client`)

- **ClientPublisher**
  - Browser-oriented: connect, publish (MediaStream or HTMLVideoElement), stop,
    on/off, getStatistics. Exported from `jsr:@dreamer/stream/client`.
- **ClientSubscriber**
  - Browser-oriented: connect, subscribe, play, pause, stop, on/off,
    getStatistics. Exported from `jsr:@dreamer/stream/client`.
- **StreamClient**
  - Mount point for client bundle; exposes ClientPublisher and ClientSubscriber.

#### Utilities (`src/utils/`)

- **Errors**
  - `StreamError`, `StreamNotFoundError`, `StreamAlreadyExistsError`,
    `PublisherStateError`, `SubscriberStateError`, `ConnectionError`,
    `ProtocolNotSupportedError`, `AdapterError`, `ConfigurationError`.
- **Protocol**
  - `detectProtocol(url)`, `clearProtocolCache()`, `validateProtocol()`,
    `parseRtmpUrl()`, `parseHlsUrl()`, `getDefaultPort()`,
    `supportsPublishing()`, `supportsSubscribing()`.
- **URL generation**
  - `generateRtmpUrl`, `generateHlsUrl`, `generateFlvUrl`, `generateWebRtcUrl`,
    `generatePublisherUrl`, `generateSubscriberUrl`.
- **State**
  - `isValidStreamTransition`, `isValidPublisherTransition`,
    `isValidSubscriberTransition`, `getStreamStatusName`,
    `getPublisherStatusName`, `getSubscriberStatusName`, `isActiveStatus`,
    `isErrorStatus`.
- **ID**
  - `generateId(prefix?)`, `generateStreamId()`, `generateRoomId()`.
- **Cache**
  - `LRUCache` with TTL, max size, get/set/delete/clear/has, expiry cleanup.
- **Stream cache**
  - `StreamCache` for caching stream info and statistics; needsUpdate, clear,
    stats.
- **Queue**
  - `DataQueue` with enqueue, dequeue, batch dequeue, max size, isEmpty, isFull,
    clear, auto-processing option.
- **Connection pool**
  - `ConnectionPool` for URL-keyed connections; acquire, release,
    maxConnections, statistics, stop.
- **Reconnect**
  - `ReconnectManager` with retry, maxRetries, exponential backoff, reset, stop.
- **Batch operations**
  - `batchProcess`, `batchCreateStreams`, `batchDeleteStreams`,
    `batchGetStreams` with concurrency and continueOnError options.
- **Recording**
  - `recordStream`, `recordStreamRealtime` with `RecordingOptions`;
    `RecordingResult`.
- **FFmpeg helpers**
  - `publishWithFFmpeg`, `subscribeWithFFmpeg`, `transcodeToHLS` with options.

#### Internationalization (i18n)

- **Locale**
  - Supported: `en-US`, `zh-CN`. Default: `en-US`. Type `Locale`.
- **API**
  - `detectLocale()`: from env `LANGUAGE` / `LC_ALL` / `LANG`.
  - `setStreamLocale(lang)`: set current locale for server-side messages.
  - `$tr(key)`: translate key; used for publisher/subscriber state errors, URL
    not set, SRS connection failed, etc.
- **Bundled messages**
  - `src/locales/en-US.json`, `src/locales/zh-CN.json` via @dreamer/i18n.

#### Service container integration

- **@dreamer/service**
  - StreamManager can be registered in a service container;
    `setServiceContainer`, `getServiceContainer`,
    `fromContainer(container, name?)` for obtaining the default or named
    StreamManager.

#### Tests and quality

- **Tests**
  - 217 tests across 21 files (Deno test runner): manager, adapters, server
    publisher/subscriber, client browser, integration (stream lifecycle, video
    file publish), and all utils. All passing; execution time ~17s.
- **Compatibility**
  - Deno 2.6+, Bun 1.3.5+. Browser support for client subpath (MediaStream,
    HTMLVideoElement).

### Compatibility

- Deno 2.6+
- Bun 1.3.5+
- Browsers (for `jsr:@dreamer/stream/client`)
