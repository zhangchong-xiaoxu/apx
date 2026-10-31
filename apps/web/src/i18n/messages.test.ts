import assert from "node:assert/strict";
import { test } from "node:test";
import { enComputer } from "./computer-en.ts";
import { esComputer } from "./computer-es.ts";
import { en as enBase } from "./en.ts";
import { enEmailSignatures } from "./en-email-signatures.ts";
import { enOnboarding } from "./en-onboarding.ts";
import { es as esBase } from "./es.ts";
import { esEmailSignatures } from "./es-email-signatures.ts";
import { esOnboarding } from "./es-onboarding.ts";
import { loadMessages, loadPack } from "./messages.ts";
import { enReceived } from "./received-en.ts";
import { esReceived } from "./received-es.ts";
import { enSysUsage } from "./sysusage-en.ts";
import { esSysUsage } from "./sysusage-es.ts";
import { enThreadDialogs } from "./thread-dialogs-en.ts";
import { esThreadDialogs } from "./thread-dialogs-es.ts";
import { zh as zhBase } from "./zh.ts";
import { zhComputer } from "./zh-computer.ts";
import { zhEmailSignatures } from "./zh-email-signatures.ts";
import { zhOnboarding } from "./zh-onboarding.ts";
import { zhReceived } from "./zh-received.ts";
import { zhSysUsage } from "./zh-sysusage.ts";
import { zhThreadDialogs } from "./zh-thread-dialogs.ts";

test("onboarding text loads with its screens while shared setup labels remain on the first screen", async () => {
  for (const lang of ["en", "es", "zh"] as const) {
    const base = await loadMessages(lang);
    const pack = await loadPack("onboarding", lang);
    assert.equal(base["setup.welcome.start"], undefined);
    assert.equal(base["connect.error.badSsh"], undefined);
    assert.ok(pack["setup.welcome.start"]);
    assert.ok(pack["connect.error.badSsh"]);
    for (const key of Object.keys(enOnboarding) as (keyof typeof enOnboarding)[]) {
      assert.equal(base[key], undefined, `${lang}: ${key} is only needed during onboarding`);
      assert.ok(pack[key], `${lang}: ${key} belongs to the onboarding pack`);
    }
    for (const key of ["setup.menu", "setup.engines.model", "setup.project.pick", "connect.title"] as const)
      assert.ok(base[key]);
  }
});

test("thread dialog strings load only with their pack in every language", async () => {
  for (const lang of ["en", "es", "zh"] as const) {
    const base = await loadMessages(lang);
    const pack = await loadPack("threads", lang);
    for (const key of Object.keys(enThreadDialogs) as (keyof typeof enThreadDialogs)[]) {
      assert.equal(base[key], undefined);
    }
    assert.deepEqual(pack, lang === "en" ? enThreadDialogs : lang === "es" ? esThreadDialogs : zhThreadDialogs);
  }
});

test("signature strings load as a separate pack in every language", async () => {
  for (const lang of ["en", "es", "zh"] as const) {
    const base = await loadMessages(lang);
    const pack = await loadPack("signatures", lang);
    assert.equal(base["signature.saved"], undefined);
    assert.deepEqual(pack, lang === "en" ? enEmailSignatures : lang === "es" ? esEmailSignatures : zhEmailSignatures);
  }
});

const en = {
  ...enBase,
  ...enComputer,
  ...enReceived,
  ...enSysUsage,
  ...enOnboarding,
  ...enEmailSignatures,
  ...enThreadDialogs,
};
const es = {
  ...esBase,
  ...esComputer,
  ...esReceived,
  ...esSysUsage,
  ...esOnboarding,
  ...esEmailSignatures,
  ...esThreadDialogs,
};
const zh = {
  ...zhBase,
  ...zhComputer,
  ...zhReceived,
  ...zhSysUsage,
  ...zhOnboarding,
  ...zhEmailSignatures,
  ...zhThreadDialogs,
};

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
