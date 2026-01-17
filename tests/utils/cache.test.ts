/**
 * @fileoverview LRU 缓存测试
 */

import { describe, expect, it } from "@dreamer/test";
import { LRUCache } from "../../src/utils/cache.ts";

describe("LRUCache", () => {
  it("应该支持基本操作", () => {
    const cache = new LRUCache<string, number>({ maxSize: 3 });

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
    expect(cache.size).toBe(3);
  });

  it("应该实现 LRU 淘汰策略", () => {
    const cache = new LRUCache<string, number>({ maxSize: 3 });

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4); // 应该淘汰 "a"

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("d")).toBe(4);
    expect(cache.size).toBe(3);
  });

  it("应该更新访问顺序", () => {
    const cache = new LRUCache<string, number>({ maxSize: 3 });

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.get("a"); // 访问 "a"，使其成为最近使用的
    cache.set("d", 4); // 应该淘汰 "b" 而不是 "a"

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("d")).toBe(4);
  });

  it("应该支持 TTL 过期", async () => {
    const cache = new LRUCache<string, number>({ maxSize: 10, ttl: 100 });

    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(cache.get("a")).toBeUndefined();
  });

  it("应该更新已存在的值", () => {
    const cache = new LRUCache<string, number>({ maxSize: 3 });

    cache.set("a", 1);
    cache.set("a", 2); // 更新值

    expect(cache.get("a")).toBe(2);
    expect(cache.size).toBe(1);
  });

  it("应该支持删除操作", () => {
    const cache = new LRUCache<string, number>({ maxSize: 3 });

    cache.set("a", 1);
    cache.set("b", 2);
    cache.delete("a");

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.size).toBe(1);
  });

  it("应该支持清空操作", () => {
    const cache = new LRUCache<string, number>({ maxSize: 3 });

    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
  });

  it("应该支持 has 方法", () => {
    const cache = new LRUCache<string, number>({ maxSize: 3 });

    cache.set("a", 1);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
  });

  it("应该支持清理过期项", async () => {
    const cache = new LRUCache<string, number>({ maxSize: 10, ttl: 100 });

    cache.set("a", 1);
    cache.set("b", 2);

    await new Promise((resolve) => setTimeout(resolve, 150));

    const cleaned = cache.cleanup();
    expect(cleaned).toBe(2);
    expect(cache.size).toBe(0);
  });
});
