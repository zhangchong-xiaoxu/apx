# Context management and compaction

Status: **proposal** (the "Current mechanism" section describes shipped behavior; "Proposal" is not implemented).
Scope: threads run by the `native` harness. Claude Code and Codex keep and compact their own transcript
([D-013](DECISIONS.md#d-013)).

## Current mechanism

One builder (`apps/core/src/engine/context.ts`) assembles three pieces per turn:

| Piece | Rule |
|---|---|
| system | Byte-stable per agent and thread (no clock, no roster) so the provider's prompt cache keeps working. |
| history | Projection of the model log under a budget: walk back from the newest run, never split a run, prune old tool output, keep call/result pairs intact (`project`, `walkBack`, `repair`). |
| input | What changes per turn: time, roster when it changed, `[memory]` block, origin envelope. |

Numbers (all in characters, not tokens):

| Constant | Value | Where |
|---|---|---|
| `HISTORY_BUDGET_CHARS` | 120,000 | `engine/context.ts` |
| `FULL_OUTPUT_RUNS` | 2 (older tool output over 400 chars becomes a stub) | `engine/context.ts` |
| `RESULT_CAP` | 12,000 per tool result at ingestion | `tools/result.ts` |
| `COMPACT_AT_CHARS` | 90,000 (75% of the budget) | `engine/upkeep.ts` |
| `KEEP_RUNS` / `KEEP_CHARS` | 4 runs, up to 42,000 | `engine/upkeep.ts` |
| `TRANSCRIPT_CHARS` | 100,000 read by the summarizer | `engine/upkeep.ts` |

Compaction (`engine/upkeep.ts`):

- Runs in the background after every run when `auto_compact` is on (default), or on demand through `threads.compact`.
  One compaction per thread at a time.
- Size is measured as the model sees it: tool output outside the newest two runs counts as a 160-char stub.
- The older runs go to the auxiliary model (`model_aux`, else the owner's API models; never a CLI) and come back as a
  fixed five-section summary (Goal, Facts and decisions, Done, Open, References; at most 700 words). A previous summary
  is merged in. A summary of the wrong shape is rejected and nothing is stored.
- The result is a new epoch (`upto`, `summary`, `untrusted`, `runs`, `at`). Notes shown and the roster hash are reset so
  they are offered again. The summary rides on the first kept user item; a summary of outside content stays wrapped as
  untrusted.
- Without an auxiliary model nothing is summarized: the history budget simply drops the oldest runs.

## What is missing

Compared with other open-source agents (codex, opencode, Aider, Cline, Gemini CLI, OpenHands, Goose, Roo Code; see
[Comparison](#comparison)):

1. **No window awareness.** The budget is a constant. `contextWindow()` (`providers/windows.ts`) and `catalogWindow()`
   (`models/catalog.ts`) already know the window, but only the usage display and a local-server truncation warning use
   them. A 32k local model can overflow; a 1M model compacts far too early.
2. **No reactive recovery.** A provider rejection for context length ends the run. Within one run, the only guard
   against overflow is the 12k-char result cap. A per-agent `steps` limit bounds model calls, including retries, but
   does not cap tokens or prevent a single call from overflowing the context window.
3. **Pruned tool output is gone from the view.** The stub says "call it again", which does not recover a web page that
   changed or a command with side effects.

Strengths to keep: fixed-shape summary with validation, untrusted marking that survives compaction, run-level
boundaries that never split a call from its result, background compaction, and a measure that matches what the model
sees.

## Proposal

### P1. Budget from the model window

- `historyBudget(window)`: `clamp(window × share × CHARS_PER_TOKEN, MIN, MAX)`, with `share` about 0.35 so the rest is
  left for system prompt, tool definitions, the turn input and the answer. `CHARS_PER_TOKEN` is a conservative constant
  (3 for mixed text, because over-estimating the window is the unsafe direction).
- Unknown window keeps today's 120,000.
- `COMPACT_AT` and `KEEP_CHARS` stay the same fractions of the budget (0.75 and 0.35), so the shape does not change.
- Budget is still chars: the model log is stored and measured as JSON text, and provider token counts only exist after
  the call. A later step may calibrate chars per token from the last run's `usage` (the data is already collected).

### P2. Reactive recovery

- Classify a provider rejection for context length as its own error kind in `providers/llm.ts` (per provider, tested
  against recorded error bodies).
- On that error, once per run: force-compact (`compact(thread, true)`), rebuild the context, retry the call. If the
  auxiliary model is missing or compaction fails, retry with the budget halved. A second overflow ends the run with a
  clear owner-facing message.
- The retry must not duplicate side effects: it only re-issues the model call, never a tool call (rule 8, rule 9).

### P3. Recoverable stubs (decide later)

Save pruned output to a run-scoped artifact and put its reference in the stub instead of "call it again". Needs an
owner decision on storage and retention and a check against rule 15 (footprint ladder) and rule 11/12 (size and binary
handling). Not part of P1/P2.

### Decisions needed

- Which model's window applies when the router chain can pick different models per turn? Candidate: the smallest window
  in the agent's chain; fallback to the last run's model.
- `share` and `MIN`/`MAX` values, and whether the owner can override them (a setting, not a constant).
- Whether P2 needs the retry to be visible in the run's steps.

## Verification plan (rule 24, rule 26)

- Unit: budget function over known, unknown and tiny windows; boundaries of `planCompaction` under a scaled budget.
- Unit: overflow classification against recorded provider error bodies.
- Integration: a fake provider that rejects the first call with a context-length error; assert one forced compaction,
  one retry, the run ends `completed`, and a second rejection ends the run with the message.
- Timing-dependent parts use injected timers, never real time (rule 26).
- Runtime proof: confirm `code_sha` with `apx status`, then drive a long thread on a small-window model.

## Comparison

From each project's current main branch (source and docs); items the research could not confirm are marked UNVERIFIED.

| Agent | Trigger | Kept verbatim | Summarizer and format | Tool output | Overflow fallback |
|---|---|---|---|---|---|
| APX | Chars: over 90k of 120k, after each run | Newest 4 runs, up to 42k | Auxiliary model; fixed 5 sections; validated | 12k cap; older output stubbed | None |
| codex | Tokens: 90% of window, every turn | Fresh system prompt and AGENTS.md; user messages capped at 20k tokens for the compactor | Same model; free-form checkpoint; optional server-side compaction | Cap UNVERIFIED | None found |
| opencode | Tokens: window minus max(15%, 16k); also reactive | 15k tokens | Optional dedicated agent; fixed template | 2,000 lines or 50 KiB, rest saved to a file | Retries at 85/70/50/35% |
| Aider | Tokens: `max_chat_history_tokens` (1k to 8k) | About half the budget, tail | Weak model first; free-form | No cap found | None, error shown |
| Cline | 90% of usable input | Last 20k tokens | Same model; free-form note under 800 words | 2,000 chars at serialization | Deterministic non-LLM strategy |
| Gemini CLI | Tokens: 50% of limit | Last 30%, plus 3 newest tool turns | Same model; structured prompt | 50k-token allowance; overflow saved to a file | None, only backoff |
| OpenHands SDK | Events over 80 or tokens over limit | First 4 events; first half summarized | Condenser's LLM; fixed template | No general cap found | Hard reset with shrinking strings |
| Goose | 80% or 225k tokens | Old messages hidden, not deleted | Same model; template | Background tool-pair summaries | Compact all, retry once |
| Roo Code | 100% by default (configurable) | Since last summary all condensed | Same model; fixed prompt | 5/10/20 KB tiers, rest on disk | Sliding window drops oldest half |

Sources: codex-rs `core/src/compact.rs` and `core/src/session/turn.rs`; opencode `packages/core/src/session/compaction.ts`
and `tool-output.ts`; Aider `aider/history.py`, `aider/models.py`; Cline compaction constants; Gemini CLI chat
compression service; OpenHands software-agent-sdk condensers; Goose context strategies; Roo Code condense docs.
Repository names have changed upstream (for example opencode, goose, OpenHands); verify paths on the current repo before
relying on a line number.
