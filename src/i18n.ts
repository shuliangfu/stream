/**
 * @module @dreamer/stream/i18n
 *
 * Stream 包 i18n：推拉流、SRS、协议、连接池等错误与提示的国际化。
 * 仅使用环境变量（LANGUAGE/LC_ALL/LANG）检测语言。
 */

import {
  createI18n,
  type I18n,
  type TranslationData,
  type TranslationParams,
} from "@dreamer/i18n";
import { getEnv } from "@dreamer/runtime-adapter";
import enUS from "./locales/en-US.json" with { type: "json" };
import zhCN from "./locales/zh-CN.json" with { type: "json" };

export type Locale = "en-US" | "zh-CN";
export const DEFAULT_LOCALE: Locale = "en-US";

const STREAM_LOCALES: Locale[] = ["en-US", "zh-CN"];
const LOCALE_DATA: Record<string, TranslationData> = {
  "en-US": enUS as TranslationData,
  "zh-CN": zhCN as TranslationData,
};

let streamI18n: I18n | null = null;

export function detectLocale(): Locale {
  const langEnv = getEnv("LANGUAGE") || getEnv("LC_ALL") || getEnv("LANG");
  if (!langEnv) return DEFAULT_LOCALE;
  const first = langEnv.split(/[:\s]/)[0]?.trim();
  if (!first) return DEFAULT_LOCALE;
  const match = first.match(/^([a-z]{2})[-_]([A-Z]{2})/i);
  if (match) {
    const normalized = `${match[1].toLowerCase()}-${
      match[2].toUpperCase()
    }` as Locale;
    if (STREAM_LOCALES.includes(normalized)) return normalized;
  }
  const primary = first.substring(0, 2).toLowerCase();
  if (primary === "zh") return "zh-CN";
  if (primary === "en") return "en-US";
  return DEFAULT_LOCALE;
}

/** 内部初始化，导入 i18n 时自动执行，不导出 */
function initStreamI18n(): void {
  if (streamI18n) return;
  const i18n = createI18n({
    defaultLocale: DEFAULT_LOCALE,
    fallbackBehavior: "default",
    locales: [...STREAM_LOCALES],
    translations: LOCALE_DATA as Record<string, TranslationData>,
  });
  i18n.setLocale(detectLocale());
  streamI18n = i18n;
}

initStreamI18n();

export function setStreamLocale(lang: Locale): void {
  initStreamI18n();
  if (streamI18n) streamI18n.setLocale(lang);
}

export function $tr(
  key: string,
  params?: TranslationParams,
  lang?: Locale,
): string {
  if (!streamI18n) initStreamI18n();
  if (!streamI18n) return key;
  if (lang !== undefined) {
    const prev = streamI18n.getLocale();
    streamI18n.setLocale(lang);
    try {
      return streamI18n.t(key, params);
    } finally {
      streamI18n.setLocale(prev);
    }
  }
  return streamI18n.t(key, params);
}
