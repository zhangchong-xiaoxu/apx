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

/** A translator for one language (tests pick theirs; the app uses the phone's). A count `n` of one reads
 * from the key's `…One` form when there is one: both languages say 1 apart from every other number. */
export function translator(language: Lang) {
  const dictionary = dictionaries[language];
  return (key: Key, vars: Record<string, string | number> = {}): string => {
    const one = `${key}One`;
    const text = Number(vars.n) === 1 && one in dictionary ? dictionary[one as Key] : dictionary[key];
    return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  };
}

export const t = translator(lang);
