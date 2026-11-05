---
name: apx-dev-loop
description: Developing and verifying a change in this repository — choosing which tests, preflight or verify step to run and when, running the long suite without wasting time, or deciding whether a failing gate is yours.
---

# Development and verification loop

The ladder, the pre-task checks and the rules for long runs live in [`rules/LOCAL_VERIFICATION.md`](../../../rules/LOCAL_VERIFICATION.md).
That file is the single source; this skill only routes to it.

1. Before the first edit, do `Before you start a task` there. Done when the base's static failures are written down,
   `node --version` meets `engines`, and the worktree has its dependencies.
2. While editing, run only rung 0 (focused tests, the package's typecheck, biome on changed files). Done when every
   changed surface and its callers have a focused test that failed before the fix or passes for the new behavior.
3. Before committing, run rung 1 (`pnpm preflight:static`). Done when it shows no failure that the baseline did not
   already have.
4. Before pushing, run `pnpm check:commits <base>..HEAD`, then rung 2 once, in the background, and use the wait for
   the diff review. Done when every part is green or each failure is classified as product, test or environment.
5. Report what you ran, with its result, and what you did not run as `UNVERIFIED` (AGENTS.md, Workflow).
