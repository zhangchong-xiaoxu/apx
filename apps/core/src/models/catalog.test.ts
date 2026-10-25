import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createBus } from "../bus.ts";
import type { ProviderConfig } from "../config.ts";
import { openDb } from "../db/db.ts";
import { createStore } from "../domain/store.ts";
import { createSecrets } from "../secrets.ts";
import { tempDir } from "../testkit/platform.ts";
import { catalogWindow, createCatalog } from "./catalog.ts";

test("a model's context window is read from what its API tells: LiteLLM's /model/info or a context_length", async () => {
  const dir = tempDir("apx-catalog-window-");
  const home = dir.path;
  const db = openDb(home);
  try {
    const store = createStore(db, createBus());
    const secrets = createSecrets(home, "file", {});
    secrets.set("k", "key");
    const providers: ProviderConfig[] = [
      {
        id: "gw",
        transport: "openai-chat",
        base_url: "http://gw.test/v1/",
        key: "secret://k",
        models: ["glm-5", "unknown-x"],
      },
      { id: "or", transport: "openai-chat", base_url: "http://or.test/v1", key: "secret://k", models: [] },
    ];
    const asked: string[] = [];
    const catalog = createCatalog({
      store,
      secrets,
      providers: () => providers,
      fetchImpl: (async (url: string) => {
        asked.push(url);
        if (url === "http://gw.test/v1/model/info")
          return new Response(
            JSON.stringify({
              data: [
                { model_name: "glm-5", model_info: { max_input_tokens: 202_752 } },
                { model_name: "glm-5", model_info: { max_input_tokens: 1 } },
                { model_name: "unknown-x", model_info: { max_input_tokens: null } },
              ],
            }),
          );
        if (url === "http://or.test/v1/models")
          return new Response(
            JSON.stringify({
              data: [
                { id: "minimax-m2-5", context_length: 1_000_000 },
                { id: "gpt-x", max_input_tokens: 128_000 },
              ],
            }),
          );
        return new Response("not found", { status: 404 });
      }) as unknown as typeof fetch,
      home: "/nonexistent",
      acpList: async () => [],
      harnessLists: { claude: async () => [], codex: async () => [] },
    });
    const list = await catalog.list();
    assert.deepEqual(
      list.find((e) => e.id === "gw")?.models.map((m) => [m.id, m.window]),
      [
        ["glm-5", 202_752],
        ["unknown-x", undefined],
      ],
    );
    assert.deepEqual(
      list.find((e) => e.id === "or")?.models.map((m) => [m.id, m.window]),
      [
        ["minimax-m2-5", 1_000_000],
        ["gpt-x", 128_000],
      ],
    );
    assert.ok(!asked.includes("http://or.test/v1/model/info"), "a list that tells its windows is not asked again");
    assert.equal(catalogWindow(store, "gw/glm-5#high"), 202_752);
    assert.equal(catalogWindow(store, "gw/unknown-x"), undefined);
    assert.equal(catalogWindow(store, "gw"), undefined);
  } finally {
    db.close();
    await dir.remove();
  }
});

test("the catalog asks each engine for its models, caches them and keeps the last good list on failure", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "apx-catalog-"));
  const db = openDb(home);
  try {
    const store = createStore(db, createBus());
    const secrets = createSecrets(home, "file", {});
    secrets.set("g", "key");
    const providers: ProviderConfig[] = [
      { id: "g", transport: "openai-chat", base_url: "http://g.test", key: "secret://g", models: [] },
      { id: "nokey", transport: "openai-chat", base_url: "http://n.test", key: "secret://none", models: [] },
    ];
    let up = true;
    let calls = 0;
    const catalog = createCatalog({
      store,
      secrets,
      providers: () => providers,
      fetchImpl: (async (url: string) => {
        if (url.endsWith("/model/info")) return new Response("not found", { status: 404 });
        calls++;
        if (!up) return new Response("down", { status: 503 });
        return new Response(JSON.stringify({ data: [{ id: "models/g-pro" }, { id: "models/g-embedding-1" }] }));
      }) as unknown as typeof fetch,
      home: "/nonexistent",
      acpList: async (a) => (a.id === "opencode" ? [{ id: "zen/pickle", name: "Pickle", chat: true }] : []),
      harnessLists: {
        claude: async () => [{ id: "claude-x", name: "Claude X", chat: true }],
        codex: async () => {
          throw new Error("not installed");
        },
      },
    });
    // A list an older APX kept (fresh, but read before efforts existed) is asked again, not served for a day.
    store.settings.set(
      "catalog:claude",
      JSON.stringify({
        id: "claude",
        kind: "harness",
        label: "Claude Code",
        available: true,
        models: [{ id: "old", name: "Old", chat: true }],
        fetched_at: new Date().toISOString(),
      }),
    );
    const first = await catalog.list();
    const g = first.find((e) => e.id === "g");
    assert.deepEqual(
      g?.models.map((m) => [m.id, m.chat]),
      [
        ["g-pro", true],
        ["g-embedding-1", false],
      ],
    );
    assert.equal(first.find((e) => e.id === "claude")?.models[0]?.id, "claude-x");
    assert.equal(first.find((e) => e.id === "codex")?.available, false);
    assert.match(first.find((e) => e.id === "nokey")?.detail ?? "", /no key/);
    await catalog.list();
    assert.equal(calls, 1, "served from the cache");
    up = false;
    const stale = await catalog.list(true);
    assert.equal(stale.find((e) => e.id === "g")?.models.length, 2);
    assert.match(stale.find((e) => e.id === "g")?.detail ?? "", /could not refresh/);
  } finally {
    db.close();
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("a signed-in plan's models are asked to the plan with its sign-in, never read from a CLI", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "apx-catalog-plan-"));
  const db = openDb(home);
  try {
    const store = createStore(db, createBus());
    const asked: Array<{ url: string; headers: Headers }> = [];
    const catalog = createCatalog({
      store,
      secrets: createSecrets(home, "file", {}),
      providers: () => [
        {
          id: "chatgpt",
          transport: "chatgpt-responses",
          base_url: "http://plan.test/codex",
          key: "oauth:plan",
          models: [],
        },
      ],
      fetchImpl: (async (url: string, init: RequestInit) => {
        asked.push({ url, headers: new Headers(init.headers) });
        return new Response(
          JSON.stringify({
            models: [
              { slug: "gpt-b", display_name: "GPT-B", priority: 2 },
              { slug: "gpt-a", display_name: "GPT-A", priority: 1, supported_reasoning_levels: [{ effort: "high" }] },
              { slug: "gpt-hidden", visibility: "hide" },
            ],
          }),
        );
      }) as unknown as typeof fetch,
      home: "/nonexistent",
      acpList: async () => [],
      harnessLists: {
        claude: async () => [],
        codex: async () => {
          throw new Error("the CLI is not asked for a plan's models");
        },
      },
      signIns: {
        "oauth:plan": {
          has: () => true,
          credentials: async () => ({ token: "tok", headers: { "chatgpt-account-id": "acct-1" } }),
        },
      },
    });
    const plan = (await catalog.list()).find((e) => e.id === "chatgpt");
    assert.deepEqual(
      plan?.models.map((m) => [m.id, m.efforts]),
      [
        ["gpt-a", ["high"]],
        ["gpt-b", undefined],
      ],
    );
    const call = asked.find((a) => a.url.startsWith("http://plan.test/codex/models?client_version="));
    assert.equal(call?.headers.get("authorization"), "Bearer tok");
    assert.equal(call?.headers.get("chatgpt-account-id"), "acct-1");
  } finally {
    db.close();
    fs.rmSync(home, { recursive: true, force: true });
  }
});
