// The built-in loop's limits: a browser session looks again as often as it needs and gets more steps than a plain
// turn; the same call again and again in a row is reminded first and stuck only at the eighth.
import assert from "node:assert/strict";
import { test } from "node:test";
import { callTool, say, scriptedLlm } from "../engine/testkit.ts";
import type { ChatItem } from "../providers/types.ts";
import { MAX_STEPS, nativeHarness } from "./native.ts";
import type { TurnIO } from "./types.ts";

const toolResults = (messages: ChatItem[]) => messages.filter((m) => m.role === "tool").length;
const notes = (messages: ChatItem[]) =>
  messages.filter((m) => m.role === "user" && String(m.content).startsWith("<system_note>")).map((m) => m.content);

/** One turn of the native loop, with tools answered by `answer` and nothing else around it. */
async function turn(
  next: (done: number) => ReturnType<typeof say>,
  answer: (name: string, args: Record<string, unknown>) => string = () => "ok",
) {
  // Like a real model: with the tools taken away, it can only answer.
  const llm = scriptedLlm((req) => (req.tools.length ? next(toolResults(req.messages)) : say("no tools left")));
  const ran: string[] = [];
  const io = {
    system: "system",
    history: [],
    input: { role: "user", content: "go" },
    tools: [{ type: "function", function: { name: "any", description: "", parameters: {} } }],
    models: ["fake/fake-1"],
    signal: new AbortController().signal,
    thread: { id: "t1" },
    onText() {},
    log() {},
    async execute(_id: string, name: string, args: Record<string, unknown>) {
      ran.push(name);
      return { ok: true, text: answer(name, args) };
    },
  } as unknown as TurnIO;
  const out = await nativeHarness(llm).run(io);
  return { out, ran, seen: llm.calls.at(-1)?.messages ?? [] };
}

test("a browser session can look at the page again and again, past a plain turn's steps", async () => {
  // Look, act, look again: 40 tool calls, a third of them the same snapshot.
  const { out, ran, seen } = await turn((done) => {
    if (done >= 40) return say("sent all three");
    if (done % 3 === 0) return callTool(`s${done}`, "browser_snapshot", { tab: "t1" });
    return callTool(`c${done}`, "browser_click", { tab: "t1", ref: `e${done}` });
  });
  assert.equal(out.text, "sent all three");
  assert.equal(ran.length, 40);
  assert.deepEqual(notes(seen), [], "never told it was stuck or out of steps");
});

test("reading the same page part is stuck only while it says the same", async () => {
  let page = 0;
  const changing = await turn(
    (done) => (done >= 5 ? say("read it") : callTool(`r${done}`, "browser_text", { tab: "t1" })),
    () => `page ${page++}`,
  );
  assert.equal(changing.ran.length, 5);
  assert.deepEqual(notes(changing.seen), []);

  const same = await turn((done) => (done >= 5 ? say("read it") : callTool(`r${done}`, "browser_text", { tab: "t1" })));
  assert.equal(same.ran.length, 5, "reminded, never cut, before the eighth");
  assert.deepEqual(
    notes(same.seen).map(
      (n) => /same arguments (\d+) times in a row\. If it is not getting you closer/.exec(String(n))?.[1],
    ),
    ["3", "5"],
  );
});

test("the same call eight times in a row is stuck: tools go off and the turn answers", async () => {
  const { out, ran, seen } = await turn((done) =>
    // Keys in another order are still the same call.
    callTool(`x${done}`, "memory_search", done % 2 ? { query: "q", limit: 5 } : { limit: 5, query: "q" }),
  );
  assert.equal(ran.length, 8);
  assert.equal(out.text, "no tools left");
  assert.match(
    String(notes(seen).at(-1)),
    /memory_search with the same arguments 8 times in a row\. Stop calling tools/,
  );
});

test("the same call between others is not a repeat: work that comes back to a read is not stuck", async () => {
  const { ran, seen } = await turn((done) =>
    done >= 12
      ? say("done")
      : done % 2
        ? callTool(`w${done}`, "file_write", { path: `f${done}.txt`, content: "x" })
        : callTool(`r${done}`, "file_read", { path: "notes.md" }),
  );
  assert.equal(ran.length, 12);
  assert.deepEqual(notes(seen), []);
});

test("a turn without the browser or the screen still ends at its own step limit", async () => {
  const { ran, seen } = await turn((done) => callTool(`m${done}`, "memory_search", { query: `q${done}` }));
  assert.equal(ran.length, MAX_STEPS);
  assert.equal(MAX_STEPS, 150, "room for a long code change and its review in one turn (DECISIONS.md#d-116)");
  assert.match(String(notes(seen).at(-1)), /ran out of steps/);
});

test("a turn given more steps uses them before it must answer", async () => {
  const llm = scriptedLlm((req) =>
    req.tools.length
      ? callTool(`m${req.messages.length}`, "memory_search", { query: `q${req.messages.length}` })
      : say("done"),
  );
  const io = {
    system: "system",
    history: [],
    input: { role: "user", content: "go" },
    tools: [{ type: "function", function: { name: "any", description: "", parameters: {} } }],
    steps: 30,
    models: ["fake/fake-1"],
    signal: new AbortController().signal,
    thread: { id: "t1" },
    onText() {},
    log() {},
    async execute() {
      return { ok: true, text: "ok" };
    },
  } as unknown as TurnIO;
  await nativeHarness(llm).run(io);
  assert.equal(llm.calls.filter((c) => c.tools.length).length, 30);
});

test("malformed tool JSON is returned to the model without executing the tool", async () => {
  const broken = callTool("bad", "file_write", {});
  const call = broken.message.tool_calls?.[0];
  assert.ok(call);
  call.function.arguments = '{"path":"notes.md"';
  let executed = 0;
  const { out, seen } = await turn(
    (done) => (done === 0 ? broken : say("recovered")),
    () => {
      executed++;
      return "written";
    },
  );
  assert.equal(out.text, "recovered");
  assert.equal(executed, 0);
  assert.match(
    String(seen.find((message) => message.role === "tool")?.content),
    /invalid JSON arguments for tool file_write/,
  );
});

test("different malformed arguments do not count as repeated calls", async () => {
  const { out, ran, seen } = await turn((done) => {
    if (done >= 8) return say("recovered");
    const broken = callTool(`bad${done}`, "file_write", {});
    const call = broken.message.tool_calls?.[0];
    assert.ok(call);
    call.function.arguments = `{"path":"file${done}"`;
    return broken;
  });
  assert.equal(out.text, "recovered");
  assert.deepEqual(ran, []);
  assert.equal(toolResults(seen), 8);
  assert.deepEqual(notes(seen), []);
});

test("the same malformed arguments are still recognized as repeated calls", async () => {
  const { out, ran, seen } = await turn((done) => {
    const broken = callTool(`bad${done}`, "file_write", {});
    const call = broken.message.tool_calls?.[0];
    assert.ok(call);
    call.function.arguments = '{"path":"file"';
    return broken;
  });
  assert.equal(out.text, "no tools left");
  assert.deepEqual(ran, []);
  assert.equal(toolResults(seen), 8);
  assert.match(String(notes(seen).at(-1)), /file_write with the same arguments 8 times in a row/);
});

test("truncated tool calls are discarded and retried before execution", async () => {
  let calls = 0;
  const { out, ran, seen } = await turn(() => {
    calls++;
    if (calls === 1) return { ...callTool("cut", "file_write", { content: "partial" }), finish: "length" };
    if (calls === 2) return callTool("complete", "file_write", { content: "whole" });
    return say("done");
  });
  assert.equal(out.text, "done");
  assert.deepEqual(ran, ["file_write"]);
  const callsInHistory = seen.flatMap((message) => (message.role === "assistant" ? (message.tool_calls ?? []) : []));
  assert.ok(
    callsInHistory.every((call) => call.id !== "cut"),
    "the discarded response is not sent back as history",
  );
  assert.match(notes(seen).join("\n"), /cut off before its tool calls could be executed/);
});

test("repeatedly truncated tool calls are never executed and end with tools disabled", async () => {
  let calls = 0;
  const { ran, seen } = await turn(() => {
    calls++;
    return { ...callTool(`cut${calls}`, "file_write", { content: "partial" }), finish: "length" };
  });
  assert.deepEqual(ran, []);
  assert.match(notes(seen).join("\n"), /was not executed/);
});

test("repeated duplicate tool IDs are never executed and end with tools disabled", async () => {
  let calls = 0;
  const { ran, seen } = await turn(() => {
    calls++;
    const duplicate = callTool(`c${calls}`, "file_write", { content: "first" });
    const second = callTool(`c${calls}`, "file_write", { content: "second" }).message.tool_calls?.[0];
    assert.ok(duplicate.message.tool_calls && second);
    duplicate.message.tool_calls.push(second);
    return duplicate;
  });
  assert.deepEqual(ran, []);
  assert.equal(calls, 3);
  assert.match(notes(seen).join("\n"), /duplicate tool call IDs/i);
});

test("the usage reported while a turn runs names the window of the model that answered", async () => {
  const llm = scriptedLlm(() => ({ ...say("done"), model: "fake/claude-test", usage: { input: 5000, output: 3 } }));
  const seen: unknown[] = [];
  const io = {
    system: "system",
    history: [],
    input: { role: "user", content: "go" },
    tools: [],
    models: ["fake/claude-test"],
    signal: new AbortController().signal,
    thread: { id: "t1" },
    onText() {},
    onUsage: (u: unknown) => seen.push(u),
    log() {},
  } as unknown as TurnIO;
  await nativeHarness(llm).run(io);
  assert.deepEqual(seen.at(-1), { input: 5000, output: 3, context: 5000, window: 200_000 });
});
