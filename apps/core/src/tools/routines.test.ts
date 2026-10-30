import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { ApxClient } from "@apx/protocol/client";
import { callTool, inputsOrEnd, say, scriptedLlm, startCore } from "../engine/testkit.ts";
import { routineTools } from "./routines.ts";

// Each owner message names the tool call the scripted model makes; the tool's result comes back as the answer.
const CALLS: Record<string, [string, object]> = {
  "what routines do I have?": ["routine_list", {}],
  "show me weather-acme": ["routine_list", { routine: "weather-acme" }],
  "make a tea reminder": ["routine_set", { name: "tea", prompt: "Remind me to drink tea", every_min: 90 }],
  "make a coffee reminder": ["routine_set", { name: "coffee", prompt: "Remind me to drink coffee", every_min: 90 }],
  "make weather-acme shorter and run it": [
    "routine_set",
    { routine: "weather-acme", prompt: "Say the weather in one line", run_now: true },
  ],
  "turn off weather-acme": ["routine_set", { routine: "weather-acme", enabled: false }],
  "show pipeline-acme": ["routine_list", { routine: "pipeline-acme" }],
  "change pipeline commands": [
    "routine_set",
    { routine: "pipeline-acme", pre_command: "echo ready", post_command: "echo delivered" },
  ],
  "clear pipeline commands": ["routine_set", { routine: "pipeline-acme", pre_command: "", post_command: "" }],
  "change pipeline prompt": ["routine_set", { routine: "pipeline-acme", prompt: "Summarize the result" }],
  "create pipeline": [
    "routine_set",
    {
      name: "pipeline-new",
      prompt: "Summarize",
      every_min: 90,
      enabled: false,
      pre_command: "echo ready",
      post_command: "echo delivered",
    },
  ],
};
const llm = scriptedLlm((req, { said, afterTool }) => {
  if (afterTool) return say(String(req.messages.at(-1)?.content));
  const call =
    CALLS[said] ?? (said.includes("change pipeline commands") ? CALLS["change pipeline commands"] : undefined);
  return call ? callTool("c1", call[0], call[1]) : say("SKIP");
});
let env: Awaited<ReturnType<typeof startCore>>;
before(async () => {
  env = await startCore({ llm });
});
after(async () => {
  await env.core.close();
  await env.cleanup();
});

const lastSeen = () => String(llm.calls.at(-1)?.messages.at(-1)?.content);

async function ask(text: string, decision?: "approve" | "deny"): Promise<string> {
  const thread = await env.client.call("threads.create", { kind: "loose", agent_id: "roby", title: "Routines" });
  await env.client.call("threads.send", { thread: thread.id, text });
  if (decision) {
    const pending: Array<{ id: string; tool?: string | undefined }> = await inputsOrEnd(env.client, thread.id);
    assert.equal(pending[0]?.tool, "routine_set");
    await env.client.call("runs.respond", { input: pending[0]?.id ?? "", decision });
  }
  await env.settle(thread.id);
  return lastSeen();
}

const byName = async (name: string) =>
  (await env.client.call("routines.list", {})).routines.find((r) => r.name === name);

test("routine_list shows global and project routines with the id apx routines takes", async () => {
  const { project } = await env.client.call("projects.create", { name: "Acme" });
  const global = await env.client.call("routines.set", {
    name: "weather-acme",
    agent: "roby",
    schedule: { kind: "cron", cron: "0 8 * * *" },
    prompt: "Say the weather",
  });
  const scoped = await env.client.call("routines.set", {
    name: "acme-digest",
    agent: "roby",
    project: project.id,
    schedule: { kind: "every", minutes: 60 },
    prompt: "Sum up the day",
    enabled: false,
  });
  const out = await ask("what routines do I have?");
  assert.match(out, new RegExp(`- weather-acme \\[${global.id}\\] \\(agent roby, cron 0 8 \\* \\* \\*, on, next `));
  assert.match(out, new RegExp(`- acme-digest \\[${scoped.id}\\] \\(agent roby, project Acme, every 60 min, off\\)`));
});

test("routine_list with a name shows that routine's whole prompt", async () => {
  assert.match(
    await ask("show me weather-acme"),
    /- weather-acme .*\npre_command:\n\(none\)\npost_command:\n\(none\)\nprompt:\nSay the weather$/,
  );
});

test("routine_set creates a routine only once the owner says yes", async () => {
  assert.match(await ask("make a tea reminder", "deny"), /not run: the owner declined/);
  assert.equal(await byName("tea"), undefined);

  assert.match(
    await ask("make a coffee reminder", "approve"),
    /saved: - coffee \[rtn_\w+\] \(agent roby, every 90 min, on/,
  );
  const coffee = await byName("coffee");
  assert.equal(coffee?.prompt, "Remind me to drink coffee");
  assert.equal(coffee?.agent_id, "roby");
});

test("routine_set changes only what it is given, by name, and can run the routine now", async () => {
  const out = await ask("make weather-acme shorter and run it", "approve");
  assert.match(out, /saved: - weather-acme .*cron 0 8 \* \* \*, on/);
  assert.match(out, /running now in thread th_/);
  const r = await byName("weather-acme");
  assert.equal(r?.prompt, "Say the weather in one line");
  assert.deepEqual(r?.schedule, { kind: "cron", cron: "0 8 * * *" });
  for (let i = 0; i < 100 && !(await env.client.call("routines.runs", { routine: r?.id ?? "" })).runs.length; i++)
    await new Promise((res) => setTimeout(res, 20));
  assert.equal((await env.client.call("routines.runs", { routine: r?.id ?? "" })).runs.length, 1);

  await ask("turn off weather-acme", "approve");
  const off = await byName("weather-acme");
  assert.equal(off?.enabled, false);
  assert.equal(off?.prompt, "Say the weather in one line");
});

test("routine commands are visible, owner-approved even in Total, preserved when omitted, and clearable", async () => {
  const original = {
    name: "pipeline-acme",
    agent: "roby",
    schedule: { kind: "manual" as const },
    prompt: "Summarize",
    pre_command: "echo before",
    post_command: "echo after",
  };
  await env.client.call("routines.set", original);
  const shown = await ask("show pipeline-acme");
  assert.match(shown, /pre_command:\necho before/);
  assert.match(shown, /post_command:\necho after/);

  await env.client.call("agents.update", { agent: "roby", autonomy: "total" });
  try {
    const thread = await env.client.call("threads.create", { kind: "loose", agent_id: "roby", title: "Commands" });
    await env.client.call("threads.send", { thread: thread.id, text: "change pipeline commands" });
    const [card] = await inputsOrEnd(env.client, thread.id);
    assert.equal(card?.tool, "routine_set");
    assert.match(card?.detail ?? "", /echo before[\s\S]*echo ready/);
    assert.match(card?.detail ?? "", /echo after[\s\S]*echo delivered/);
    assert.deepEqual(card?.approval_scopes ?? [], []);
    assert.equal((await byName(original.name))?.post_command, original.post_command);
    await env.client.call("runs.respond", { input: card?.id ?? "", decision: "deny" });
    await env.settle(thread.id);
    assert.equal((await byName(original.name))?.pre_command, original.pre_command);
    assert.equal((await byName(original.name))?.post_command, original.post_command);

    await ask("change pipeline commands", "approve");
    const changed = await byName(original.name);
    assert.equal(changed?.pre_command, "echo ready");
    assert.equal(changed?.post_command, "echo delivered");
    assert.equal(changed?.prompt, original.prompt);
    assert.deepEqual(changed?.schedule, original.schedule);
  } finally {
    await env.client.call("agents.update", { agent: "roby", autonomy: null });
  }

  await ask("change pipeline prompt", "approve");
  const preserved = await byName(original.name);
  assert.equal(preserved?.prompt, "Summarize the result");
  assert.equal(preserved?.pre_command, "echo ready");
  assert.equal(preserved?.post_command, "echo delivered");
  await ask("clear pipeline commands", "approve");
  const cleared = await byName(original.name);
  assert.equal(cleared?.pre_command, undefined);
  assert.equal(cleared?.post_command, undefined);
  assert.match(await ask("show pipeline-acme"), /pre_command:\n\(none\)\npost_command:\n\(none\)/);
});

test("routine_set can create commands but rejects another agent's request to change them", async () => {
  await ask("create pipeline", "approve");
  const created = await byName("pipeline-new");
  assert.equal(created?.pre_command, "echo ready");
  assert.equal(created?.post_command, "echo delivered");
  assert.equal(created?.enabled, false);

  const thread = await env.client.call("threads.create", { kind: "loose", agent_id: "roby", title: "Delegated" });
  const agent = new ApxClient({ url: env.core.url, actor: "agent" });
  await agent.call("threads.send", { thread: thread.id, text: "change pipeline commands" });
  await env.settle(thread.id);
  assert.deepEqual((await env.client.call("runs.pending", { thread: thread.id })).inputs, []);
  assert.match(lastSeen(), /only when they ask you themselves/);
  assert.equal((await byName("pipeline-acme"))?.post_command, undefined);
});

test("routine command arguments keep the protocol's limits and empty-string clearing", () => {
  const tool = routineTools(env.core.store).find((t) => t.name === "routine_set");
  assert.ok(tool);
  for (const key of ["pre_command", "post_command"]) {
    assert.equal(tool.parse({ [key]: "x".repeat(4000) }).ok, true);
    assert.equal(tool.parse({ [key]: "x".repeat(4001) }).ok, false);
    assert.deepEqual(tool.parse({ [key]: "  " }), { ok: true, args: { [key]: "" } });
  }
});
