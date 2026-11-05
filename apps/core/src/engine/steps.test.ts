// How many model calls a run gets on our own loop: a chat turn the owner watches stops early, a routine no one
// watches gets more, and a routine's own limit wins over both.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MAX_STEPS } from "../harness/native.ts";
import { createLlm, NO_KEY } from "../providers/llm.ts";
import { createSecrets } from "../secrets.ts";
import { tempDir } from "../testkit/platform.ts";
import { callTool, scriptedLlm, startCore } from "./testkit.ts";

// A model that never stops working: every call with tools asks for one more search.
const llm = scriptedLlm((req) =>
  req.tools.length
    ? callTool(`c${req.messages.length}`, "memory_search", { query: `q${req.messages.length}` })
    : { message: { role: "assistant", content: "Out of steps: here is what is left." } },
);
let env: Awaited<ReturnType<typeof startCore>>;

before(async () => {
  env = await startCore({ llm });
});
after(async () => {
  await env.core.close();
  await env.cleanup();
});

/** Model calls made with tools on, in one thread. */
const steps = (thread: string) => llm.calls.filter((c) => c.cacheKey === thread && c.tools.length).length;
const calls = (thread: string) => llm.calls.filter((c) => c.cacheKey === thread).length;

async function runRoutine(id: string) {
  const started = await env.client.call("routines.run", { routine: id });
  await env.settle(started.thread_id, 15_000);
  return steps(started.thread_id);
}

test("a chat turn the owner watches gets the same steps as background work", async () => {
  const t = await env.client.call("threads.create", { kind: "loose", agent_id: "roby" });
  await env.client.call("threads.send", { thread: t.id, text: "search everything" });
  await env.settle(t.id);
  assert.equal(steps(t.id), MAX_STEPS);
});

test("a routine gets the default steps, its own limit wins, and null puts the default back", async () => {
  const base = {
    name: "Long review",
    agent: "roby",
    schedule: { kind: "manual" as const },
    prompt: "Review every open issue.",
  };
  const r = await env.client.call("routines.set", base);
  assert.equal(r.max_steps, undefined);
  assert.equal(await runRoutine(r.id), MAX_STEPS);

  const own = await env.client.call("routines.set", { ...base, id: r.id, max_steps: 20 });
  assert.equal(own.max_steps, 20);
  assert.equal(await runRoutine(r.id), 20);

  const kept = await env.client.call("routines.set", { ...base, id: r.id, prompt: "Review the open issues." });
  assert.equal(kept.max_steps, 20, "absent keeps what the routine had");

  const cleared = await env.client.call("routines.set", { ...base, id: r.id, max_steps: null });
  assert.equal(cleared.max_steps, undefined);
});

test("a routine's limit is bounded", async () => {
  await assert.rejects(
    env.client.call("routines.set", {
      name: "Too long",
      agent: "roby",
      schedule: { kind: "manual" },
      prompt: "x",
      max_steps: 1000,
    }),
  );
});

test("an agent's step budget caps each run and a routine's smaller limit still wins", async () => {
  await env.client.call("agents.set_agent_limits", { agent: "roby", limits: { steps: 25 }, merge: false });
  try {
    const t = await env.client.call("threads.create", { kind: "loose", agent_id: "roby" });
    await env.client.call("threads.send", { thread: t.id, text: "search everything" });
    await env.settle(t.id);
    assert.equal(calls(t.id), 25);
    assert.equal(steps(t.id), 24, "the final tool-less report uses the 25th call");

    const base = {
      name: "Bounded review",
      agent: "roby",
      schedule: { kind: "manual" as const },
      prompt: "Review every open issue.",
    };
    const routine = await env.client.call("routines.set", { ...base, max_steps: 40 });
    assert.equal(await runRoutine(routine.id), 24);
    const smaller = await env.client.call("routines.set", { ...base, id: routine.id, max_steps: 20 });
    assert.equal(await runRoutine(smaller.id), 20);

    await env.client.call("agents.set_agent_limits", { agent: "roby", limits: { steps: 1 }, merge: true });
    const single = await env.client.call("threads.create", { kind: "loose", agent_id: "roby" });
    await env.client.call("threads.send", { thread: single.id, text: "search everything" });
    await env.settle(single.id);
    assert.equal(calls(single.id), 1);
    assert.equal(steps(single.id), 0, "a one-call cap leaves only the report");
  } finally {
    await env.client.call("agents.set_agent_limits", { agent: "roby", limits: null, merge: false });
  }
});

for (const failures of [1, 2]) {
  test(`an agent's model-call budget includes ${failures === 1 ? "retries" : "retries and fallback"}`, async () => {
    await using dir = tempDir("apx-call-budget-");
    const requests: Array<{ model: string; tools: boolean }> = [];
    const gateway = createLlm({
      providers: () => [
        {
          id: "fake",
          transport: "openai-chat",
          base_url: "http://fake.test",
          key: NO_KEY,
          models: ["fake-1", "fake-2"],
        },
      ],
      secrets: createSecrets(dir.path, "file", {}),
      firstByteMs: 1000,
      retryDelayMs: 0,
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { model: string; tools?: unknown[] };
        const tools = Boolean(body.tools?.length);
        requests.push({ model: body.model, tools });
        if (tools && requests.length <= failures) return new Response("overloaded", { status: 503 });
        const delta = tools
          ? callTool(`c${requests.length}`, "memory_search", { query: `q${requests.length}` }).message
          : { content: "Out of steps: here is what is left." };
        const choice = { delta, finish_reason: tools ? "tool_calls" : "stop" };
        return new Response(`data: ${JSON.stringify({ choices: [choice] })}\n\ndata: [DONE]\n\n`);
      },
    });
    const local = await startCore({ llm: gateway });
    try {
      await local.client.call("models.set_config", {
        default: { model: "fake/fake-1", router: true },
        router: { rules: [], chain: ["fake/fake-2"] },
      });
      await local.client.call("agents.set_agent_limits", { agent: "roby", limits: { steps: 3 }, merge: false });
      const thread = await local.client.call("threads.create", { kind: "loose", agent_id: "roby" });
      await local.client.call("threads.send", { thread: thread.id, text: "search everything" });
      const result = await local.settle(thread.id);
      assert.equal(result.runs[0]?.state, "completed");
      assert.equal(result.runs[0]?.end_reason, "step_limit");
      assert.deepEqual(requests, [
        { model: "fake-1", tools: true },
        { model: "fake-1", tools: true },
        { model: failures === 1 ? "fake-1" : "fake-2", tools: false },
      ]);
    } finally {
      await local.core.close();
      await local.cleanup();
    }
  });
}

for (const budget of [2, 3]) {
  test(`a ${budget}-call budget reserves its final report for a healthy fallback`, async () => {
    await using dir = tempDir("apx-call-fallback-");
    const requests: Array<{ model: string; tools: boolean }> = [];
    const gateway = createLlm({
      providers: () => [
        {
          id: "fake",
          transport: "openai-chat",
          base_url: "http://fake.test",
          key: NO_KEY,
          models: ["fake-1", "fake-2"],
        },
      ],
      secrets: createSecrets(dir.path, "file", {}),
      firstByteMs: 1000,
      retryDelayMs: 0,
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { model: string; tools?: unknown[] };
        requests.push({ model: body.model, tools: Boolean(body.tools?.length) });
        if (body.model === "fake-1") return new Response("overloaded", { status: 503 });
        return new Response(
          `data: ${JSON.stringify({ choices: [{ delta: { content: "No work was done." }, finish_reason: "stop" }] })}\n\n` +
            "data: [DONE]\n\n",
        );
      },
    });
    const local = await startCore({ llm: gateway });
    try {
      await local.client.call("models.set_config", {
        default: { model: "fake/fake-1", router: true },
        router: { rules: [], chain: ["fake/fake-2"] },
      });
      await local.client.call("agents.set_agent_limits", { agent: "roby", limits: { steps: budget }, merge: false });
      const thread = await local.client.call("threads.create", { kind: "loose", agent_id: "roby" });
      await local.client.call("threads.send", { thread: thread.id, text: "search everything" });
      const result = await local.settle(thread.id);
      assert.equal(result.runs[0]?.state, "completed");
      assert.equal(result.runs[0]?.end_reason, "step_limit");
      assert.deepEqual(requests, [
        ...Array.from({ length: budget - 1 }, () => ({ model: "fake-1", tools: true })),
        { model: "fake-2", tools: false },
      ]);
      const notice = result.messages.flatMap((message) => message.parts).find((part) => part.type === "notice");
      assert.equal(notice?.code, "engine.fallback");
      assert.match(String(notice?.vars?.why), /HTTP 503/);
    } finally {
      await local.core.close();
      await local.cleanup();
    }
  });
}
