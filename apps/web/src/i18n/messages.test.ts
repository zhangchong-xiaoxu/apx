import assert from "node:assert/strict";
import { test } from "node:test";
import { enComputer } from "./computer-en.ts";
import { esComputer } from "./computer-es.ts";
import { en as enBase } from "./en.ts";
import { es as esBase } from "./es.ts";
import { enReceived } from "./received-en.ts";
import { esReceived } from "./received-es.ts";
import { enSysUsage } from "./sysusage-en.ts";
import { esSysUsage } from "./sysusage-es.ts";
import { zh as zhBase } from "./zh.ts";
import { zhComputer } from "./zh-computer.ts";
import { zhReceived } from "./zh-received.ts";
import { zhSysUsage } from "./zh-sysusage.ts";

// A pack's strings belong to the language as much as the main chunk's.
const en = { ...enBase, ...enComputer, ...enReceived, ...enSysUsage };
const es = { ...esBase, ...esComputer, ...esReceived, ...esSysUsage };
const zh = { ...zhBase, ...zhComputer, ...zhReceived, ...zhSysUsage };

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
  assert.deepEqual(wrong, []);
});
