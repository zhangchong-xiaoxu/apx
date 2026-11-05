# Local verification loop

How to verify a change while developing it without paying for the whole suite on every edit. This file is about
*which* check runs *when*; the commands themselves, and what each gate proves, are in [`TESTING.md`](TESTING.md).
CI stays the authority: [D-145](DECISIONS.md#d-145) split its runs into parts, it did not reduce them, and so does this loop.

## Where the time goes

A full `pnpm preflight` is dominated by one step. On a 12-thread Windows desktop the static checks and the typecheck
took about half a minute together, and `pnpm -r --if-present test` took 15 to 21 minutes (the core's test files run one
at a time, `--test-concurrency=1`). Anything that reruns that step without need is where a session loses its time.
`node_modules/.cache/apx-verify/history.json` keeps the last passing duration of every preflight step: read it before
guessing.

## The ladder

Run the cheapest rung that can catch the mistake you just made; climb only when it passes.

| Rung | When | Command | Cost |
|---|---|---|---|
| 0. Focused | After each edit | `pnpm --filter <pkg> exec node --test <files>`, `pnpm --filter <pkg> typecheck`, `pnpm exec biome check <files>` | seconds |
| 1. Static | Before a commit | `pnpm preflight:static` plus the focused tests of every changed surface and of its callers ([fix regression contract](TESTING.md#fix-regression-contract)) | about a minute |
| 2. Unit, in parts | Once the code is final, before pushing or merging | `node scripts/test-shard.ts i/N` for each `i` of `N`, started at the same time (add `--rerun-failed` on Windows) | minutes, bounded by cores |
| 3. Real path | Runtime changes | The checks of [section 4 and 5a](TESTING.md#4-real-path) against a temp-home core, for the paths you changed | per spec |
| 4. CI | After the push | `pnpm verify`'s parts, on the branch: `gh workflow run verify.yml --ref <branch>` (pushes run it only on `master` and pull requests) | not local |

- Merge into `master` only after the branch run is green. On Windows, when rung 2 fails only for the environment (below)
  or takes far longer than CI, run it once and let the branch run decide; do not repeat it to approximate CI.
- Documentation-only changes stop at rung 1 plus the [documentation checks](TESTING.md#documentation-checks).
- Rung 2 is `pnpm test` minus the quality gate, dealt over processes: each part keeps the package's own flags, so a part
  is still serial inside. Parts compete for cores and for timing-sensitive waits: a file that fails only while the parts
  run together is rerun alone before it is called a regression, and `TEST_TIME_SCALE=3` stretches waits on a loaded machine.
- A full unit run happens at most twice per task: once when the code is final, once more only if that run found
  something real. A red rung is fixed and re-run at its own rung first; do not climb to rung 2 to find out what a
  focused test would have told you.

## Before you start a task

0. **Fresh base.** `git fetch origin`, then branch or create the worktree from `origin/master`, never from a local
   `master` that may be behind. An existing branch more than a handful of commits behind is brought up to date before
   the first edit: a merge of hundreds of commits at the end reopens every conflict and every verification.
1. **Baseline.** Run `pnpm preflight:static` on the clean base branch once and keep the failures it already has. A
   failure that exists on the base is reported, not fixed in this change and not used to stop it (rule 19 still bars
   weakening a gate).
2. **Toolchain.** `node --version` satisfies the `engines` range of `package.json` in the shell that will run the
   gates; a gate run under another version proves nothing and has to be repeated. `scripts/verify.ts` refuses to start
   `preflight` or `verify` under an older Node; the focused and static rungs do not check, so look first.
3. **Dependencies.** A fresh worktree has none: `pnpm install --frozen-lockfile`, and `npm --prefix apps/mobile ci` if
   mobile tests are in scope. A missing Jest or Playwright is found now, not after fifteen minutes.
4. **Commit metadata.** `pnpm check:commits <base>..HEAD` once the commits exist and before rung 2: a metadata failure
   found after the long run costs a history rewrite and the run again.

## While it runs

- Start anything over about two minutes in the background and keep working (reading the diff, the review, the docs).
  Do not poll it in a loop and do not stack a second long run on the same machine: other runs distort timings, and
  timing is what fails (rule 26). Look for a running `node --test` or `preflight` before starting yours.
- One long run per worktree. The `apx-verify` logs of a step are in `node_modules/.cache/apx-verify/logs/`.
- When a step fails, read that step's log; rerun that step, not the sequence.

## Failures that belong to the environment

Classify before changing code ([rule 26](../AGENTS.md#project-rules)). These are known to come from the machine, not
from the change; rerun the file alone, record it, and do not fix the product for them:

- `fetch failed` with `bad port` in a test that listens on port 0: the system gave out a port that `fetch` refuses
  (6566, 6665–6669, 10080…). It happens only when the TCP dynamic port range starts below them; on Windows
  `netsh int ipv4 show dynamicport tcp` shows it (the default starts at 49152).
- A Jest or Playwright run that finds no tests under a dotted path such as `.worktrees/`: a pattern that does not
  match dot folders, a test-config fix, not a product one.

## Shipping

Pushing, merging, tagging and deploying each need the owner's go-ahead. Once given: fast-forward `master` to the branch
whose run is green, `pnpm release:check origin/master --wait`, then `pnpm release:check --tag v2.x.y origin/master`
([RELEASE.md](RELEASE.md#tagging-a-release)). A desktop install updates from the app (Settings > About, restart to
update); `apx upgrade` applies only to source and server installs. Confirm with `apx status` that the core reports the
new version.

## Not here

- Raising or removing `--test-concurrency=1` in a package script: it is a CI timing decision, and a fork change to a
  shared script is a merge conflict at every sync ([FORK_SYNC.md](FORK_SYNC.md)). Parallelism comes from the parts.
- Reading test files to decide what to run (rule 13). Choose by the files you changed and their callers.
- Anything that depends on one machine: antivirus exclusions, which Node is installed where, cache folders. That is the
  owner's environment, not the repository's.
