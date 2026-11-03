# Fork synchronization

The fork's `origin/master` is the release and runtime update source. `upstream/main` is an integration source only; do
not point the fork's update feed, installer, or release workflow at upstream.

## Before syncing

1. Confirm `upstream` points to `agentprojectcontext/apx` and its push URL is `no_push` (set it with
   `git remote set-url --push upstream no_push` if needed). Run `git fetch --no-tags origin` and
   `git fetch --no-tags upstream`, then start from a clean `origin/master` checkout on a named
   `chore/upstream-sync-YYYY-MM-DD` branch.
2. Compare the last shared base with `upstream/main`. Group changes into runtime features, protocol/database changes,
   fixes, and site or release-process changes; decide which are relevant before integrating. Inspect the verification
   run of that exact upstream commit, including failed jobs; a published update is not proof that all gates passed.
3. Pay extra attention to changes in files the fork has customized. The release source, update flow, telemetry
   defaults, Chinese translations, and fork-specific install guidance are intentional differences.

## Integrating

- Run `git merge --no-ff --no-commit upstream/main` on the sync branch. Verify before creating the merge commit so
  future syncs share ancestry. Do not rebase the fork's history onto upstream, and do not repeatedly cherry-pick
  upstream commits as a substitute for tracking the merge base.
- Resolve each overlap by keeping the fork's release and runtime boundaries while incorporating compatible upstream
  behavior. Preserve both sides when they add independent features. Do not accept upstream `main`/`staging`
  deployment settings or upstream URLs into fork-specific paths without an explicit decision.
- Keep fork-only changes small, in separate commits, and close to their source-specific seam. Avoid broad refactors,
  formatting churn, and unnecessary edits to files that change frequently upstream. If a local change must touch a
  shared file, keep it isolated and record why.
- Keep fork branding and deployment content separate from upstream product documentation. A full history merge does
  not require replacing fork-specific pages with upstream marketing or publishing workflows.

## Verifying

1. Check for conflict markers and review the complete merge diff, especially protocol methods, migrations, update
   sources, installer URLs, telemetry, release workflows, and translations. Confirm the fork-owned guidance survived:
   rule 31 and the "Syncing the fork" row in `AGENTS.md`, D-184 in `DECISIONS.md`, this file, and
   `.agents/skills/apx-upstream-sync/`.
2. If the lockfile changed, run `pnpm install --frozen-lockfile`. Run focused tests for each changed surface, then
   `pnpm preflight`; use `pnpm verify` when end-to-end or performance paths changed.
3. Keep the fork's release branch and CI targets on `master`. Do not push or tag an unverified sync.
4. Merge the integration branch only after checks pass. If only a subset of upstream commits was cherry-picked, keep
   the fork marked as partially integrated and do not treat that as a completed upstream sync.

## Recording a sync

- The merge commit body lists the upstream range, each conflicted area with how it was resolved, the checks run with
  their results, and any known limitation accepted by the owner.
- A pitfall that will recur on later syncs is added to [Known pitfalls](#known-pitfalls) on the same sync branch.
  The narrative of one sync (timeline, sizes, judgement calls) stays in the maintainers' private notes, not here.

## Known pitfalls

Each entry names the symptom and what to keep; remove an entry once upstream or the fork makes it impossible.

- **Update feed and installers drift to upstream.** Merged updater, desktop install and single-instance adoption
  code resolves the upstream feed again, and docs regain official installer links or deployment defaults. Keep the
  `master` feed end to end and drop upstream deployment defaults.
- **Chinese translations disappear.** Taking upstream's side of an i18n file drops fork-only keys. Merge key by key
  and keep the Chinese entries.
- **The first screen picks up schema code.** A merged import can pull zod into the first load (rule 27). Run
  `pnpm perf` and move the import behind `apps/web/src/lazy.ts`.
- **Windows-only failures.** E2E fixtures, native process sampling and performance budgets have failed only on
  Windows after a sync. Classify each as product or test before changing it ([TESTING.md](TESTING.md#portable-tests));
  a budget miss accepted by the owner is recorded in the commit body, and that commit is not tagged.
- **CI prerequisites move.** Upstream workflow changes can drop a step the fork's jobs need (the documentation build
  once lost its prerequisite). Read the merged workflow diff, not only the job results.
