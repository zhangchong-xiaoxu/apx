import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { type Commit, scanCommits } from "./check-private-terms.ts";

test("run as a command it scans and reports on every platform, never exits silently", () => {
  const script = fileURLToPath(new URL("./check-private-terms.ts", import.meta.url));
  const run = spawnSync(process.execPath, [script, "--commits", "HEAD..HEAD"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /check:private: ok in 0 commit\(s\)/);
});

const me = "1234567+acme@users.noreply.github.com";
const commit = (c: Partial<Commit>): Commit => ({
  sha: "0123456789abcdef",
  authorEmail: me,
  committerEmail: me,
  message: "fix(web): something\n",
  ...c,
});
const terms = (c: Partial<Commit>) => scanCommits([commit(c)], [], []).map((h) => h.term);

test("a commit by a GitHub noreply address passes", () => {
  assert.deepEqual(terms({}), []);
});

test("a personal email fails as author or as committer", () => {
  assert.deepEqual(terms({ authorEmail: "someone@example.com", committerEmail: "someone@example.com" }), [
    "author-email",
  ]);
  assert.deepEqual(terms({ committerEmail: "someone@example.com" }), ["author-email"]);
});

test("a pull request merged in GitHub's web UI passes with its web-flow committer, not with a personal author", () => {
  assert.deepEqual(terms({ committerEmail: "noreply@github.com" }), []);
  assert.deepEqual(terms({ authorEmail: "someone@example.com", committerEmail: "noreply@github.com" }), [
    "author-email",
  ]);
});

test("AI-tool trailers fail", () => {
  assert.deepEqual(terms({ message: "fix: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n" }), ["ai-trailer"]);
});
