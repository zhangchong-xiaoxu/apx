// Languages the panel speaks. English is the source; each language is its own chunk, loaded when chosen, so the
// panel downloads and keeps only the one on screen. Every language holds every key (messages.test.ts).
import type { MessageKey } from "./en.ts";

export type { MessageKey };

export type Language = "en" | "es" | "zh";
export type Messages = Partial<Record<MessageKey, string>>;

export const LANGUAGES: readonly Language[] = ["en", "es", "zh"];

const LOADERS: Record<Language, () => Promise<Messages>> = {
  en: () => import("./en.ts").then((m) => m.en),
  es: () => import("./es.ts").then((m) => m.es),
  zh: () => import("./zh.ts").then((m) => m.zh),
};

export function loadMessages(lang: Language): Promise<Messages> {
  return LOADERS[lang]();
}

/** Each language named in itself, for the pickers. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: "English", es: "Español", zh: "简体中文" };

/** Intl locale for dates and numbers. */
export const LOCALES: Record<Language, string> = { en: "en-US", es: "es-AR", zh: "zh-CN" };

export function isLanguage(v: unknown): v is Language {
  return typeof v === "string" && (LANGUAGES as readonly string[]).includes(v);
}

export function defaultLanguage(): Language {
  const nav = typeof navigator === "undefined" ? "en" : navigator.language.toLowerCase();
  if (nav.startsWith("zh")) return "zh";
  return nav.startsWith("es") ? "es" : "en";
}
