import assert from "node:assert/strict";
import path from "node:path";
import { after, before, test } from "node:test";
import { say, scriptedLlm, startCore, texts } from "../engine/testkit.ts";
import { realpath } from "../paths.ts";
import { type TempDir, tempDir } from "../testkit/platform.ts";

const FAKE = path.join(import.meta.dirname, "..", "harness", "acp", "fake-agent.test-support.mjs");

let env: Awaited<ReturnType<typeof startCore>>;
let dir: TempDir;
let repo = "";

before(async () => {
  env = await startCore({ llm: scriptedLlm(() => say("ok")) });
  dir = tempDir("apx-acp-owned-");
  repo = realpath(dir.path);
  // Windows lists the same folder in either case: the session must still land in the project.
  const listed = process.platform === "win32" ? repo.charAt(0).toLowerCase() + repo.slice(1) : repo;
  env.core.store.settings.set(
    "acp_agents",
    JSON.stringify([{ id: "fake", label: "Fake ACP", command: process.execPath, args: [FAKE, "--sessions", listed] }]),
  );
});
after(async () => {
  await env.core.close();
  env.cleanup();
  await dir.remove();
});

test("an ACP agent's own sessions are listed and gone on with in APX, with what was said there", async () => {
  const project = (await env.client.call("projects.register", { path: repo, init: true })).project.id;
  const { sessions } = await env.client.call("sessions.native", { engine: "acp:fake" });
  assert.deepEqual(
    sessions.map((s) => [s.id, s.title]),
    [["owner-1", "Fix login"]],
  );

  const t = await env.client.call("sessions.resume", { engine: "acp:fake", id: "owner-1" });
  assert.equal(t.kind, "code");
  assert.equal(t.engine, "acp:fake");
  assert.equal(t.project_id, project);
  assert.equal(env.core.store.harnessSessions.get(t.id, "acp:fake"), "owner-1");
  const { messages } = await env.client.call("threads.get", { thread: t.id });
  assert.deepEqual(texts(messages), ["Fix the login form", "Fixed: the button."]);

  // Gone on with: it is APX's chat now, not listed again, and resuming again opens the same chat.
  assert.equal((await env.client.call("sessions.native", { engine: "acp:fake" })).sessions.length, 0);
  assert.equal((await env.client.call("sessions.resume", { engine: "acp:fake", id: "owner-1" })).id, t.id);
});

test("an engine that is not an ACP agent or a known CLI is refused", async () => {
  await assert.rejects(env.client.call("sessions.native", { engine: "acp:missing" }));
  await assert.rejects(env.client.call("sessions.native", { engine: "gemini" as "claude" }));
});
