/** The main process has no panel i18n: its few words come in the system's language, English when it has none. */
export type Lang = "en" | "es" | "zh";

export const langOf = (locale: string | undefined): Lang =>
  locale?.startsWith("es") ? "es" : locale?.startsWith("zh") ? "zh" : "en";
