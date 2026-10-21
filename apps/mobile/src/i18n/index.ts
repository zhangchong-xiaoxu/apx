import { en, type Key } from "./en.ts";
import { es } from "./es.ts";
import { zh } from "./zh.ts";

export type { Key };
export type Lang = "en" | "es" | "zh";

const dictionaries: Record<Lang, Record<Key, string>> = { en, es, zh };

/** The phone's language when APX speaks it, English otherwise. */
export const lang: Lang = (() => {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  if (locale.startsWith("zh")) return "zh";
  return locale.startsWith("es") ? "es" : "en";
})();

/** A translator for one language (tests pick theirs; the app uses the phone's). */
export function translator(language: Lang) {
  return (key: Key, vars: Record<string, string | number> = {}): string =>
    dictionaries[language][key].replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export const t = translator(lang);
