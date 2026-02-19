# @dreamer/stream Test Report

## 📊 Test Overview

| Item                  | Value                           |
| --------------------- | ------------------------------- |
| **Package version**   | `@dreamer/stream@1.0.0-beta.4`  |
| **Service container** | `@dreamer/service@1.0.0-beta.4` |
| **Test framework**    | `@dreamer/test@^1.0.11`         |
| **Test date**         | `2026-02-19`                    |
| **Test environment**  | Deno 2.5+, Bun 1.0+             |
| **Test file count**   | 21                              |
| **Total test cases**  | 217                             |
| **Pass rate**         | 100% ✅                         |
| **Execution time**    | ~17s                            |

---

## 🎯 Test Coverage

### Core functionality tests

#### 1. Stream manager (`manager.test.ts`) - 27 tests

- ✅ **Stream management**
  - `createStream` - Create stream
  - `getStream` - Get stream
  - `deleteStream` - Delete stream
  - `listStreams` - List all streams
- ✅ **Room management**
  - `createRoom` - Create room
  - `getRoom` - Get room
  - `deleteRoom` - Delete room
  - `listRooms` - List all rooms
- ✅ **Statistics**
  - `getStatistics` - Get statistics
- ✅ **Error handling**
  - Error handling for unsupported adapter types
- ✅ **List filtering**
  - `listStreams` supports filter (name, roomId, status, protocol)
  - `listRooms` supports filter (name, isPrivate)
- ✅ **Adapters**
  - nginx-rtmp adapter (mock stat)
  - livekit adapter (mock API)
- ✅ **ServiceContainer integration** (6 tests)
  - Get default/custom manager name
  - Set and get service container
  - Get StreamManager from service container
  - Return undefined when service does not exist
  - Support multiple StreamManager instances
- ✅ **createStreamManager factory** (5 tests)
  - Create StreamManager instance
  - Use default/custom name
  - Register in service container
  - Support stream operations

**Test result**: All 27 tests passed

#### 2. Adapter tests (`adapters/ffmpeg.test.ts`) - 11 tests

- ✅ **FFmpeg adapter**
  - Create adapter instance
  - Create stream
  - Get stream
  - Handle non-existent stream
  - Delete stream
  - List all streams
  - Support paginated list
  - Get statistics
  - Support cleanup

**Test result**: All 11 tests passed

#### 3. SRS adapter tests (`adapters/srs.test.ts`) - 13 tests

- ✅ **SRS adapter** (mock fetch, no real SRS server required)
  - Create adapter instance, default config
  - Create stream, get stream, return null for non-existent stream
  - List all streams, pagination (limit/offset)
  - Delete stream, get statistics
  - getStatistics throws StreamNotFoundError for non-existent stream
  - connect success/failure

**Test result**: All 13 tests passed

#### 4. nginx-rtmp adapter tests (`adapters/nginx-rtmp.test.ts`) - 14 tests

- ✅ **NginxRtmpAdapter** (mock fetch /stat)
  - Create adapter instance, default config
  - createStream registers stream and returns push/pull URLs
  - getStream syncs live streams from stat, locally registered streams
  - listStreams merges stat and local streams
  - deleteStream, getStatistics, connect failure,
    createPublisher/createSubscriber

**Test result**: All 14 tests passed

#### 5. LiveKit adapter tests (`adapters/livekit.test.ts`) - 12 tests

- ✅ **LiveKitAdapter** (mock fetch RoomService API)
  - Create adapter instance, default host
  - createStream calls CreateRoom
  - getStream/listStreams/deleteStream/getStatistics
  - createPublisher/createSubscriber, StreamNotFoundError

**Test result**: All 12 tests passed

#### 6. Client browser tests (`client/browser-client.test.ts`) - 11 tests

- ✅ **Stream client - browser tests** (@dreamer/test browser integration,
  Puppeteer + esbuild)
  - StreamClient mount and ClientPublisher, ClientSubscriber exports
  - ClientPublisher instance and methods (connect, publish, stop, on, off,
    getStatistics)
  - ClientSubscriber instance and methods (connect, subscribe, stop, play,
    pause, on, off, getStatistics)
  - Event on/off, getStatistics returns object
  - MediaStream / HTMLVideoElement environment detection

**Test result**: All 11 tests passed

#### 7. Server push/pull tests (`server/publisher.test.ts`, `server/subscriber.test.ts`) - 18 tests

- ✅ **ServerPublisher**
  - Create instance, getStatistics (idle), state becomes connected after connect
  - publish throws when not connected, duplicate connect throws, on/off events
  - getHlsPlaylistPath returns undefined when not HLS publish
  - publish with WebRTC URL or non-Blob/non-string media source throws clear
    error
- ✅ **ServerSubscriber**
  - Create instance, getStatistics (idle), state becomes connected after connect
  - subscribe throws when not connected, duplicate connect throws, on/off events

**Test result**: All 18 tests passed

#### Integration tests (`integration/`)

**Stream lifecycle tests** (`stream-lifecycle.test.ts`)

- ✅ Complete full stream lifecycle
- ✅ Support room and stream association
- ✅ Support batch stream operations

**Test result**: All 4 tests passed

**Video file publish tests** (`video-file-publish.test.ts`)

- ✅ Can publish using video file
- ✅ Support loop playback of video file
- ✅ Can set video quality
- ✅ Throw error when video file does not exist

**Test result**: All 5 tests passed

---

## 🛠️ Utility tests

### Error handling (`utils/errors.test.ts`)

- ✅ **Error classes**
  - `StreamError` - Base error class
  - `StreamNotFoundError` - Stream not found error
  - `StreamAlreadyExistsError` - Stream already exists error
  - `PublisherStateError` - Publisher state error
  - `SubscriberStateError` - Subscriber state error
  - `ConnectionError` - Connection error
  - `ProtocolNotSupportedError` - Protocol not supported error
  - `AdapterError` - Adapter error
  - `ConfigurationError` - Configuration error

**Test result**: All 12 tests passed

### Protocol handling (`utils/protocol.test.ts`)

- ✅ **Protocol detection**
  - `detectProtocol` - Detect RTMP, HLS, FLV, WebRTC, DASH protocols
  - `clearProtocolCache` - Clear protocol detection cache
- ✅ **Protocol validation**
  - `validateProtocol` - Validate valid protocol
  - Throw error for invalid protocol
- ✅ **URL parsing**
  - `parseRtmpUrl` - Parse RTMP URL
  - `parseHlsUrl` - Parse HLS URL
- ✅ **Protocol utilities**
  - `getDefaultPort` - Get default port (RTMP, HLS, WebRTC)
  - `supportsPublishing` - Whether protocol supports publishing
  - `supportsSubscribing` - Whether protocol supports subscribing

**Test result**: All 18 tests passed

### URL generation (`utils/url.test.ts`)

- ✅ **URL generation**
  - `generateRtmpUrl` - Generate RTMP URL
  - `generateHlsUrl` - Generate HLS URL
  - `generateFlvUrl` - Generate FLV URL
  - `generateWebRtcUrl` - Generate WebRTC URL
  - `generatePublisherUrl` - Generate publisher URL (RTMP, WebRTC)
  - `generateSubscriberUrl` - Generate subscriber URL (HLS, FLV)

**Test result**: All 9 tests passed

### State management (`utils/state.test.ts`)

- ✅ **State transition validation**
  - `isValidStreamTransition` - Validate valid stream state transition
  - `isValidPublisherTransition` - Validate valid publisher state transition
  - `isValidSubscriberTransition` - Validate valid subscriber state transition
  - Reject invalid state transitions
- ✅ **State utilities**
  - `getStreamStatusName` - Return display name for stream status
  - `getPublisherStatusName` - Return display name for publisher status
  - `getSubscriberStatusName` - Return display name for subscriber status
  - `isActiveStatus` - Whether stream status is active
  - `isErrorStatus` - Whether status is error status

**Test result**: All 12 tests passed

### ID generation (`utils/id.test.ts`)

- ✅ **ID generation**
  - `generateId` - Generate ID with prefix
  - `generateId` - Generate unique ID
  - `generateStreamId` - Generate stream ID
  - `generateRoomId` - Generate room ID
  - Generate IDs with different prefixes

**Test result**: All 6 tests passed

### Cache (`utils/cache.test.ts`)

- ✅ **LRU cache**
  - Support basic operations (get, set, delete)
  - Implement LRU eviction policy
  - Update access order
  - Support TTL expiry
  - Update existing value
  - Support delete operation
  - Support clear operation
  - Support has method
  - Support cleanup of expired entries

**Test result**: All 10 tests passed

### Stream cache (`utils/stream-cache.test.ts`)

- ✅ **Stream info cache**
  - Support basic operations
  - Cache statistics
  - Support stream deletion
  - Support needsUpdate check
  - Support clear operation
  - Provide statistics

**Test result**: All 7 tests passed

### Data queue (`utils/queue.test.ts`)

- ✅ **Data queue**
  - Support basic operations (enqueue, dequeue)
  - Support batch dequeue
  - Limit queue size
  - Correct isEmpty and isFull
  - Support clear operation
  - Support auto-processing

**Test result**: All 7 tests passed

### Connection pool (`utils/connection-pool.test.ts`)

- ✅ **Connection pool management**
  - Support basic operations
  - Reuse connections
  - Limit connection count
  - Support connection release
  - Provide statistics
  - Clean up all connections on stop

**Test result**: All 7 tests passed

### Reconnect management (`utils/reconnect.test.ts`)

- ✅ **Reconnect manager**
  - Support basic reconnect operations
  - Throw error when max retries reached
  - Implement exponential backoff
  - Support reset operation
  - Support stop operation

**Test result**: All 6 tests passed

### Batch operations (`utils/batch-operations.test.ts`)

- ✅ **Batch processing**
  - `batchProcess` - Support basic batch processing
  - `batchProcess` - Support error handling
  - `batchProcess` - Throw when not continuing on error
  - `batchProcess` - Control concurrency
  - `batchCreateStreams` - Batch create streams
  - `batchDeleteStreams` - Batch delete streams
  - `batchGetStreams` - Batch get streams

**Test result**: All 8 tests passed

---

## 📋 Test file summary

| Test file                                | Count | Status      | Description                       |
| ---------------------------------------- | ----- | ----------- | --------------------------------- |
| `manager.test.ts`                        | 27    | ✅ All pass | Stream manager + ServiceContainer |
| `adapters/ffmpeg.test.ts`                | 11    | ✅ All pass | FFmpeg adapter                    |
| `adapters/srs.test.ts`                   | 13    | ✅ All pass | SRS adapter                       |
| `adapters/nginx-rtmp.test.ts`            | 14    | ✅ All pass | nginx-rtmp adapter                |
| `adapters/livekit.test.ts`               | 12    | ✅ All pass | LiveKit adapter                   |
| `client/browser-client.test.ts`          | 11    | ✅ All pass | Browser client                    |
| `server/publisher.test.ts`               | 11    | ✅ All pass | Server publisher                  |
| `server/subscriber.test.ts`              | 7     | ✅ All pass | Server subscriber                 |
| `integration/stream-lifecycle.test.ts`   | 4     | ✅ All pass | Stream lifecycle integration      |
| `integration/video-file-publish.test.ts` | 5     | ✅ All pass | Video file publish integration    |
| `utils/errors.test.ts`                   | 12    | ✅ All pass | Error classes                     |
| `utils/protocol.test.ts`                 | 18    | ✅ All pass | Protocol handling                 |
| `utils/url.test.ts`                      | 9     | ✅ All pass | URL generation                    |
| `utils/state.test.ts`                    | 12    | ✅ All pass | State management                  |
| `utils/id.test.ts`                       | 6     | ✅ All pass | ID generation                     |
| `utils/cache.test.ts`                    | 10    | ✅ All pass | LRU cache                         |
| `utils/stream-cache.test.ts`             | 7     | ✅ All pass | Stream cache                      |
| `utils/queue.test.ts`                    | 7     | ✅ All pass | Data queue                        |
| `utils/connection-pool.test.ts`          | 7     | ✅ All pass | Connection pool                   |
| `utils/reconnect.test.ts`                | 6     | ✅ All pass | Reconnect manager                 |
| `utils/batch-operations.test.ts`         | 8     | ✅ All pass | Batch operations                  |

---

## 🔍 Functional test details

### 1. Stream manager (`manager.test.ts`) - 27 tests

**Test scenarios**:

- ✅ Create manager instance
- ✅ Create stream (supports RTMP, HLS, WebRTC, etc.)
- ✅ Get stream (by ID)
- ✅ Delete stream
- ✅ List all streams
- ✅ Create room
- ✅ Get room
- ✅ Delete room
- ✅ List all rooms
- ✅ Get statistics
- ✅ Throw error for unsupported adapter type
- ✅ List filtering (listStreams / listRooms filter)
- ✅ Adapters (nginx-rtmp, livekit mock)
- ✅ ServiceContainer integration (6 tests)
- ✅ createStreamManager factory (5 tests)

**Test result**: All 27 tests passed

### 2. FFmpeg adapter (`adapters/ffmpeg.test.ts`) - 11 tests

**Test scenarios**:

- ✅ Create adapter instance
- ✅ Create stream
- ✅ Get stream
- ✅ Return null when stream does not exist
- ✅ Delete stream
- ✅ Handle delete of non-existent stream
- ✅ List all streams
- ✅ Support paginated list
- ✅ Get statistics
- ✅ Support cleanup

**Test result**: All 11 tests passed

### 3. Stream lifecycle integration (`integration/stream-lifecycle.test.ts`) - 4 tests

**Test scenarios**:

- ✅ Complete full stream lifecycle (create → use → delete)
- ✅ Support room and stream association
- ✅ Support batch stream operations

**Test result**: All 4 tests passed

### 4. Video file publish integration (`integration/video-file-publish.test.ts`) - 5 tests

**Test scenarios**:

- ✅ Can publish using video file
- ✅ Support loop playback of video file
- ✅ Can set video quality (resolution, bitrate, frame rate)
- ✅ Throw error when video file does not exist

**Test result**: All 5 tests passed

**Notes**:

- These tests require SRS Docker server to be running
- Tests automatically handle port conflicts and resource cleanup
- Include timeout protection to avoid tests hanging

### 5. Protocol handling (`utils/protocol.test.ts`) - 18 tests

**Test scenarios**:

- ✅ Protocol detection (RTMP, HLS, FLV, WebRTC, DASH)
- ✅ Protocol validation (valid and invalid protocol)
- ✅ URL parsing (RTMP, HLS)
- ✅ Default port retrieval
- ✅ Protocol capability (publish, subscribe)

**Test result**: All 18 tests passed

### 6. Connection pool (`utils/connection-pool.test.ts`) - 7 tests

**Test scenarios**:

- ✅ Support basic operations (acquire connection, release connection)
- ✅ Reuse connections (same URL reuses same connection)
- ✅ Limit connection count (maxConnections)
- ✅ Support connection release
- ✅ Provide statistics (total, active, idle)
- ✅ Clean up all connections on stop

**Test result**: All 7 tests passed

**Performance**: ~150–160ms per test (includes timer cleanup wait)

### 7. Reconnect manager (`utils/reconnect.test.ts`) - 6 tests

**Test scenarios**:

- ✅ Support basic reconnect operations
- ✅ Throw error when max retries reached
- ✅ Implement exponential backoff
- ✅ Support reset operation
- ✅ Support stop operation

**Test result**: All 6 tests passed

**Performance**: Basic reconnect test ~707ms (includes retry delay)

### 8. Batch operations (`utils/batch-operations.test.ts`) - 8 tests

**Test scenarios**:

- ✅ Support basic batch processing
- ✅ Support error handling (continueOnError)
- ✅ Throw when not continuing on error
- ✅ Control concurrency (concurrency)
- ✅ Batch create streams
- ✅ Batch delete streams
- ✅ Batch get streams

**Test result**: All 8 tests passed

---

## ⚡ Performance

- **Total execution time**: ~17 seconds
- **Average per test**: ~78ms
- **Slowest test**: Reconnect manager basic reconnect (~707ms, includes retry
  delay)
- **Fastest tests**: Most utility tests (< 1ms)

---

## ✅ Test quality

### Coverage

- ✅ **Core**: Stream management, room management, adapters
- ✅ **Integration**: Stream lifecycle, video file publish
- ✅ **Utilities**: Error handling, protocol, URL generation, state, ID
  generation, cache, queue, connection pool, reconnect, batch operations
- ✅ **Error handling**: All error types covered
- ✅ **Edge cases**: Non-existent stream, invalid protocol, timeout handling,
  etc.

### Stability

- ✅ All tests pass consistently
- ✅ Resource cleanup (port release, process termination)
- ✅ Timeout protection to avoid hanging
- ✅ Supports concurrent test execution

---

## 🎯 Test environment

- **Test framework**: @dreamer/test@^1.0.11
- **Runtime**: Deno 2.6.4+ / Bun 1.3.5
- **External dependencies**:
  - SRS Docker server (for video file publish tests)
  - FFmpeg (for video file publish tests)

---

## 📝 Test notes

### Integration test requirements

**Video file publish tests** (`integration/video-file-publish.test.ts`) require:

1. SRS Docker server running (ports 1935, 8080, 1985)
2. Test video file present (`tests/data/test.mp4`)

**Start SRS server**:

```bash
docker run -d \
  -p 1935:1935 \
  -p 8080:8080 \
  -p 1985:1985 \
  --name srs \
  ossrs/srs:latest
```

### Test isolation

- Each test runs independently and does not depend on others
- Resources (streams, rooms, connections, processes) are cleaned up after tests
- Ports are released automatically to avoid conflicts

### Timeout protection

- Video file publish tests have 5s timeout
- FFmpeg process stop has 3s timeout
- Socket.IO server shutdown has 2s timeout

---

## 🚀 Running tests

### Run all tests

```bash
deno test -A tests/
```

### Run a specific test file

```bash
deno test -A tests/manager.test.ts
```

### Run integration tests (requires SRS server)

```bash
deno test -A tests/integration/
```

---

## 📊 Summary

✅ **All 217 tests passed**

- Core tests (stream management, adapters, client, server)
- Utility tests
- Integration tests

**Coverage**:

- ✅ Stream management (create, get, delete, list)
- ✅ Room management (create, get, delete, list)
- ✅ Adapters (FFmpeg, SRS, nginx-rtmp, LiveKit)
- ✅ Protocol (RTMP, HLS, FLV, WebRTC, DASH)
- ✅ URL generation (publish, subscribe)
- ✅ State (transitions, validation)
- ✅ Error handling (all error types)
- ✅ Cache (LRU, stream cache)
- ✅ Queue (data queue)
- ✅ Connection pool (reuse, limit)
- ✅ Reconnect (exponential backoff)
- ✅ Batch operations (create, delete, get)
- ✅ Video file publish (loop, quality)
- ✅ ServiceContainer (manager name, container get/set, fromContainer)
- ✅ createStreamManager factory

**Quality**: ⭐⭐⭐⭐⭐ (5/5)

---

_Last updated: 2026-02-19_
