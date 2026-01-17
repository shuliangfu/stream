/**
 * @fileoverview 流状态管理工具
 *
 * 用于管理和转换流状态
 */

import type {
  PublisherStatus,
  StreamStatus,
  SubscriberStatus,
} from "../types.ts";

/**
 * 流状态转换表
 */
const STREAM_STATUS_TRANSITIONS: Record<
  StreamStatus,
  StreamStatus[]
> = {
  idle: ["publishing", "playing", "stopped"],
  publishing: ["stopped", "error"],
  playing: ["stopped", "error"],
  stopped: ["idle"],
  error: ["idle", "stopped"],
};

/**
 * 推流器状态转换表
 */
const PUBLISHER_STATUS_TRANSITIONS: Record<
  PublisherStatus,
  PublisherStatus[]
> = {
  idle: ["connecting"],
  connecting: ["connected", "error"],
  connected: ["publishing", "stopped", "error"],
  publishing: ["stopped", "error"],
  stopped: ["idle"],
  error: ["idle", "stopped"],
};

/**
 * 拉流器状态转换表
 */
const SUBSCRIBER_STATUS_TRANSITIONS: Record<
  SubscriberStatus,
  SubscriberStatus[]
> = {
  idle: ["connecting"],
  connecting: ["connected", "error"],
  connected: ["playing", "stopped", "error"],
  playing: ["buffering", "stopped", "error"],
  buffering: ["playing", "stopped", "error"],
  stopped: ["idle"],
  error: ["idle", "stopped"],
};

/**
 * 检查流状态转换是否有效
 *
 * @param current 当前状态
 * @param next 下一个状态
 * @returns 是否有效
 */
export function isValidStreamTransition(
  current: StreamStatus,
  next: StreamStatus,
): boolean {
  return STREAM_STATUS_TRANSITIONS[current]?.includes(next) ?? false;
}

/**
 * 检查推流器状态转换是否有效
 *
 * @param current 当前状态
 * @param next 下一个状态
 * @returns 是否有效
 */
export function isValidPublisherTransition(
  current: PublisherStatus,
  next: PublisherStatus,
): boolean {
  return PUBLISHER_STATUS_TRANSITIONS[current]?.includes(next) ?? false;
}

/**
 * 检查拉流器状态转换是否有效
 *
 * @param current 当前状态
 * @param next 下一个状态
 * @returns 是否有效
 */
export function isValidSubscriberTransition(
  current: SubscriberStatus,
  next: SubscriberStatus,
): boolean {
  return SUBSCRIBER_STATUS_TRANSITIONS[current]?.includes(next) ?? false;
}

/**
 * 获取流状态的显示名称
 *
 * @param status 流状态
 * @returns 显示名称
 */
export function getStreamStatusName(status: StreamStatus): string {
  const names: Record<StreamStatus, string> = {
    idle: "空闲",
    publishing: "推流中",
    playing: "播放中",
    stopped: "已停止",
    error: "错误",
  };
  return names[status] || status;
}

/**
 * 获取推流器状态的显示名称
 *
 * @param status 推流器状态
 * @returns 显示名称
 */
export function getPublisherStatusName(status: PublisherStatus): string {
  const names: Record<PublisherStatus, string> = {
    idle: "空闲",
    connecting: "连接中",
    connected: "已连接",
    publishing: "推流中",
    stopped: "已停止",
    error: "错误",
  };
  return names[status] || status;
}

/**
 * 获取拉流器状态的显示名称
 *
 * @param status 拉流器状态
 * @returns 显示名称
 */
export function getSubscriberStatusName(status: SubscriberStatus): string {
  const names: Record<SubscriberStatus, string> = {
    idle: "空闲",
    connecting: "连接中",
    connected: "已连接",
    playing: "播放中",
    buffering: "缓冲中",
    stopped: "已停止",
    error: "错误",
  };
  return names[status] || status;
}

/**
 * 检查状态是否为活动状态（推流或播放中）
 *
 * @param status 流状态
 * @returns 是否为活动状态
 */
export function isActiveStatus(status: StreamStatus): boolean {
  return status === "publishing" || status === "playing";
}

/**
 * 检查状态是否为错误状态
 *
 * @param status 流状态
 * @returns 是否为错误状态
 */
export function isErrorStatus(
  status: StreamStatus | PublisherStatus | SubscriberStatus,
): boolean {
  return status === "error";
}
