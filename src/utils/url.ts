/**
 * @fileoverview URL 生成工具
 *
 * 用于生成推流和拉流 URL
 */

import type { StreamProtocol } from "../types.ts";

/**
 * 生成 RTMP 推流 URL
 *
 * @param host 服务器地址
 * @param port 服务器端口
 * @param app 应用名称
 * @param streamKey 流密钥
 * @returns RTMP URL
 */
export function generateRtmpUrl(
  host: string,
  port: number,
  app: string,
  streamKey: string,
): string {
  return `rtmp://${host}:${port}/${app}/${streamKey}`;
}

/**
 * 生成 RTMP 拉流 URL
 *
 * @param host 服务器地址
 * @param port 服务器端口
 * @param app 应用名称
 * @param streamKey 流密钥
 * @returns RTMP URL
 */
export function generateRtmpPlayUrl(
  host: string,
  port: number,
  app: string,
  streamKey: string,
): string {
  return generateRtmpUrl(host, port, app, streamKey);
}

/**
 * 生成 HLS 播放 URL
 *
 * SRS 默认生成的 HLS 文件路径格式为: [app]/[stream].m3u8
 * 例如: live/stream-key.m3u8
 *
 * @param host 服务器地址
 * @param port 服务器端口
 * @param app 应用名称
 * @param streamKey 流密钥
 * @returns HLS URL
 */
export function generateHlsUrl(
  host: string,
  port: number,
  app: string,
  streamKey: string,
): string {
  const protocol = port === 443 ? "https" : "http";
  // SRS 默认格式: [app]/[stream].m3u8，例如: live/stream-key.m3u8
  return `${protocol}://${host}:${port}/${app}/${streamKey}.m3u8`;
}

/**
 * 生成 WebRTC 播放 URL
 *
 * @param host 服务器地址
 * @param port 服务器端口
 * @param room 房间名称
 * @param streamKey 流密钥
 * @returns WebRTC URL
 */
export function generateWebRtcUrl(
  host: string,
  port: number,
  room: string,
  streamKey: string,
): string {
  const protocol = port === 443 ? "wss" : "ws";
  return `${protocol}://${host}:${port}/room/${room}/stream/${streamKey}`;
}

/**
 * 生成 FLV 播放 URL
 *
 * @param host 服务器地址
 * @param port 服务器端口
 * @param app 应用名称
 * @param streamKey 流密钥
 * @returns FLV URL
 */
export function generateFlvUrl(
  host: string,
  port: number,
  app: string,
  streamKey: string,
): string {
  const protocol = port === 443 ? "https" : "http";
  return `${protocol}://${host}:${port}/${app}/${streamKey}.flv`;
}

/**
 * 根据协议生成推流 URL
 *
 * @param protocol 协议类型
 * @param host 服务器地址
 * @param port 服务器端口
 * @param app 应用名称
 * @param streamKey 流密钥
 * @returns 推流 URL
 */
export function generatePublisherUrl(
  protocol: StreamProtocol,
  host: string,
  port: number,
  app: string,
  streamKey: string,
): string {
  switch (protocol) {
    case "rtmp":
      return generateRtmpUrl(host, port, app, streamKey);
    case "webrtc":
      return generateWebRtcUrl(host, port, app, streamKey);
    default:
      throw new Error(`不支持的推流协议: ${protocol}`);
  }
}

/**
 * 根据协议生成拉流 URL
 *
 * @param protocol 协议类型
 * @param host 服务器地址
 * @param port 服务器端口
 * @param app 应用名称
 * @param streamKey 流密钥
 * @returns 拉流 URL
 */
export function generateSubscriberUrl(
  protocol: StreamProtocol,
  host: string,
  port: number,
  app: string,
  streamKey: string,
): string {
  switch (protocol) {
    case "rtmp":
      return generateRtmpPlayUrl(host, port, app, streamKey);
    case "hls":
      return generateHlsUrl(host, port, app, streamKey);
    case "flv":
      return generateFlvUrl(host, port, app, streamKey);
    case "webrtc":
      return generateWebRtcUrl(host, port, app, streamKey);
    default:
      throw new Error(`不支持的拉流协议: ${protocol}`);
  }
}
