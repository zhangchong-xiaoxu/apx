import { type AgentBudget, TURN_STEPS } from "@apx/protocol";
import { Input } from "@apx/ui";
import { useEffect, useRef, useState } from "react";
import { client } from "../../data/client.ts";
import { useT } from "../../i18n/index.ts";

type Key = keyof AgentBudget;
/** Tokens are typed in thousands, as in Settings › Agents. */
const SCALE: Record<Key, number> = { runs: 1, tokens: 1000, steps: 1 };
const MAX: Record<Key, number> = { runs: 10_000, tokens: 1_000_000, steps: TURN_STEPS };

/**
 * One agent's limits: turns and tokens without the owner, and model calls per run. Empty fields: none of its own.
 */
export function AgentBudgetField({ agentId }: { agentId: string }) {
  const t = useT();
  const [budget, setBudget] = useState<AgentBudget>();
  const [draft, setDraft] = useState<Partial<Record<Key, string>>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    let live = true;
    void client
      .call("agents.limits", {})
      .then((r) => {
        if (live) {
          setBudget(r.agents[agentId] ?? {});
          setError("");
        }
      })
      .catch((failure) => {
        if (live) {
          setBudget(undefined);
          setError(failure instanceof Error ? failure.message : String(failure));
        }
      });
    return () => {
      live = false;
    };
  }, [agentId]);
  if (!budget) return error ? <span role="alert">{error}</span> : null;
  const field = (key: Key) => {
    const own = budget[key];
    const shown = draft[key] ?? (own ? String(Math.round(own / SCALE[key])) : "");
    const commit = (badInput: boolean) => {
      const typed = draft[key];
      if (pending.current) return;
      const number = Number(typed);
      if (
        key === "steps" &&
        (badInput || (typed?.trim() && (!Number.isInteger(number) || number < 0 || number > MAX.steps)))
      ) {
        setError(t("team.budget.stepsInvalid", { max: MAX.steps }));
        return;
      }
      if (typed === undefined) return;
      pending.current = true;
      setSaving(true);
      setDraft((d) => ({ ...d, [key]: undefined }));
      const n = Math.round(number || 0);
      const value = n > 0 ? Math.min(MAX[key], n) * SCALE[key] : 0;
      const next = { ...budget, [key]: value };
      setBudget(next);
      setError("");
      void client
        .call("agents.set_agent_limits", {
          agent: agentId,
          limits: { [key]: value },
          merge: true,
        })
        .then((r) => setBudget(r.agents[agentId] ?? {}))
        .catch((failure) => {
          setBudget(budget);
          setError(failure instanceof Error ? failure.message : String(failure));
        })
        .finally(() => {
          pending.current = false;
          setSaving(false);
        });
    };
    return (
      <span className="tgquiet__word teambudget__field">
        <Input
          aria-label={t(`team.budget.${key}`)}
          type="number"
          min={0}
          max={MAX[key]}
          disabled={saving}
          className="nudge__num"
          placeholder={t("limits.none")}
          value={shown}
          onChange={(e) => {
            const typed = e.currentTarget.value;
            setDraft((d) => ({ ...d, [key]: typed }));
          }}
          onBlur={(e) => commit(e.currentTarget.validity.badInput)}
          onKeyDown={(e) => e.key === "Enter" && commit(e.currentTarget.validity.badInput)}
        />
        {t(`team.budget.${key}Unit`)}
      </span>
    );
  };
  return (
    <div className="teambudget" title={t("team.budget.hint")} aria-busy={saving}>
      {field("runs")}
      {field("tokens")}
      {field("steps")}
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
