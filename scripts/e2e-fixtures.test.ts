import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { tempDir } from "../apps/core/src/testkit/platform.ts";
import { fixturePath, writeFixtures } from "../e2e/fixtures.ts";

const run = promisify(execFile);

test("the sandbox CLI fixtures are executable and report their own signed-out status", async () => {
  await using dir = tempDir("apx-e2e-cli-");
  const fx = writeFixtures(dir.path, { embedUrl: "http://127.0.0.1:9" });
  const env = { ...process.env, PATH: fixturePath(fx.bin) };
  for (const [name, version] of [
    ["claude", "2.0.0 (Claude Code)"],
    ["codex", "codex-cli 0.1.0"],
  ]) {
    assert.ok(name && version);
    const { stdout } = await run(name, ["--version"], { env });
    assert.equal(stdout.trim(), version);
  }
  const claude = await run("claude", ["auth", "status", "--json"], { env });
  assert.deepEqual(JSON.parse(claude.stdout), { loggedIn: false });
  const codex = await run("codex", ["login", "status"], { env });
  assert.equal(codex.stdout.trim(), "Not logged in");
});

test("the isolated e2e PATH can run Git in a fixture repository", async () => {
  await using dir = tempDir("apx-e2e-path-");
  const fx = writeFixtures(dir.path, { embedUrl: "http://127.0.0.1:9" });
  const env = { ...process.env, PATH: fixturePath(fx.bin) };
  await run("git", ["init", "-q", fx.repo], { env });
  const { stdout } = await run("git", ["-C", fx.repo, "status", "--porcelain"], { env });
  assert.match(stdout, /README\.md/);
  const node = await run("node", ["-p", "JSON.stringify(process.execPath)"], { env });
  assert.equal(path.basename(JSON.parse(node.stdout)), path.basename(process.execPath));
  if (process.platform === "win32") {
    const shell = await run("powershell.exe", ["-NoProfile", "-Command", "6*7"], { env });
    assert.equal(shell.stdout.trim(), "42");
  }
});
