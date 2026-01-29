/**
 * @fileoverview 流媒体适配器模块
 *
 * 导出所有流媒体适配器。
 * 当前实现：SRS、FFmpeg、自定义（custom）。
 * 后续可扩展：nginx-rtmp、livekit 等。
 */

export * from "./base.ts";
export * from "./ffmpeg.ts";
export * from "./srs.ts";
