# Failure ledger

Gate failures that were not caused by the change under test: runner timing, the machine, test isolation, or a defect
in a gate itself. Each one costs a rerun and a classification; this file counts them, so a recurring one becomes a fix
instead of another rerun. Product failures are fixed in the change, not listed here. How to classify a failure:
[LOCAL_VERIFICATION.md](LOCAL_VERIFICATION.md#failures-that-belong-to-the-environment). Fork-only file
([FORK_SYNC.md](FORK_SYNC.md)); see [D-186](DECISIONS.md#d-186).

## Recording

- Whoever classifies a failure as not the change's adds a row, or a date and run to an existing row, in the same
  change or the next commit. Use the test or check name, the job, the run link or `local`, and one line of evidence.
- Classes: `timing` (a runner or loaded machine missed a wait or a budget), `environment` (the machine's setup),
  `isolation` (one test's leftover state broke another), `gate` (the check itself is wrong), `unknown`.
- A fixed row moves to [Fixed](#fixed) with the commit and is deleted 30 days later; git keeps the history.

## Thresholds

- **Second occurrence within 30 days**: stop rerunning. Open an issue or fix it in its own `fix/` or `test/` branch;
  a test that waits on real time is fixed by rule 26 (injected timers, `waitFor` budgets), never by a longer sleep.
- **A budget missed three times within 30 days on code that did not touch its path**: measure it on unchanged
  `master` on the same runner. A regression is fixed; a budget that is wrong for the runner is changed with the
  measurement in the commit body (rule 19, [D-147](DECISIONS.md#d-147) for the panel budgets).
- **`environment`**: fixed on the machine and recorded in the owner's infrastructure notes; the product does not
  work around one machine's setup.
- **`gate`**: fixed at once; a check that passes without checking is worse than a failing one.

## Open

| Check | Class | Seen | Next step |
|---|---|---|---|
| `apps/core/src/tools/browser-consent-vm.test.ts`, "VM … consent respects … before its successful result returns" (macOS unit part 2/2) | timing (suspected) | 2026-11-05 [run 42018505526](https://github.com/zhangchong-xiaoxu/apx/actions/runs/42018505526) attempt 1: failed after 6.1 s, passed on rerun. 2026-11-05 [run 42006240746](https://github.com/zhangchong-xiaoxu/apx/actions/runs/42006240746) attempt 1: the part hung right after `browser-consent-revoke.test.ts` and was cancelled; same file not confirmed. | At the second confirmed occurrence, investigate the browser consent VM tests' waits. |
| `scripts/perf.ts` `turn_p95_ms` (Linux static job) | timing | 2026-11-05 [run 42018505526](https://github.com/zhangchong-xiaoxu/apx/actions/runs/42018505526) attempt 1: 262.3 ms against a 60 ms budget on a docs and scripts change; passed on rerun. | Count further misses. |
| `pnpm check:private` on Windows | gate | 2026-11-05 local: `scripts/check-private-terms.ts` compares `import.meta.url` with `` `file://${process.argv[1]}` ``, which never match on Windows, so the scan silently does not run. CI runs it on Linux. | Fix with `fileURLToPath` and `path.resolve` as `scripts/verify.ts` does, with a test. |

## Fixed

| Check | Class | Seen | Fix |
|---|---|---|---|
| `e2e/specs/57-agent-budget.spec.ts` after `29-team-actions.spec.ts`; `59-widget-media.spec.ts` | isolation | 2026-11-05 [run 42006240746](https://github.com/zhangchong-xiaoxu/apx/actions/runs/42006240746): agent limits left behind; `/^Northwind/` matched two buttons. | `05a4eb5b1` restores budgets after each team test and clicks the exact name. |
| Mobile Jest finds no tests under `.worktrees/` on Windows | gate | 2026-11-05 local. | `1965388cb`. |
| `fetch failed: bad port` (6566) in tests listening on port 0, test process then hangs | environment | 2026-11-05 local Windows: TCP dynamic port range started at 1024. | Machine range restored to 49152–65535. |
