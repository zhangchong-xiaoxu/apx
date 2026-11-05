import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { type TestContext, test } from "node:test";
import type { ProviderConfig } from "../config.ts";
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

async function fixture(
  t: TestContext,
  reply: (req: Request) => AssistantItem | Response,
  transport: ProviderConfig["transport"] = "openai-chat",
) {
  const dir = tempDir("apx-tool-finalization-");
  const requests: Request[] = [];
  const llm = createLlm({
    providers: () => [{ id: "fake", transport, base_url: "http://fake.test", key: NO_KEY, models: [] }],
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

test("malformed tool arguments return to the model, then the real file tool writes exactly once", async (t) => {
  let repaired = false;
  const result = await fixture(t, (req) => {
    if (req.messages.some((m) => m.role === "tool")) {
      if (!repaired) {
        repaired = true;
        return call('{"path":"notes.md","content":"draft"}');
      }
      return { role: "assistant", content: "Saved the draft." };
    }
    return call('{"path":"notes.md"');
  });
  assert.equal(result.run.state, "completed");
  assert.equal(result.run.tool_calls, 1);
  assert.equal(fs.readFileSync(result.file, "utf8"), "draft");
  assert.deepEqual(
    result.requests.map((r) => r.model),
    ["broken", "broken", "broken"],
  );
  const cards = result.messages.flatMap((m) => m.parts).filter((p) => p.type === "tool");
  assert.equal(cards.length, 1, "invalid JSON never reaches the executor");
  assert.equal(cards[0]?.status, "ok");
});

test("a length-finished tool call is discarded before the real file tool can execute it", async (t) => {
  const truncated = new Response(
    `data: ${JSON.stringify({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "truncated",
                type: "function",
                function: {
                  name: "file_write",
                  arguments: '{"path":"notes.md","content":"partial"}',
                },
              },
            ],
          },
          finish_reason: "length",
        },
      ],
    })}\n\ndata: [DONE]\n\n`,
  );
  const result = await fixture(t, (req) => {
    if (req.messages.some((m) => m.role === "tool"))
      return { role: "assistant", content: "Saved the recovered draft." };
    if (req.messages.some((m) => m.role === "user" && m.content.includes("cut off before its tool calls")))
      return call('{"path":"notes.md","content":"recovered"}');
    return truncated;
  });
  assert.equal(result.run.state, "completed");
  assert.equal(result.run.tool_calls, 1);
  assert.equal(fs.readFileSync(result.file, "utf8"), "recovered");
  assert.ok(
    !result.requests[1]?.messages.some(
      (m) => m.role === "assistant" && m.tool_calls?.some((toolCall) => toolCall.id === "truncated"),
    ),
    "the incomplete response is neither executed nor sent as provider history",
  );
});

test("a Responses incomplete event cannot execute a complete-looking file write", async (t) => {
  let count = 0;
  const result = await fixture(
    t,
    () => {
      if (++count === 1)
        return new Response(
          `data: ${JSON.stringify({
            type: "response.output_item.done",
            item: {
              id: "item1",
              type: "function_call",
              call_id: "c1",
              name: "file_write",
              arguments: '{"path":"notes.md","content":"partial"}',
            },
          })}\n\ndata: {"type":"response.incomplete","response":{"status":"incomplete"}}\n\n`,
        );
      return new Response(
        'data: {"type":"response.output_text.delta","delta":"No document was saved."}\n\n' +
          'data: {"type":"response.completed","response":{"status":"completed"}}\n\n',
      );
    },
    "chatgpt-responses",
  );
  assert.equal(result.run.state, "completed");
  assert.equal(result.run.tool_calls, 0);
  assert.equal(fs.existsSync(result.file), false);
  assert.equal(count, 2);
});

test("duplicate tool IDs discard the whole batch before a real file write", async (t) => {
  let count = 0;
  const result = await fixture(t, () => {
    if (++count > 1) return { role: "assistant", content: "No document was saved." };
    const calls = [
      { index: 0, id: "same", type: "function", function: { name: "file_write", arguments: '{"path":"notes.md"' } },
      {
        index: 1,
        id: "same",
        type: "function",
        function: { name: "file_write", arguments: '{"path":"notes.md","content":"draft"}' },
      },
    ];
    return new Response(
      `data: ${JSON.stringify({ choices: [{ delta: { tool_calls: calls }, finish_reason: "tool_calls" }] })}\n\n` +
        "data: [DONE]\n\n",
    );
  });
  assert.equal(result.run.state, "completed");
  assert.equal(result.run.tool_calls, 0);
  assert.equal(fs.existsSync(result.file), false);
  assert.equal(count, 2);
  assert.ok(!result.requests[1]?.messages.some((m) => m.role === "assistant" && m.tool_calls?.length));
});

test("a malformed tool call cannot show its accompanying success text", async (t) => {
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
    ["broken", "broken"],
  );
  const answer = texts(result.messages).join("\n");
  assert.doesNotMatch(answer, /Saved the draft successfully/);
  assert.match(answer, /Nothing was saved/);
  assert.ok(result.requests[1]?.messages.some((m) => m.role === "tool" && /invalid JSON arguments/.test(m.content)));
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
    const result = await fixture(t, (req) => {
      if (malformed && req.messages.some((m) => m.role === "tool"))
        return { role: "assistant", content: "The call was invalid; nothing was saved." };
      return malformed
        ? call('{"path":"notes.md"')
        : { role: "assistant", content: "<\uFF5C\uFF5CDSML\uFF5C\uFF5C calls>\nfile_write" };
    });
    assert.equal(result.run.state, malformed ? "completed" : "failed");
    assert.equal(result.run.tool_calls, 0);
    assert.equal(fs.existsSync(result.file), false);
    if (malformed) {
      assert.equal(result.requests.length, 2);
      assert.match(texts(result.messages).join("\n"), /nothing was saved/i);
    } else {
      assert.equal(result.requests.length, 4);
      assert.ok(result.messages.at(-1)?.parts.some((p) => p.type === "notice" && p.level === "error"));
    }
  });
}
