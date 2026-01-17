/**
 * @fileoverview 协议处理工具
 *
 * 用于检测、解析和处理流媒体协议
 */

import type { StreamProtocol } from "../types.ts";
import { ProtocolNotSupportedError } from "./errors.ts";

/**
 * 支持的协议列表
 */
export const SUPPORTED_PROTOCOLS: StreamProtocol[] = [
  "rtmp",
  "hls",
  "webrtc",
  "dash",
  "flv",
];

/**
 * 协议检测缓存（性能优化）
 */
const protocolCache = new Map<string, StreamProtocol>();

/**
 * 检测 URL 的协议类型
 *
 * @param url 流媒体 URL
 * @returns 协议类型
 */
export function detectProtocol(url: string): StreamProtocol {
  // 检查缓存
  const cached = protocolCache.get(url);
  if (cached) {
    return cached;
  }

  const lowerUrl = url.toLowerCase();
  let protocol: StreamProtocol;

  // RTMP 协议
  if (lowerUrl.startsWith("rtmp://")) {
    protocol = "rtmp";
  }
  // HLS 协议
  else if (lowerUrl.includes(".m3u8") || lowerUrl.includes("/hls/")) {
    protocol = "hls";
  }
  // FLV 协议
  else if (lowerUrl.includes(".flv") || lowerUrl.includes("/flv/")) {
    protocol = "flv";
  }
  // WebRTC 协议
  else if (
    lowerUrl.startsWith("ws://") ||
    lowerUrl.startsWith("wss://") ||
    lowerUrl.includes("/webrtc/")
  ) {
    protocol = "webrtc";
  }
  // DASH 协议
  else if (lowerUrl.includes(".mpd") || lowerUrl.includes("/dash/")) {
    protocol = "dash";
  }
  // 默认返回 RTMP
  else {
    protocol = "rtmp";
  }

  // 缓存结果（限制缓存大小，防止内存泄漏）
  if (protocolCache.size < 1000) {
    protocolCache.set(url, protocol);
  }

  return protocol;
}

/**
 * 清理协议检测缓存
 */
export function clearProtocolCache(): void {
  protocolCache.clear();
}

/**
 * 验证协议是否支持
 *
 * @param protocol 协议类型
 * @throws ProtocolNotSupportedError 如果协议不支持
 */
export function validateProtocol(
  protocol: string,
): asserts protocol is StreamProtocol {
  if (!SUPPORTED_PROTOCOLS.includes(protocol as StreamProtocol)) {
    throw new ProtocolNotSupportedError(protocol);
  }
}

/**
 * 解析 RTMP URL
 *
 * @param url RTMP URL
 * @returns 解析结果
 */
export function parseRtmpUrl(url: string): {
  protocol: "rtmp";
  host: string;
  port: number;
  app: string;
  streamKey: string;
} {
  const match = url.match(/^rtmp:\/\/([^:]+):?(\d+)?\/(.+)\/(.+)$/);
  if (!match) {
    throw new Error(`无效的 RTMP URL: ${url}`);
  }

  return {
    protocol: "rtmp",
    host: match[1],
    port: match[2] ? parseInt(match[2], 10) : 1935,
    app: match[3],
    streamKey: match[4],
  };
}

/**
 * 解析 HLS URL
 *
 * @param url HLS URL
 * @returns 解析结果
 */
export function parseHlsUrl(url: string): {
  protocol: "hls";
  baseUrl: string;
  playlistName: string;
} {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split("/");
  const playlistName = pathParts[pathParts.length - 1] || "playlist.m3u8";

  return {
    protocol: "hls",
    baseUrl: urlObj.origin +
      urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf("/")),
    playlistName,
  };
}

/**
 * 获取协议的默认端口
 *
 * @param protocol 协议类型
 * @returns 默认端口
 */
export function getDefaultPort(protocol: StreamProtocol): number {
  switch (protocol) {
    case "rtmp":
      return 1935;
    case "hls":
    case "flv":
    case "dash":
      return 80;
    case "webrtc":
      return 8080;
    default:
      return 80;
  }
}

/**
 * 检查协议是否支持推流
 *
 * @param protocol 协议类型
 * @returns 是否支持推流
 */
export function supportsPublishing(protocol: StreamProtocol): boolean {
  return protocol === "rtmp" || protocol === "webrtc";
}

/**
 * 检查协议是否支持拉流
 *
 * @param protocol 协议类型
 * @returns 是否支持拉流
 */
export function supportsSubscribing(protocol: StreamProtocol): boolean {
  return true; // 所有协议都支持拉流
}
