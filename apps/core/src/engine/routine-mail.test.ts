import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";
import { RoutineMailConfig, type RoutineMailContent } from "@apx/protocol";
import { ApxClient } from "@apx/protocol/client";
import { SendError } from "../channels/types.ts";
import { createLog } from "../log.ts";
import { createSecrets } from "../secrets.ts";
import { tempDir, waitFor } from "../testkit/platform.ts";
import { openDisplay } from "./display.ts";
import { routinePipeline } from "./pipeline.ts";
import { createRoutineMail } from "./routine-mail.ts";
import { say, scriptedLlm, startCore } from "./testkit.ts";

let env: Awaited<ReturnType<typeof startCore>>;
let project = "";
const config = RoutineMailConfig.parse({
  smtp: { host: "smtp.example.com", port: 465, tls: "implicit" },
  from: "sender@example.com",
  to: "owner@example.com",
  secret: "secret://routine-mail",
});
const content: RoutineMailContent = {
  day: new Date().toLocaleDateString("en-CA"),
  subject: "Digest",
  text: "One update",
  html: "<p>One update</p>",
};
before(async () => {
  env = await startCore({ llm: scriptedLlm(() => say("SKIP")) });
  project = (await env.client.call("projects.create", { name: "Acme" })).project.id;
  await env.client.call("secrets.set", { name: "routine-mail", value: "test-mail-password" });
});
after(async () => {
  await env.core.close();
  await env.cleanup();
});

async function fixture(send: NonNullable<Parameters<typeof createRoutineMail>[0]["send"]> = async () => {}) {
  const routine = await env.client.call("routines.set", {
    name: "Digest",
    agent: "roby",
    project,
    schedule: { kind: "manual" },
    prompt: "Write a digest",
    post_command: "echo delivery",
  });
  const thread = await env.client.call("threads.create", { kind: "loose", agent_id: "roby", project_id: project });
  const run = env.core.store.runs.create({
    thread_id: thread.id,
    agent_id: "roby",
    trigger: "routine",
    input: { origin: { kind: "routine", id: routine.id, name: routine.name }, text: routine.prompt },
    deadline_at: "2099-01-01T00:00:00.000Z",
    state: "queued",
  });
  const done = env.core.store.runs.setState(run, "completed");
  const options = {
    store: env.core.store,
    secrets: { ...env.core.secrets, backend: "dpapi" as const },
    log: createLog("routine-mail-test", true),
    url: () => env.core.url,
    send,
  };
  const mail = createRoutineMail(options);
  mail.configure(routine.id, config);
  const controller = new AbortController();
  const ticket = mail.open(done, false, controller.signal);
  assert.ok(ticket);
  return { mail, routine, done, controller, ticket, options };
}

test("routine mail keeps the recipient and credential inside core, and remembers successful days", async () => {
  const sent: Array<{ from: string; to: string[]; data: Buffer }> = [];
  const f = await fixture(async (smtp, auth, mail) => {
    assert.deepEqual(smtp, config.smtp);
    assert.deepEqual(auth, { user: config.from, pass: "test-mail-password" });
    sent.push(mail);
  });
  assert.deepEqual(Object.keys(f.ticket.env).sort(), ["APX_ROUTINE_MAIL_TOKEN", "APX_ROUTINE_MAIL_URL"]);
  const token = f.ticket.env.APX_ROUTINE_MAIL_TOKEN;
  await assert.rejects(f.mail.send(token, { ...content, day: "2000-01-01" }), /local start date/);
  assert.deepEqual(await f.mail.send(token, content), { state: "sent", duplicate: false });
  assert.deepEqual(sent[0]?.to, [config.to]);
  const message = sent[0]?.data.toString() ?? "";
  assert.match(message, /multipart\/alternative/);
  assert.ok(message.includes(Buffer.from(content.text).toString("base64")));
  assert.ok(message.includes(Buffer.from(content.html ?? "").toString("base64")));
  assert.doesNotMatch(message, /test-mail-password|Bcc:|Cc:/);
  assert.deepEqual(await f.mail.send(token, content), { state: "sent", duplicate: true });
  assert.equal(sent.length, 1);
  f.ticket.close();
  await assert.rejects(f.mail.send(token, content), /active post-command/);

  const restarted = createRoutineMail(f.options);
  const next = restarted.open(f.done, false, f.controller.signal);
  assert.ok(next);
  assert.deepEqual(await restarted.send(next.env.APX_ROUTINE_MAIL_TOKEN, content), { state: "sent", duplicate: true });
  assert.equal(sent.length, 1);
  next.close();
  restarted.close();
  f.mail.close();
});

test("routine mail refuses failed/skipped/non-routine runs, expired and revoked tickets", async () => {
  const f = await fixture();
  assert.equal(f.mail.open({ ...f.done, state: "failed" }, false, f.controller.signal), undefined);
  assert.equal(f.mail.open(f.done, true, f.controller.signal), undefined);
  assert.equal(f.mail.open({ ...f.done, trigger: "user" }, false, f.controller.signal), undefined);
  assert.throws(
    () => f.mail.open({ ...f.done, agent_id: "other" }, false, f.controller.signal),
    /outside its approved project/,
  );
  f.controller.abort();
  await assert.rejects(f.mail.send(f.ticket.env.APX_ROUTINE_MAIL_TOKEN, content), /active post-command/);
  const next = f.mail.open(f.done, false, new AbortController().signal);
  assert.ok(next);
  f.mail.configure(f.routine.id, null);
  await assert.rejects(f.mail.send(next.env.APX_ROUTINE_MAIL_TOKEN, content), /active post-command/);
  f.mail.close();
});

test("changing the saved post-command invalidates its mail approval", async () => {
  const f = await fixture();
  await env.client.call("routines.set", {
    id: f.routine.id,
    name: f.routine.name,
    agent: f.routine.agent_id,
    project,
    schedule: f.routine.schedule,
    prompt: f.routine.prompt,
    post_command: "echo different",
  });
  await assert.rejects(f.mail.send(f.ticket.env.APX_ROUTINE_MAIL_TOKEN, content), /no longer matches/);
  assert.throws(() => f.mail.open(f.done, false, f.controller.signal), /no longer matches/);
  f.mail.close();
});

test("concurrent delivery and an uncertain result never automatically send twice", async () => {
  const pending = Promise.withResolvers<void>();
  let calls = 0;
  const f = await fixture(async () => {
    calls++;
    await pending.promise;
    if (calls === 1) throw new SendError("uncertain", "test-mail-password");
  });
  const token = f.ticket.env.APX_ROUTINE_MAIL_TOKEN;
  const first = assert.rejects(f.mail.send(token, content), /uncertain.*do not retry/);
  await assert.rejects(f.mail.send(token, content), /may already have been sent/);
  assert.throws(() => f.mail.configure(f.routine.id, null), /delivery to finish/);
  f.ticket.close();
  assert.throws(() => f.mail.retry(f.routine.id, content.day), /post-command to finish/);
  pending.resolve();
  await first;
  const restarted = createRoutineMail(f.options);
  const next = restarted.open(f.done, false, f.controller.signal);
  assert.ok(next);
  await assert.rejects(restarted.send(next.env.APX_ROUTINE_MAIL_TOKEN, content), /may already have been sent/);
  assert.equal(calls, 1);
  next.close();
  restarted.close();
  f.ticket.close();
  assert.deepEqual(f.mail.retry(f.routine.id, content.day), { ready: true });
  const recovered = f.mail.open(f.done, false, f.controller.signal);
  assert.ok(recovered);
  assert.equal((await f.mail.send(recovered.env.APX_ROUTINE_MAIL_TOKEN, content)).state, "sent");
  recovered.close();
  assert.equal(calls, 2);
  assert.throws(() => f.mail.retry(f.routine.id, content.day), /confirmed sent/);
  f.mail.close();
});

test("definite failure is reported without credentials and permits a later owner-run attempt", async () => {
  const f = await fixture(async () => {
    throw new SendError("fatal", "test-mail-password");
  });
  const token = f.ticket.env.APX_ROUTINE_MAIL_TOKEN;
  await assert.rejects(f.mail.send(token, content), /mail was not sent; check the SMTP settings/);
  await assert.rejects(f.mail.send(token, content), /already attempted/);
  let calls = 0;
  const restarted = createRoutineMail({
    ...f.options,
    send: async () => {
      calls++;
    },
  });
  const next = restarted.open(f.done, false, f.controller.signal);
  assert.ok(next);
  assert.equal((await restarted.send(next.env.APX_ROUTINE_MAIL_TOKEN, content)).state, "sent");
  assert.equal(calls, 1);
  restarted.close();
  f.mail.close();
});

test("plaintext secret storage fails closed, and setup and arbitrary recipients stay owner-only", async () => {
  const f = await fixture();
  const plain = createRoutineMail({ ...f.options, secrets: env.core.secrets });
  const ticket = plain.open(f.done, false, f.controller.signal);
  assert.ok(ticket);
  await assert.rejects(plain.send(ticket.env.APX_ROUTINE_MAIL_TOKEN, content), /encrypted secret storage/);
  const agent = new ApxClient({ url: env.core.url, actor: "agent" });
  await assert.rejects(agent.call("routines.mail_set", { routine: f.routine.id, config }), /reserved to the owner/);
  await assert.rejects(
    agent.call("routines.mail_retry", { routine: f.routine.id, day: content.day }),
    /reserved to the owner/,
  );
  await env.client.call("routines.mail_set", { routine: f.routine.id, config });
  const status = await env.client.call("routines.mail_get", { routine: f.routine.id });
  assert.equal(status.storage, "file");
  assert.equal(status.credential_set, true);
  assert.equal(status.config?.secret, config.secret);
  const response = await fetch(`${env.core.url}/rpc/routines.mail_send`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "invalid-ticket" },
    body: JSON.stringify({ ...content, token: "0".repeat(64), to: "other@example.com" }),
  });
  assert.equal(response.status, 400);
  const denied = await fetch(`${env.core.url}/rpc/routines.mail_send`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": "invalid-ticket" },
    body: JSON.stringify({ ...content, token: "0".repeat(64) }),
  });
  assert.equal(denied.status, 401);
  assert.equal(RoutineMailConfig.safeParse({ ...config, to: "a@example.com,b@example.com" }).success, false);
  assert.equal(RoutineMailConfig.safeParse({ ...config, secret: "secret://MAIL.SMTP" }).success, true);
  assert.equal(RoutineMailConfig.safeParse({ ...config, smtp: { ...config.smtp, tls: "none" } }).success, false);
  assert.equal(RoutineMailConfig.safeParse({ ...config, secret: "plaintext" }).success, false);
  plain.close();
  f.mail.close();
});

test("the real post process receives only a temporary capability, redacts it, and revokes it on exit", async () => {
  const f = await fixture();
  const command = "node -e \"process.stdout.write((process.env.APX_ROUTINE_MAIL_TOKEN || 'none').repeat(300))\"";
  const routine = await env.client.call("routines.set", {
    id: f.routine.id,
    name: f.routine.name,
    agent: f.routine.agent_id,
    project,
    schedule: f.routine.schedule,
    prompt: f.routine.prompt,
    post_command: command,
  });
  f.mail.configure(routine.id, config);
  let token = "";
  const mail = {
    ...f.mail,
    open(...args: Parameters<typeof f.mail.open>) {
      const ticket = f.mail.open(...args);
      token = ticket?.env.APX_ROUTINE_MAIL_TOKEN ?? "";
      return ticket;
    },
  };
  const message = env.core.store.messages.add({
    thread_id: f.done.thread_id,
    author: { kind: "agent", id: "roby" },
    run_id: f.done.id,
    parts: [],
  });
  const display = openDisplay(env.core.store, message);
  const pipe = routinePipeline({
    store: env.core.store,
    home: env.home,
    routine,
    run: f.done,
    display,
    routineMail: mail,
  });
  await pipe.after(f.done, false);
  assert.match(token, /^[a-f0-9]{64}$/);
  const notice = display.message.parts.find((p) => p.type === "notice");
  assert.equal(notice?.type === "notice" ? notice.code : undefined, "routine.post.ok");
  assert.equal(notice?.type === "notice" ? notice.detail : undefined, "[redacted]".repeat(300));
  assert.ok(!JSON.stringify(display.message).includes(token));
  await assert.rejects(f.mail.send(token, content), /active post-command/);
  f.mail.close();
});

test("a scheduled run's real post process delivers over the restricted HTTP method, without owner credentials", async () => {
  const dir = tempDir("apx-routine-mail-");
  const secrets = createSecrets(path.join(dir.path, "secrets"), "dpapi", {}, (_cmd, _args, opts) => opts?.input ?? "");
  const delivered: string[][] = [];
  const isolated = await startCore({
    home: path.join(dir.path, "core"),
    secrets,
    routineMailSend: async (_smtp, auth, mail) => {
      assert.equal(auth.pass, "test-credential");
      delivered.push(mail.to);
    },
    llm: scriptedLlm(() => say("Digest complete")),
  });
  try {
    const repo = path.join(dir.path, "project");
    fs.mkdirSync(repo);
    fs.writeFileSync(path.join(repo, "AGENTS.md"), "# Acme\n");
    const project = (await isolated.client.call("projects.register", { path: repo })).project.id;
    fs.writeFileSync(
      path.join(repo, "post.mjs"),
      `
const url = process.env.APX_ROUTINE_MAIL_URL;
const headers = { "content-type": "application/json", "x-apx-actor": "agent", "idempotency-key": crypto.randomUUID() };
const owner = await fetch(url + "/rpc/secrets.list", { method: "POST", headers, body: "{}" });
if (owner.status !== 401) throw new Error("owner access was not refused");
const response = await fetch(url + "/rpc/routines.mail_send", {
  method: "POST", headers,
  body: JSON.stringify({ token: process.env.APX_ROUTINE_MAIL_TOKEN, day: new Date().toLocaleDateString("en-CA"), subject: "Digest", text: "News" })
});
const result = await response.json();
if (!result.ok || result.result.state !== "sent") throw new Error("mail was not confirmed");
console.log(JSON.stringify(result.result));
`,
    );
    const routine = await isolated.client.call("routines.set", {
      name: "Digest",
      agent: "roby",
      project,
      schedule: { kind: "manual" },
      prompt: "Write a digest",
      post_command: "node post.mjs",
    });
    await isolated.client.call("secrets.set", { name: "routine-mail", value: "test-credential" });
    await isolated.client.call("routines.mail_set", { routine: routine.id, config });
    for (const duplicate of [false, true]) {
      const { thread_id } = await isolated.client.call("routines.run", { routine: routine.id });
      await isolated.settle(thread_id);
      await waitFor(async () => {
        const { runs } = await isolated.client.call("routines.runs", { routine: routine.id });
        return runs.find((r) => r.thread_id === thread_id)?.delivered !== undefined;
      }, "the post-command and delivery receipt");
      const { messages } = await isolated.client.call("threads.get", { thread: thread_id });
      const notice = messages.flatMap((m) => m.parts).find((p) => p.type === "notice" && p.code === "routine.post.ok");
      assert.equal(notice?.type === "notice" ? notice.detail : "", JSON.stringify({ state: "sent", duplicate }));
      assert.ok(!JSON.stringify(messages).includes("test-credential"));
    }
    assert.deepEqual(delivered, [[config.to]]);
    for (const headers of [{ origin: "https://outside.example" }, { "x-forwarded-for": "192.0.2.1" }]) {
      const result = await fetch(`${isolated.core.url}/rpc/routines.mail_send`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "outside", ...headers },
        body: JSON.stringify({ ...content, token: "0".repeat(64) }),
      });
      assert.equal(result.status, headers.origin ? 403 : 401);
      assert.match(await result.text(), headers.origin ? /origin .*not allowed/ : /direct local connection/);
    }
  } finally {
    await isolated.core.close();
    await isolated.cleanup();
    await dir.remove();
  }
});
