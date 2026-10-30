import { createHash, randomBytes } from "node:crypto";
import { RoutineMailConfig, type RoutineMailContent } from "@apx/protocol";
import { z } from "zod";
import { composeMail, smtpSend } from "../channels/email-smtp.ts";
import { SendError } from "../channels/types.ts";
import type { RunRecord } from "../domain/runs.ts";
import type { Store } from "../domain/store.ts";
import { badRequest, conflict, notFound, unauthorized, unavailable } from "../errors.ts";
import type { Log } from "../log.ts";
import type { Secrets } from "../secrets.ts";

const Binding = z.object({
  config: RoutineMailConfig,
  project: z.string(),
  agent: z.string(),
  post: z.string(),
});
const Receipt = z.object({ state: z.enum(["sending", "sent", "uncertain", "failed"]), digest: z.string() });
type Ticket = { run: string; routine: string; binding: string; signal: AbortSignal; used: boolean };
type MailOptions = {
  store: Store;
  secrets: Secrets;
  log: Log;
  url(): string;
  send?: typeof smtpSend;
};
export type RoutineMail = ReturnType<typeof createRoutineMail>;

export function createRoutineMail(o: MailOptions) {
  const { store } = o;
  const tickets = new Map<string, Ticket>();
  const sending = new Map<string, number>();
  const stopping = new AbortController();
  const key = (routine: string) => `routine_mail:${routine}`;
  const binding = (routine: string) => {
    const raw = store.settings.get(key(routine));
    if (!raw || raw === "null") return undefined;
    return { raw, value: Binding.parse(JSON.parse(raw)) };
  };
  const current = (routine: string, raw: string) => {
    const saved = binding(routine);
    const r = store.routines.get(routine);
    if (
      !saved ||
      saved.raw !== raw ||
      !r ||
      r.project_id !== saved.value.project ||
      r.agent_id !== saved.value.agent ||
      r.post_command !== saved.value.post
    )
      throw unauthorized("routine mail approval no longer matches this task");
    return saved.value;
  };
  return {
    configure(routine: string, config: RoutineMailConfig | null) {
      if (sending.has(routine)) throw conflict("wait for mail delivery to finish before changing its approval");
      const r = store.routines.get(routine);
      if (!r) throw notFound(`routine ${routine}`);
      if (config && (!r.project_id || !r.post_command))
        throw badRequest("routine mail needs a project and a saved post-command");
      store.settings.set(
        key(routine),
        JSON.stringify(config ? { config, project: r.project_id, agent: r.agent_id, post: r.post_command } : null),
      );
      for (const [token, ticket] of tickets) if (ticket.routine === routine) tickets.delete(token);
      return { configured: config !== null };
    },
    config(routine: string) {
      if (!store.routines.get(routine)) throw notFound(`routine ${routine}`);
      const saved = binding(routine)?.value;
      return {
        config: saved?.config ?? null,
        storage: o.secrets.backend,
        credential_set: saved ? o.secrets.resolveIn(saved.config.secret, saved.project) !== undefined : false,
      };
    },
    retry(routine: string, day: string) {
      if (!store.routines.get(routine)) throw notFound(`routine ${routine}`);
      if (sending.has(routine) || [...tickets.values()].some((t) => t.routine === routine && !t.signal.aborted))
        throw conflict("wait for this routine's post-command to finish before permitting another attempt");
      const receiptKey = `routine_mail_receipt:${routine}:${day}`;
      const raw = store.settings.get(receiptKey);
      if (!raw) throw notFound("mail delivery receipt");
      const receipt = Receipt.parse(JSON.parse(raw));
      if (receipt.state === "sent") throw conflict("mail was confirmed sent; another copy is not allowed");
      store.settings.set(receiptKey, JSON.stringify({ ...receipt, state: "failed" }));
      return { ready: true as const };
    },
    open(run: RunRecord, skipped: boolean, signal: AbortSignal) {
      const origin = run.input?.origin;
      if (run.trigger !== "routine" || origin?.kind !== "routine" || run.state !== "completed" || skipped)
        return undefined;
      const saved = binding(origin.id);
      if (!saved) return undefined;
      const b = current(origin.id, saved.raw);
      const thread = store.threads.get(run.thread_id);
      if (run.agent_id !== b.agent || thread?.project_id !== b.project)
        throw unauthorized("routine mail run is outside its approved project");
      const token = randomBytes(32).toString("hex");
      const active = AbortSignal.any([signal, stopping.signal]);
      tickets.set(token, { run: run.id, routine: origin.id, binding: saved.raw, signal: active, used: false });
      return {
        env: { APX_ROUTINE_MAIL_TOKEN: token, APX_ROUTINE_MAIL_URL: o.url() },
        close: () => tickets.delete(token),
      };
    },
    async send(token: string, content: RoutineMailContent) {
      const ticket = tickets.get(token);
      if (!ticket || ticket.signal.aborted) throw unauthorized("routine mail is not in its active post-command");
      const b = current(ticket.routine, ticket.binding);
      const run = store.runs.get(ticket.run);
      if (run?.state !== "completed") throw unauthorized("routine mail needs a successful run");
      const day = new Date(run.started_at).toLocaleDateString("en-CA");
      if (content.day !== day) throw badRequest("routine mail day must match the run's local start date");
      sending.set(ticket.routine, (sending.get(ticket.routine) ?? 0) + 1);
      try {
        return await deliver(o, ticket, b, content);
      } finally {
        const remaining = (sending.get(ticket.routine) ?? 1) - 1;
        if (remaining) sending.set(ticket.routine, remaining);
        else sending.delete(ticket.routine);
      }
    },
    close() {
      stopping.abort();
      tickets.clear();
    },
  };
}

async function deliver(o: MailOptions, ticket: Ticket, b: z.infer<typeof Binding>, content: RoutineMailContent) {
  const receiptKey = `routine_mail_receipt:${ticket.routine}:${content.day}`;
  const raw = o.store.settings.get(receiptKey);
  const receipt = raw ? Receipt.parse(JSON.parse(raw)) : undefined;
  if (receipt?.state === "sent") return { state: "sent" as const, duplicate: true };
  if (receipt && (receipt.state === "sending" || receipt.state === "uncertain"))
    throw conflict("mail may already have been sent; check the recipient before another attempt");
  if (ticket.used) throw conflict("this post-command already attempted mail delivery");
  if (o.secrets.backend === "file") throw unavailable("routine mail requires encrypted secret storage");
  const password = o.secrets.resolveIn(b.config.secret, b.project);
  if (!password) throw unavailable("routine mail credential is not configured in APX");
  ticket.used = true;
  const digest = createHash("sha256").update(JSON.stringify(content)).digest("hex");
  const save = (state: z.infer<typeof Receipt>["state"]) =>
    o.store.settings.set(receiptKey, JSON.stringify({ state, digest }));
  const mail = composeMail({
    from: { address: b.config.from },
    to: b.config.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
    autoSubmitted: "auto-generated",
  });
  save("sending");
  try {
    await (o.send ?? smtpSend)(
      b.config.smtp,
      { user: b.config.from, pass: password },
      { from: b.config.from, to: [b.config.to], data: mail.data },
      ticket.signal,
    );
  } catch (err) {
    const state = err instanceof SendError && err.kind !== "uncertain" ? "failed" : "uncertain";
    save(state);
    o.log.warn({ run: ticket.run, state }, "routine mail delivery failed");
    throw conflict(
      state === "uncertain"
        ? "mail delivery is uncertain; check the recipient and do not retry automatically"
        : "mail was not sent; check the SMTP settings and credential in APX",
    );
  }
  save("sent");
  return { state: "sent" as const, duplicate: false };
}
