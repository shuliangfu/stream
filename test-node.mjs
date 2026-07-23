#!/usr/bin/env node
/**
 * Node.js test runner — runs stream unit tests in the MAIN process (no --test flag).
 *
 * 【Why 根源】同 foundry/database：Node 22 的 `node --test` 单文件仍 fork 子进程，子进程
 * stdout 作 TAP/IPC 通道被非 TAP 输出（logger.info/console.log）污染致 `structuredClone`
 * 反序列化失败。改 `node --import tsx --test-force-exit <file>` 不带 `--test` 标志，
 * node:test 主进程内自动执行注册用例，无 fork 无 IPC。
 *
 * 【范围】仅跑单元测试（18 文件）：tests/adapters/、tests/server/、tests/utils/、
 * tests/manager.test.ts。排除 tests/integration/（需真实流媒体服务器 + test.mp4）
 * 和 tests/client/browser-client.test.ts（需 Playwright 浏览器）。
 *
 * 【Invariant】One file per process invocation; exit code is the single source of truth.
 */
import { readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

// 显式置 CI=true：使脚本自包含，不依赖 Unix shell 前缀语法（Windows 不支持）。
process.env.CI = "true";

const testsRoot = resolve("tests");

/** 递归收集 .test.ts 文件，排除 integration/ 和 browser-client.test.ts */
function collectTestFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const st = statSync(fullPath);
    if (st.isDirectory()) {
      // 跳过 integration 目录
      if (entry === "integration") continue;
      collectTestFiles(fullPath, acc);
    } else if (
      entry.endsWith(".test.ts") &&
      entry !== "browser-client.test.ts"
    ) {
      acc.push(fullPath);
    }
  }
  return acc;
}

const files = collectTestFiles(testsRoot).sort();

console.log(`Found ${files.length} unit test files\n`);

let failed = 0;
for (const file of files) {
  const rel = file.replace(process.cwd() + "/", "");
  console.log(`▶ ${rel}`);
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--test-force-exit", file],
    {
      stdio: "inherit",
      env: { ...process.env, CI: "true" },
    },
  );
  if (result.status !== 0) {
    failed++;
    console.error(`✗ FAILED: ${rel}\n`);
  } else {
    console.log(`✓ ${rel}\n`);
  }
}

console.log("=".repeat(60));
if (failed > 0) {
  console.error(`✗ ${failed}/${files.length} test file(s) failed`);
  process.exit(1);
}
console.log(`✓ All ${files.length} test files passed`);
