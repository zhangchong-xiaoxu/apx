// `apx agents set` and `apx agents limits`: an agent's settings as key=value, typed from the protocol's own schema, so
// a field the editor has is settable here without a list of our own to keep in step.
import { methods } from "@apx/protocol";
import type { ApxClient } from "@apx/protocol/client";

type Def = { type: string; innerType?: unknown; entries?: Record<string, string> };
const defOf = (schema: unknown): Def => (schema as { _zod: { def: Def } })._zod.def;

const UPDATE = methods["agents.update"].params;
const FIELDS = Object.keys(UPDATE.shape).filter((k) => k !== "agent");

/** The field's own kind, under optional and nullable, and whether null (back to its default) is allowed. */
function kindOf(key: string): { type: string; nullable: boolean; values?: string[] } {
  let def = defOf(UPDATE.shape[key as keyof typeof UPDATE.shape]);
  let nullable = false;
  while ((def.type === "optional" || def.type === "nullable") && def.innerType) {
    if (def.type === "nullable") nullable = true;
    def = defOf(def.innerType);
  }
  return { type: def.type, nullable, ...(def.entries ? { values: Object.values(def.entries) } : {}) };
}

/**
 * One `key=value`: a list as `a,b` (`key=` is none: back to all), true/false, an object as JSON, and `key=` back to
 * the default where the agent may have none of its own.
 */
function fieldValue(key: string, raw: string): unknown {
  if (!FIELDS.includes(key)) throw new Error(`unknown field "${key}". Fields: ${FIELDS.join(", ")}`);
  const k = kindOf(key);
  if (raw === "" && k.nullable) return null;
  if (k.type === "array")
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  if (k.type === "boolean") {
    if (/^(true|yes|on)$/i.test(raw)) return true;
    if (/^(false|no|off)$/i.test(raw)) return false;
    throw new Error(`${key} is true or false, got "${raw}"`);
  }
  if (k.type === "object") {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`${key} is JSON, for example ${key}='{"write":"ask"}'`);
    }
  }
  if (k.values && !k.values.includes(raw))
    throw new Error(`${key} is one of ${k.values.join(", ")}${k.nullable ? ", or empty for the default" : ""}`);
  return raw;
}

/** agents.update params from key=value pairs, checked against the protocol before anything is sent. */
export function agentPatch(agent: string, pairs: string[], extra: Record<string, unknown> = {}) {
  const patch: Record<string, unknown> = { agent };
  for (const p of pairs) {
    const i = p.indexOf("=");
    if (i < 1) throw new Error(`expected key=value, got "${p}"`);
    const key = p.slice(0, i);
    if (key in extra) throw new Error(`give the ${key} as ${key}=… or --${key}-file, not both`);
    patch[key] = fieldValue(key, p.slice(i + 1));
  }
  const checked = UPDATE.safeParse({ ...patch, ...extra });
  if (!checked.success)
    throw new Error(checked.error.issues.map((e) => `${e.path.join(".") || "agent"}: ${e.message}`).join("; "));
  return checked.data;
}

const LIMITS_USAGE =
  "usage: apx agents limits [<agent> runs=… tokens=… steps=… | <agent> clear | default runs=… tokens=…]";

const budget = (b: { runs?: number | undefined; tokens?: number | undefined; steps?: number | undefined }) =>
  [b.runs ? `${b.runs} turns` : "", b.tokens ? `${b.tokens} tokens` : "", b.steps ? `${b.steps} model calls/run` : ""]
    .filter(Boolean)
    .join(" · ") || "no limit";

/** runs=… tokens=… [steps=…] as numbers; 0 is no limit. */
type AgentBudgetValues = { runs?: number; tokens?: number; steps?: number };
function numbers(pairs: string[], agent: true): AgentBudgetValues;
function numbers(pairs: string[], agent?: false): { runs?: number; tokens?: number };
function numbers(pairs: string[], agent = false): AgentBudgetValues {
  const out: AgentBudgetValues = {};
  for (const p of pairs) {
    const [key, value = ""] = p.split("=");
    if (key !== "runs" && key !== "tokens" && !(agent && key === "steps")) throw new Error(LIMITS_USAGE);
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) throw new Error(`${key} is a whole number (0 is no limit), got "${value}"`);
    if (key === "runs" || key === "tokens") out[key] = n;
    else if (agent && key === "steps") out.steps = n;
  }
  return out;
}

/**
 * The default and per-agent limits on autonomous turns and the per-run model-call cap.
 */
export async function agentLimits(client: ApxClient, [target, ...pairs]: string[]) {
  if (!target) {
    const l = await client.call("agents.limits", {});
    console.log(`Default: ${budget(l)}`);
    for (const [agent, b] of Object.entries(l.agents)) console.log(`${agent}: ${budget(b)}`);
    return;
  }
  if (target === "default") {
    if (!pairs.length) throw new Error(LIMITS_USAGE);
    const now = await client.call("agents.limits", {});
    const l = await client.call("agents.set_limits", { runs: now.runs, tokens: now.tokens, ...numbers(pairs) });
    console.log(`Default: ${budget(l)}`);
    return;
  }
  if (!pairs.length) throw new Error(LIMITS_USAGE);
  const patch = pairs.length === 1 && pairs[0] === "clear" ? null : numbers(pairs, true);
  const r = await client.call("agents.set_agent_limits", {
    agent: target,
    limits: patch,
    merge: patch !== null,
  });
  const own = r.agents[target];
  console.log(`${target}: ${own ? budget(own) : "no budget of its own"}`);
}
