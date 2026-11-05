---
name: apx-dev-loop
description: Developing, verifying and shipping a change in this repository — scoping the task, starting from a fresh base, choosing which tests, preflight or verify step to run and when, running the long suite without wasting time, deciding whether a failing gate is yours, and the branch CI, merge, tag and update steps after it.
---

# Development and verification loop

The ladder, the pre-task checks, environment-only failures and shipping live in
[`rules/LOCAL_VERIFICATION.md`](../../../rules/LOCAL_VERIFICATION.md). That file is the single source; this skill only
routes to it.

0. Scope the task to one deliverable. A new owner-facing knob walks the footprint ladder first (AGENTS.md rule 15):
   config or an existing command before protocol, panel and CLI. A diagnosis ends with its findings; a fix it calls
   for, a merge of a stale base or a release found on the way is named and split, not folded in. Done when the task
   fits one branch and one commit series.
1. Before the first edit, do `Before you start a task` there. Done when the branch starts from a freshly fetched
   `origin/master`, the base's static failures are written down, `node --version` meets `engines`, and the worktree
   has its dependencies.
2. While editing, run only rung 0 (focused tests, the package's typecheck, biome on changed files). Done when every
   changed surface and its callers have a focused test that failed before the fix or passes for the new behavior.
3. Before committing, run rung 1 (`pnpm preflight:static`). Done when it shows no failure that the baseline did not
   already have.
4. Before pushing, run `pnpm check:commits <base>..HEAD`, then rung 2 once, in the background, and use the wait for
   the diff review. Done when every part is green or each failure is classified as product, test or environment.
5. After pushing the branch, run rung 4 on it. Done when the branch run is green; a red part is fixed from its log at
   its own rung, not by rerunning the whole local suite.
6. Ship only with the owner's go-ahead, by `Shipping` there. Done when `apx status` reports the new version.
7. Report what you ran, with its result, and what you did not run as `UNVERIFIED` (AGENTS.md, Workflow).
