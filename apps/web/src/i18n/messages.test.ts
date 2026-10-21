import assert from "node:assert/strict";
import { test } from "node:test";
import { en } from "./en.ts";
import { es } from "./es.ts";
import { zh } from "./zh.ts";

// Each language is loaded alone, so a key it lacks would show as the bare key.
for (const [language, translation] of Object.entries({ Spanish: es, Chinese: zh })) {
  test(`every English text has its ${language} translation`, () => {
    const missing = Object.keys(en).filter(
      (key) => (translation as Record<string, string | undefined>)[key] === undefined,
    );
    assert.deepEqual(missing, []);
  });
}

test("a translation keeps the placeholders of its English text", () => {
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const wrong = Object.entries({ es, zh }).flatMap(([language, translation]) =>
    Object.entries(en)
      .filter(([key, value]) => {
        const text = (translation as Record<string, string | undefined>)[key];
        return text !== undefined && vars(text).join() !== vars(value).join();
      })
      .map(([key]) => `${language}:${key}`),
  );
  assert.deepEqual(
    wrong,
    [],
  );
});
