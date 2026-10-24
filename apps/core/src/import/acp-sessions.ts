// The owner's own sessions of an ACP agent that can list them (GitHub Copilot CLI): asked of the agent itself over
// ACP (session/list, session/load), not read from its files, whose format is the agent's to change.
import { spawn } from "node:child_process";
import type { AcpAgent } from "../harness/acp/agents.ts";
import { connect, type Rpc } from "../harness/acp/rpc.ts";
import { childEnv } from "../harness/env.ts";
import { stopTree } from "../processes.ts";
import type { NativeTurn } from "./native-sessions.ts";

export type AcpListed = { id: string; title: string; cwd: string; updated_at: string };

type Caps = { loadSession?: boolean; sessionCapabilities?: { list?: object; close?: object } };

const INIT_MS = 30_000;
const LIST_MS = 30_000;
const LOAD_MS = 60_000;
const MAX_PAGES = 20;

async function withAgent<T>(
  agent: AcpAgent,
  binary: string,
  cwd: string,
  onUpdate: (update: Record<string, unknown>) => void,
  work: (rpc: Rpc, caps: Caps) => Promise<T>,
): Promise<T> {
  const child = spawn(binary, agent.args, {
    cwd,
    env: { ...childEnv(), ...agent.env },
    stdio: ["pipe", "pipe", "pipe"],
    detached: process.platform !== "win32",
    windowsHide: true,
  });
  child.stderr.resume();
  const rpc = connect(child, {
    request: async () => {
      throw new Error("reading sessions asks nothing of the owner");
    },
    notification: (method, params) => {
      const update = (params as { update?: unknown } | undefined)?.update;
      if (method === "session/update" && update && typeof update === "object")
        onUpdate(update as Record<string, unknown>);
    },
  });
  const alive = () => child.exitCode === null && child.signalCode === null;
  try {
    const init = await rpc.request<{ agentCapabilities?: Caps }>(
      "initialize",
      {
        protocolVersion: 1,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      },
      INIT_MS,
    );
    return await work(rpc, init.agentCapabilities ?? {});
  } finally {
    // Its input closed, an ACP agent ends on its own; the tree is stopped in case it does not.
    child.stdin.end();
    if (alive() && child.pid) stopTree(child.pid, { alive });
  }
}

/** Every session the agent lists, newest first; none when it cannot list them. */
export function acpSessions(agent: AcpAgent, binary: string, cwd: string): Promise<AcpListed[]> {
  return withAgent(
    agent,
    binary,
    cwd,
    () => {},
    async (rpc, caps) => {
      if (!caps.sessionCapabilities?.list) return [];
      const out: AcpListed[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const r = await rpc.request<{
          sessions?: Array<{ sessionId?: string; cwd?: string; title?: string | null; updatedAt?: string | null }>;
          nextCursor?: string | null;
        }>("session/list", cursor ? { cursor } : {}, LIST_MS);
        for (const s of r.sessions ?? [])
          if (s.sessionId && s.cwd)
            out.push({ id: s.sessionId, title: s.title ?? "", cwd: s.cwd, updated_at: s.updatedAt ?? "" });
        cursor = r.nextCursor ?? undefined;
        if (!cursor) break;
      }
      return out.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },
  );
}

/** What was said in a session, from the history the agent replays when it loads it (text only). */
export function acpTranscript(agent: AcpAgent, binary: string, s: AcpListed, max: number): Promise<NativeTurn[]> {
  const turns: NativeTurn[] = [];
  const onUpdate = (u: Record<string, unknown>) => {
    const role =
      u.sessionUpdate === "user_message_chunk" ? "user" : u.sessionUpdate === "agent_message_chunk" ? "assistant" : "";
    const c = u.content as { type?: string; text?: string } | undefined;
    if (!role || c?.type !== "text" || !c.text) return;
    const last = turns.at(-1);
    if (last?.role === role) last.text += c.text;
    else turns.push({ role, text: c.text });
  };
  return withAgent(agent, binary, s.cwd, onUpdate, async (rpc, caps) => {
    if (!caps.loadSession) return [];
    await rpc.request("session/load", { sessionId: s.id, cwd: s.cwd, mcpServers: [] }, LOAD_MS);
    if (caps.sessionCapabilities?.close)
      await rpc.request("session/close", { sessionId: s.id }, LIST_MS).catch(() => undefined);
    return turns
      .map((t) => ({ ...t, text: t.text.trim() }))
      .filter((t) => t.text)
      .slice(-max);
  });
}
