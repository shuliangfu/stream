/**
 * @fileoverview ID 生成工具
 *
 * 用于生成流 ID、房间 ID 等唯一标识符
 */

/**
 * 生成唯一 ID
 *
 * @param prefix 前缀（可选）
 * @returns 唯一 ID
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  const id = `${timestamp}-${random}`;
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * 生成流 ID
 *
 * @returns 流 ID
 */
export function generateStreamId(): string {
  return generateId("stream");
}

/**
 * 生成房间 ID
 *
 * @returns 房间 ID
 */
export function generateRoomId(): string {
  return generateId("room");
}
