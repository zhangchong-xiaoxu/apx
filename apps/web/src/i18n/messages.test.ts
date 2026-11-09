import assert from "node:assert/strict";
import { test } from "node:test";
import { enApprovals } from "./approvals-en.ts";
import { esApprovals } from "./approvals-es.ts";
import { enBrowserEdit } from "./browser-edit-en.ts";
import { esBrowserEdit } from "./browser-edit-es.ts";
import { enComputer } from "./computer-en.ts";
import { esComputer } from "./computer-es.ts";
import { en as base } from "./en.ts";
import { enEmailSignatures } from "./en-email-signatures.ts";
import { enOnboarding } from "./en-onboarding.ts";
import { es as esBase } from "./es.ts";
import { esEmailSignatures } from "./es-email-signatures.ts";
import { esOnboarding } from "./es-onboarding.ts";
import { enFlow } from "./flow-en.ts";
import { esFlow } from "./flow-es.ts";
import { enIngress } from "./ingress-en.ts";
import { esIngress } from "./ingress-es.ts";
import { loadMessages, loadPack } from "./messages.ts";
import { enMove } from "./move-en.ts";
import { esMove } from "./move-es.ts";
import { enReceived } from "./received-en.ts";
import { esReceived } from "./received-es.ts";
import { enSecretary } from "./secretary-en.ts";
import { esSecretary } from "./secretary-es.ts";
import { enSignIn } from "./signin-en.ts";
import { esSignIn } from "./signin-es.ts";
import { enStorage } from "./storage-en.ts";
import { esStorage } from "./storage-es.ts";
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
    const messages = await loadMessages(lang);
    const pack = await loadPack("onboarding", lang);
    assert.equal(messages["setup.welcome.start"], undefined);
    assert.equal(messages["connect.error.badSsh"], undefined);
    assert.ok(pack["setup.welcome.start"]);
    assert.ok(pack["connect.error.badSsh"]);
    for (const key of Object.keys(enOnboarding) as (keyof typeof enOnboarding)[]) {
      assert.equal(messages[key], undefined, `${lang}: ${key} is only needed during onboarding`);
      assert.ok(pack[key], `${lang}: ${key} belongs to the onboarding pack`);
    }
    for (const key of ["setup.menu", "setup.engines.model", "setup.project.pick", "connect.title"] as const)
      assert.ok(messages[key]);
  }
});

test("approval details do not load with the first screen in either language", async () => {
  const { loadMessages, loadPack } = await import("./messages.ts");
  for (const lang of ["en", "es"] as const) {
    const messages = await loadMessages(lang);
    assert.equal(messages["input.browserSafety"], undefined);
    assert.equal(messages["input.confirmTitle"], undefined);
    assert.equal(messages["res.browserPermissionsHelp"], undefined);
    assert.equal(messages["input.sessionScope"], lang === "en" ? "This session" : "Esta sesión");
    for (const key of Object.keys(enApprovals) as (keyof typeof enApprovals)[]) {
      assert.equal(messages[key], undefined);
    }
    assert.deepEqual(await loadPack("approvals", lang), lang === "en" ? enApprovals : esApprovals);
  }
});

test("thread dialog strings load only with their pack in every language", async () => {
  for (const lang of ["en", "es", "zh"] as const) {
    const messages = await loadMessages(lang);
    const pack = await loadPack("threads", lang);
    for (const key of Object.keys(enThreadDialogs) as (keyof typeof enThreadDialogs)[])
      assert.equal(messages[key], undefined);
    assert.deepEqual(pack, lang === "en" ? enThreadDialogs : lang === "es" ? esThreadDialogs : zhThreadDialogs);
  }
});

test("Flow strings load only with their management screen in both languages", async () => {
  for (const lang of ["en", "es"] as const) {
    const base = await loadMessages(lang);
    const pack = await loadPack("flow", lang);
    for (const key of Object.keys(enFlow) as (keyof typeof enFlow)[]) assert.equal(base[key], undefined);
    assert.deepEqual(pack, lang === "en" ? enFlow : esFlow);
  }
});

test("public ingress strings load only with their configuration screen in both languages", async () => {
  for (const lang of ["en", "es"] as const) {
    const base = await loadMessages(lang);
    const pack = await loadPack("ingress", lang);
    assert.equal(base["hooks.title"], undefined);
    assert.equal(base["hooks.offBody"], undefined);
    assert.equal(pack["hooks.title"], lang === "en" ? "Public address" : "Dirección pública");
    for (const key of Object.keys(enIngress) as (keyof typeof enIngress)[]) assert.equal(base[key], undefined);
    assert.deepEqual(pack, lang === "en" ? enIngress : esIngress);
  }
});

test("public ingress request errors remain translated before its late pack arrives", async () => {
  const en = await loadMessages("en");
  const es = await loadMessages("es");
  assert.equal(en["hooks.failed"], "The public address could not change: {error}");
  assert.equal(es["hooks.failed"], "No se pudo cambiar la dirección pública: {error}");
});

test("signature strings load as a separate pack in every language", async () => {
  for (const lang of ["en", "es", "zh"] as const) {
    const messages = await loadMessages(lang);
    const pack = await loadPack("signatures", lang);
    assert.equal(messages["signature.saved"], undefined);
    assert.deepEqual(pack, lang === "en" ? enEmailSignatures : lang === "es" ? esEmailSignatures : zhEmailSignatures);
  }
});

test("secretary capability strings load only with the super-agent's settings in both languages", async () => {
  for (const lang of ["en", "es"] as const) {
    const base = await loadMessages(lang);
    const pack = await loadPack("secretary", lang);
    for (const key of Object.keys(enSecretary) as (keyof typeof enSecretary)[]) assert.equal(base[key], undefined);
    assert.deepEqual(pack, lang === "en" ? enSecretary : esSecretary);
  }
});

test("Chinese uses English for packs without Chinese translations", async () => {
  for (const pack of ["approvals", "browserEdit", "flow", "ingress", "move", "secretary", "signIn", "storage"] as const)
    assert.deepEqual(await loadPack(pack, "zh"), await loadPack(pack, "en"));
});

// A pack's strings belong to the language as much as the main chunk's.
const en = {
  ...base,
  ...enApprovals,
  ...enComputer,
  ...enReceived,
  ...enSysUsage,
  ...enOnboarding,
  ...enBrowserEdit,
  ...enMove,
  ...enStorage,
  ...enSignIn,
  ...enEmailSignatures,
  ...enThreadDialogs,
  ...enIngress,
  ...enFlow,
  ...enSecretary,
};
const es = {
  ...esBase,
  ...esApprovals,
  ...esComputer,
  ...esReceived,
  ...esSysUsage,
  ...esOnboarding,
  ...esBrowserEdit,
  ...esMove,
  ...esStorage,
  ...esSignIn,
  ...esEmailSignatures,
  ...esThreadDialogs,
  ...esIngress,
  ...esFlow,
  ...esSecretary,
};
const zhEnglish = {
  ...base,
  ...enComputer,
  ...enReceived,
  ...enSysUsage,
  ...enOnboarding,
  ...enEmailSignatures,
  ...enThreadDialogs,
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

// Each language is loaded alone, so a key it lacks would show as the bare key.
test("every English text has its Spanish translation", () => {
  const missing = Object.keys(en).filter((k) => (es as Record<string, string | undefined>)[k] === undefined);
  assert.deepEqual(missing, []);
});

test("every Chinese-supported English text has its Chinese translation", () => {
  const missing = Object.keys(zhEnglish).filter((key) => (zh as Record<string, string | undefined>)[key] === undefined);
  assert.deepEqual(missing, []);
});

// Loanwords are common elsewhere ("Chat", "Skills"); the model picker has none besides these names.
test("the model picker's Spanish texts are translated, not copied from English", () => {
  const tr = es as Record<string, string | undefined>;
  const words = (s: string) => s.replace(/\{\w+\}|Router|Ultra|[^A-Za-z]/g, "");
  const copied = Object.entries(en).filter(([k, v]) => k.startsWith("models.") && tr[k] === v && words(v));
  assert.deepEqual(
    copied.map(([k]) => k),
    [],
  );
});

test("a translation keeps the placeholders of its English text", () => {
  const tr = es as Record<string, string | undefined>;
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  const wrong = Object.entries(en)
    .filter(([k, v]) => tr[k] !== undefined && vars(tr[k] ?? "").join() !== vars(v).join())
    .map(([k]) => `es:${k}`);
  const zhTr = zh as Record<string, string | undefined>;
  wrong.push(
    ...Object.entries(zhEnglish)
      .filter(([k, v]) => zhTr[k] !== undefined && vars(zhTr[k] ?? "").join() !== vars(v).join())
      .map(([k]) => `zh:${k}`),
  );
  assert.deepEqual(wrong, []);
});

test("the routine steps hint shows the core's default, never a number of its own (DECISIONS.md#d-116)", () => {
  for (const messages of [base, esBase]) {
    const hint = messages["routines.maxStepsHint"] ?? "";
    assert.match(hint, /\{steps\}/);
    assert.doesNotMatch(hint.replace("5", "").replace("200", ""), /\d/);
  }
});

test("the memory hint shows the desktop's idle tab time, never a number of its own", () => {
  for (const messages of [base, esBase]) {
    const hint = messages["desktop.memoryHint"] ?? "";
    assert.match(hint, /\{minutes\}/);
    assert.doesNotMatch(hint.replace("4 GB", ""), /\d/);
  }
});
