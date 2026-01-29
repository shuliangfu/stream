/**
 * @fileoverview FFmpeg 工具函数
 *
 * 用于推流和拉流的 FFmpeg 命令生成和执行
 */

import { createCommand } from "@dreamer/runtime-adapter";
import type { VideoQuality } from "../types.ts";
import { ConnectionError } from "./errors.ts";

/**
 * FFmpeg 推流选项
 */
export interface FFmpegPublishOptions {
  /** 输入源（文件路径或设备） */
  input: string;
  /** 推流 URL */
  output: string;
  /** 视频质量 */
  quality?: VideoQuality;
  /** 是否启用音频 */
  audioEnabled?: boolean;
  /** 是否启用视频 */
  videoEnabled?: boolean;
  /** FFmpeg 路径 */
  ffmpegPath?: string;
  /** 是否循环播放（true 表示无限循环，false 或不设置表示不循环） */
  loop?: boolean;
}

/**
 * FFmpeg 拉流选项
 */
export interface FFmpegSubscribeOptions {
  /** 拉流 URL */
  input: string;
  /** 输出文件路径 */
  output: string;
  /** FFmpeg 路径 */
  ffmpegPath?: string;
}

/**
 * 使用 FFmpeg 推流
 *
 * @param options 推流选项
 * @returns FFmpeg 进程
 */
export async function publishWithFFmpeg(
  options: FFmpegPublishOptions,
): Promise<{ process: unknown; stop: () => Promise<void> }> {
  const ffmpeg = options.ffmpegPath || "ffmpeg";
  const args: string[] = [];

  // 输入源
  if (options.input.startsWith("/dev/")) {
    // 设备输入（如摄像头）
    args.push("-f", "v4l2", "-i", options.input);
  } else if (options.input.startsWith("screen://")) {
    // 屏幕录制
    args.push("-f", "x11grab", "-i", options.input);
  } else {
    // 文件输入
    // 如果设置了循环播放，添加循环参数
    if (options.loop === true) {
      // 无限循环（FFmpeg 的 -stream_loop -1 表示无限循环）
      args.push("-stream_loop", "-1");
    }
    // loop 为 false 或 undefined 时不添加参数，FFmpeg 默认不循环（相当于 0）
    args.push("-i", options.input);
  }

  // 视频编码
  if (options.videoEnabled !== false) {
    args.push("-c:v", "libx264");
    args.push("-preset", "veryfast");
    args.push("-tune", "zerolatency");

    // 码率
    if (options.quality?.bitrate) {
      args.push("-b:v", String(options.quality.bitrate));
    } else {
      args.push("-b:v", "2000k"); // 默认 2Mbps
    }

    // 分辨率
    if (options.quality?.width && options.quality?.height) {
      args.push("-s", `${options.quality.width}x${options.quality.height}`);
    }

    // 帧率
    if (options.quality?.fps) {
      args.push("-r", String(options.quality.fps));
    }

    // RTMP 推流参数
    args.push("-f", "flv");
  } else {
    args.push("-vn"); // 禁用视频
  }

  // 音频编码
  if (options.audioEnabled !== false) {
    args.push("-c:a", "aac");
    args.push("-b:a", "128k");
    args.push("-ar", "44100");
  } else {
    args.push("-an"); // 禁用音频
  }

  // 输出 URL
  args.push(options.output);

  // 创建 FFmpeg 命令对象
  const cmd = createCommand(ffmpeg, {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  // 启动进程（spawn 是同步方法，返回 SpawnedProcess）
  let child;
  try {
    child = cmd.spawn();
  } catch (error) {
    throw new ConnectionError(
      `FFmpeg 推流启动失败: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error instanceof Error ? error : undefined,
    );
  }

  // 返回进程和控制函数
  return {
    process: child,
    stop: async () => {
      try {
        // 尝试终止进程
        try {
          child.kill(15); // SIGTERM
          // 等待进程结束（添加超时）
          try {
            await Promise.race([
              child.status,
              new Promise((_, reject) => {
                setTimeout(() => reject(new Error("进程停止超时")), 2000);
              }),
            ]);
          } catch {
            // 如果超时，强制终止
            try {
              child.kill(9); // SIGKILL
            } catch {
              // 忽略强制终止错误
            }
          }
        } catch {
          // 如果终止失败，说明进程可能已经结束，忽略错误
        }
      } catch {
        // 忽略所有停止时的错误（进程可能已经自然结束）
        // 不输出警告，因为这是正常情况
      }
    },
  };
}

/**
 * 使用 FFmpeg 拉流
 *
 * @param options 拉流选项
 * @returns FFmpeg 进程
 */
export async function subscribeWithFFmpeg(
  options: FFmpegSubscribeOptions,
): Promise<{ process: unknown; stop: () => Promise<void> }> {
  const ffmpeg = options.ffmpegPath || "ffmpeg";
  const args: string[] = [];

  // 输入 URL
  args.push("-i", options.input);

  // 输出格式（根据输出文件扩展名判断）
  if (options.output.endsWith(".mp4")) {
    args.push("-c:v", "libx264");
    args.push("-c:a", "aac");
    args.push("-f", "mp4");
  } else if (options.output.endsWith(".flv")) {
    args.push("-c:v", "libx264");
    args.push("-c:a", "aac");
    args.push("-f", "flv");
  } else {
    args.push("-c", "copy"); // 直接复制流
  }

  // 输出文件
  args.push("-y", options.output);

  // 创建 FFmpeg 命令对象
  const cmd = createCommand(ffmpeg, {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  // 启动进程（spawn 是同步方法，返回 SpawnedProcess）
  let child;
  try {
    child = cmd.spawn();
  } catch (error) {
    throw new ConnectionError(
      `FFmpeg 拉流启动失败: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error instanceof Error ? error : undefined,
    );
  }

  // 返回进程和控制函数
  return {
    process: child,
    stop: async () => {
      try {
        // 尝试终止进程
        try {
          child.kill(15); // SIGTERM
          // 等待进程结束（添加超时）
          try {
            await Promise.race([
              child.status,
              new Promise((_, reject) => {
                setTimeout(() => reject(new Error("进程停止超时")), 2000);
              }),
            ]);
          } catch {
            // 如果超时，强制终止
            try {
              child.kill(9); // SIGKILL
            } catch {
              // 忽略强制终止错误
            }
          }
        } catch {
          // 如果终止失败，说明进程可能已经结束，忽略错误
        }
      } catch {
        // 忽略所有停止时的错误（进程可能已经自然结束）
        // 不输出警告，因为这是正常情况
      }
    },
  };
}

/**
 * HLS 转码选项
 */
export interface TranscodeToHLSOptions {
  /** 视频质量 */
  quality?: VideoQuality;
  /** 是否循环（-stream_loop -1） */
  loop?: boolean;
  /** FFmpeg 可执行路径 */
  ffmpegPath?: string;
}

/**
 * 使用 FFmpeg 将输入文件转码为 HLS（m3u8 + ts 分片）
 *
 * 输出到指定目录：playlist.m3u8 与 seg_000.ts, seg_001.ts ...
 * 调用方需负责创建 outputDir（如 makeTempDir）并在用完后删除。
 *
 * @param input 输入文件路径
 * @param outputDir 输出目录（必须已存在）
 * @param options 可选：质量、循环、ffmpeg 路径
 * @returns 播放列表路径与进程控制（用于 stop 时终止）
 */
export async function transcodeToHLS(
  input: string,
  outputDir: string,
  options?: TranscodeToHLSOptions,
): Promise<{
  playlistPath: string;
  process: unknown;
  stop: () => Promise<void>;
}> {
  const ffmpeg = options?.ffmpegPath || "ffmpeg";
  const args: string[] = [];

  // 输入
  if (options?.loop === true) {
    args.push("-stream_loop", "-1");
  }
  args.push("-i", input);

  // 视频
  args.push("-c:v", "libx264");
  args.push("-preset", "veryfast");
  if (options?.quality?.bitrate) {
    args.push("-b:v", String(options.quality.bitrate));
  } else {
    args.push("-b:v", "2000k");
  }
  if (options?.quality?.width && options?.quality?.height) {
    args.push("-s", `${options.quality.width}x${options.quality.height}`);
  }
  if (options?.quality?.fps) {
    args.push("-r", String(options.quality.fps));
  }

  // 音频
  args.push("-c:a", "aac");
  args.push("-b:a", "128k");
  args.push("-ar", "44100");

  // HLS 输出
  const playlistPath = `${outputDir.replace(/\/$/, "")}/playlist.m3u8`;
  const segmentPattern = `${outputDir.replace(/\/$/, "")}/seg_%03d.ts`;
  args.push("-hls_time", "2");
  args.push("-hls_list_size", "0");
  args.push("-hls_segment_filename", segmentPattern);
  args.push("-f", "hls");
  args.push(playlistPath);

  // 创建 FFmpeg 命令对象
  const cmd = createCommand(ffmpeg, {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  // 启动进程（spawn 是同步方法，返回 SpawnedProcess）
  let child;
  try {
    child = cmd.spawn();
  } catch (error) {
    throw new ConnectionError(
      `FFmpeg HLS 转码启动失败: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error instanceof Error ? error : undefined,
    );
  }

  return {
    playlistPath,
    process: child,
    stop: async () => {
      try {
        // 尝试终止进程
        try {
          child.kill(15); // SIGTERM
          try {
            await Promise.race([
              child.status,
              new Promise((_, reject) => {
                setTimeout(() => reject(new Error("进程停止超时")), 2000);
              }),
            ]);
          } catch {
            try {
              child.kill(9); // SIGKILL
            } catch {
              // ignore
            }
          }
        } catch {
          // 如果终止失败，说明进程可能已经结束，忽略错误
        }
      } catch {
        // ignore
      }
    },
  };
}
