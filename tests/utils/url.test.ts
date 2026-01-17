/**
 * @fileoverview URL 工具测试
 */

import { describe, expect, it } from "@dreamer/test";
import {
  generateRtmpUrl,
  generateHlsUrl,
  generateFlvUrl,
  generateWebRtcUrl,
  generatePublisherUrl,
  generateSubscriberUrl,
} from "../../src/utils/url.ts";

describe("generateRtmpUrl", () => {
  it("应该生成 RTMP URL", () => {
    const url = generateRtmpUrl("localhost", 1935, "live", "stream-key");
    expect(url).toBe("rtmp://localhost:1935/live/stream-key");
  });
});

describe("generateHlsUrl", () => {
  it("应该生成 HLS URL", () => {
    const url = generateHlsUrl("localhost", 8080, "live", "stream-key");
    // URL 格式可能是 stream-key.m3u8 或 stream-key/playlist.m3u8
    expect(
      url === "http://localhost:8080/live/stream-key.m3u8" ||
        url === "http://localhost:8080/live/stream-key/playlist.m3u8",
    ).toBe(true);
  });
});

describe("generateFlvUrl", () => {
  it("应该生成 FLV URL", () => {
    const url = generateFlvUrl("localhost", 8080, "live", "stream-key");
    expect(url).toBe("http://localhost:8080/live/stream-key.flv");
  });
});

describe("generateWebRtcUrl", () => {
  it("应该生成 WebRTC URL", () => {
    const url = generateWebRtcUrl("localhost", 8000, "live", "stream-key");
    // URL 格式可能是 /live/stream-key 或 /room/live/stream/stream-key
    expect(
      url === "ws://localhost:8000/live/stream-key" ||
        url === "ws://localhost:8000/room/live/stream/stream-key",
    ).toBe(true);
  });
});

describe("generatePublisherUrl", () => {
  it("应该为 RTMP 生成推流 URL", () => {
    const url = generatePublisherUrl(
      "rtmp",
      "localhost",
      1935,
      "live",
      "stream-key",
    );
    expect(url).toBe("rtmp://localhost:1935/live/stream-key");
  });

  it("应该为 WebRTC 生成推流 URL", () => {
    const url = generatePublisherUrl(
      "webrtc",
      "localhost",
      8000,
      "live",
      "stream-key",
    );
    // URL 格式可能是 /live/stream-key 或 /room/live/stream/stream-key
    expect(
      url === "ws://localhost:8000/live/stream-key" ||
        url === "ws://localhost:8000/room/live/stream/stream-key",
    ).toBe(true);
  });
});

describe("generateSubscriberUrl", () => {
  it("应该为 HLS 生成拉流 URL", () => {
    const url = generateSubscriberUrl(
      "hls",
      "localhost",
      8080,
      "live",
      "stream-key",
    );
    // URL 格式可能是 stream-key.m3u8 或 stream-key/playlist.m3u8
    expect(
      url === "http://localhost:8080/live/stream-key.m3u8" ||
        url === "http://localhost:8080/live/stream-key/playlist.m3u8",
    ).toBe(true);
  });

  it("应该为 FLV 生成拉流 URL", () => {
    const url = generateSubscriberUrl(
      "flv",
      "localhost",
      8080,
      "live",
      "stream-key",
    );
    expect(url).toBe("http://localhost:8080/live/stream-key.flv");
  });
});
