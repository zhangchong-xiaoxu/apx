import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { type TestContext, test } from "node:test";
import { createLlm, NO_KEY } from "../providers/llm.ts";
import type { AssistantItem, ChatItem } from "../providers/types.ts";
import { createSecrets } from "../secrets.ts";
import { tempDir } from "../testkit/platform.ts";
import { startCore, texts } from "./testkit.ts";

type Request = { model: string; messages: ChatItem[]; tools?: unknown[] };
const call = (args: string): AssistantItem => ({
  role: "assistant",
  content: null,
  tool_calls: [{ id: "c1", type: "function", function: { name: "file_write", arguments: args } }],
});

async function fixture(t: TestContext, reply: (req: Request) => AssistantItem | Response) {
  const dir = tempDir("apx-tool-finalization-");
  const requests: Request[] = [];
  const llm = createLlm({
    providers: () => [{ id: "fake", transport: "openai-chat", base_url: "http://fake.test", key: NO_KEY, models: [] }],
    secrets: createSecrets(dir.path, "file", {}),
    firstByteMs: 1000,
    retryDelayMs: 0,
    fetchImpl: async (_url, init) => {
      const req: Request = JSON.parse(String(init?.body));
      requests.push(req);
      const message = reply(req);
      if (message instanceof Response) return message;
      for (const [index, call] of (message.tool_calls ?? []).entries()) call.id = `c${requests.length}-${index}`;
      return new Response(
        `data: ${JSON.stringify({ choices: [{ delta: message, finish_reason: message.tool_calls ? "tool_calls" : "stop" }] })}\n\n` +
          "data: [DONE]\n\n",
      );
    },
  });
  const env = await startCore({
    home: dir.path,
    llm: { label: llm.label, complete: (req) => llm.complete({ ...req, models: ["fake/broken", "fake/good"] }) },
  });
  t.after(async () => {
    await env.core.close();
    await env.cleanup();
  });
  await env.client.call("agents.update", { agent: "roby", autonomy: "total" });
  const thread = await env.client.call("threads.create", { kind: "loose", agent_id: "roby" });
  const sent = await env.client.call("threads.send", { thread: thread.id, text: "Write notes.md with the draft." });
  const result = await env.settle(thread.id);
  const run = await env.client.call("runs.get", { run: sent.run.id });
  return { ...result, run, requests, file: path.join(env.home, "work", "notes.md"), env, thread };
}

test("malformed provider calls fall back and the real file tool writes exactly once", async (t) => {
  const result = await fixture(t, (req) => {
    if (req.messages.some((m) => m.role === "tool")) return { role: "assistant", content: "Saved the draft." };
    return call(req.model === "broken" ? '{"path":"notes.md"' : '{"path":"notes.md","content":"draft"}');
  });
  assert.equal(result.run.state, "completed");
  assert.equal(result.run.tool_calls, 1);
  assert.equal(fs.readFileSync(result.file, "utf8"), "draft");
  assert.deepEqual(
    result.requests.slice(0, 3).map((r) => r.model),
    ["broken", "broken", "good"],
  );
  const cards = result.messages.flatMap((m) => m.parts).filter((p) => p.type === "tool");
  assert.equal(cards.length, 1, "invalid JSON never reaches the executor");
  assert.equal(cards[0]?.status, "ok");
});

test("a same-model retry clears rejected success text before a tool card freezes it", async (t) => {
  let attempts = 0;
  const result = await fixture(t, (req) => {
    if (req.messages.some((m) => m.role === "tool")) return { role: "assistant", content: "Nothing was saved." };
    if (++attempts === 1) return { ...call('{"path":"notes.md"'), content: "Saved the draft successfully." };
    return call('{"content":"draft"}');
  });
  assert.equal(result.run.state, "completed");
  assert.equal(fs.existsSync(result.file), false);
  assert.deepEqual(
    result.requests.map((r) => r.model),
    ["broken", "broken", "broken"],
  );
  const answer = texts(result.messages).join("\n");
  assert.doesNotMatch(answer, /Saved the draft successfully/);
  assert.match(answer, /Nothing was saved/);
  assert.ok(result.messages.flatMap((m) => m.parts).some((p) => p.type === "tool" && p.status === "error"));
});

test("repeated schema failures reach an honest tool-free summary without a gateway 400", async (t) => {
  const result = await fixture(t, (req) => {
    if (req.tools?.length) return call('{"content":"draft"}');
    if (req.messages.some((m) => m.role === "tool" || (m.role === "assistant" && m.tool_calls?.length)))
      return new Response("tool history requires tools", { status: 400 });
    return { role: "assistant", content: "No document was saved: file_write requires a path." };
  });
  assert.equal(result.run.state, "completed");
  assert.equal(result.requests.length, 4);
  assert.equal(fs.existsSync(result.file), false);
  assert.ok(texts(result.messages).some((s) => s.startsWith("No document was saved")));
  const cards = result.messages.flatMap((m) => m.parts).filter((p) => p.type === "tool");
  assert.equal(cards.length, 3);
  assert.ok(cards.every((p) => p.status === "error"));
  const log = result.env.core.store.modelLog.forRun(result.run.id);
  assert.equal(
    log.filter((m) => m && typeof m === "object" && "role" in m && m.role === "tool").length,
    3,
    "the canonical tool history remains intact",
  );
});

for (const malformed of [true, false]) {
  test(`invalid output cannot complete a run (${malformed ? "truncated arguments" : "raw tool markup"})`, async (t) => {
    const result = await fixture(t, () =>
      malformed
        ? call('{"path":"notes.md"')
        : { role: "assistant", content: "<\uFF5C\uFF5CDSML\uFF5C\uFF5C calls>\nfile_write" },
    );
    assert.equal(result.run.state, "failed");
    assert.equal(result.run.tool_calls, 0);
    assert.equal(fs.existsSync(result.file), false);
    assert.equal(result.requests.length, 4);
    assert.ok(result.messages.at(-1)?.parts.some((p) => p.type === "notice" && p.level === "error"));
  });
}
