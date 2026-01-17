/**
 * @fileoverview 流录制工具
 *
 * 提供流录制功能
 */

import { createCommand, makeTempFile } from "@dreamer/runtime-adapter";
import type { VideoQuality } from "../types.ts";
import { ConnectionError } from "./errors.ts";

/**
 * 录制选项
 */
export interface RecordingOptions {
  /** 输出文件路径（如果不提供，将创建临时文件） */
  output?: string;
  /** 视频质量 */
  quality?: VideoQuality;
  /** 是否录制音频 */
  audioEnabled?: boolean;
  /** 是否录制视频 */
  videoEnabled?: boolean;
  /** FFmpeg 路径 */
  ffmpegPath?: string;
  /** 录制时长（秒，0 表示无限制） */
  duration?: number;
}

/**
 * 录制结果
 */
export interface RecordingResult {
  /** 输出文件路径 */
  outputPath: string;
  /** 文件大小（字节） */
  size: number;
  /** 录制时长（秒） */
  duration: number;
}

/**
 * 使用 FFmpeg 录制流
 *
 * @param inputUrl 输入流 URL
 * @param options 录制选项
 * @returns 录制结果
 */
export async function recordStream(
  inputUrl: string,
  options: RecordingOptions = {},
): Promise<RecordingResult> {
  const ffmpeg = options.ffmpegPath || "ffmpeg";
  const outputPath = options.output || await makeTempFile({ suffix: ".mp4" });
  const args: string[] = [];

  // 输入 URL
  args.push("-i", inputUrl);

  // 视频编码
  if (options.videoEnabled !== false) {
    args.push("-c:v", "libx264");
    args.push("-preset", "medium");

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

  // 录制时长
  if (options.duration && options.duration > 0) {
    args.push("-t", String(options.duration));
  }

  // 输出文件
  args.push("-y", outputPath);

  // 创建 FFmpeg 进程
  const process = createCommand(ffmpeg, {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  // 启动进程
  try {
    await process.spawn();
    await process.status();

    // 获取文件信息
    const { stat } = await import("@dreamer/runtime-adapter");
    const fileStat = await stat(outputPath);
    const size = fileStat.size || 0;

    // 估算录制时长（如果提供了 duration，使用它；否则需要解析文件）
    const duration = options.duration || 0;

    return {
      outputPath,
      size,
      duration,
    };
  } catch (error) {
    throw new ConnectionError(
      `FFmpeg 录制失败: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * 使用 FFmpeg 录制流（实时，返回进程对象）
 *
 * @param inputUrl 输入流 URL
 * @param options 录制选项
 * @returns FFmpeg 进程和控制函数
 */
export async function recordStreamRealtime(
  inputUrl: string,
  options: RecordingOptions = {},
): Promise<
  { process: unknown; stop: () => Promise<void>; outputPath: string }
> {
  const ffmpeg = options.ffmpegPath || "ffmpeg";
  const outputPath = options.output || await makeTempFile({ suffix: ".mp4" });
  const args: string[] = [];

  // 输入 URL
  args.push("-i", inputUrl);

  // 视频编码
  if (options.videoEnabled !== false) {
    args.push("-c:v", "libx264");
    args.push("-preset", "medium");

    if (options.quality?.bitrate) {
      args.push("-b:v", String(options.quality.bitrate));
    } else {
      args.push("-b:v", "2000k");
    }

    if (options.quality?.width && options.quality?.height) {
      args.push("-s", `${options.quality.width}x${options.quality.height}`);
    }

    if (options.quality?.fps) {
      args.push("-r", String(options.quality.fps));
    }
  } else {
    args.push("-vn");
  }

  // 音频编码
  if (options.audioEnabled !== false) {
    args.push("-c:a", "aac");
    args.push("-b:a", "128k");
    args.push("-ar", "44100");
  } else {
    args.push("-an");
  }

  // 输出文件
  args.push("-y", outputPath);

  // 创建 FFmpeg 进程
  const process = createCommand(ffmpeg, {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  // 启动进程
  try {
    await process.spawn();
  } catch (error) {
    throw new ConnectionError(
      `FFmpeg 录制启动失败: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error instanceof Error ? error : undefined,
    );
  }

  // 返回进程和控制函数
  return {
    process,
    outputPath,
    stop: async () => {
      try {
        // kill 方法接受数字信号（15 = SIGTERM）
        process.kill(15);
        await process.status();
      } catch (error) {
        console.warn("停止 FFmpeg 录制进程时出错:", error);
      }
    },
  };
}
