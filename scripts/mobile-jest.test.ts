import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { scaled, tempDir } from "../apps/core/src/testkit/platform.ts";

const require = createRequire(import.meta.url);
const { testMatch }: { testMatch: string[] } = require("../apps/mobile/jest.config.cjs");
const mobileRoot = path.resolve(import.meta.dirname, "../apps/mobile").replaceAll("\\", "/");
const jest = require.resolve("../apps/mobile/node_modules/jest/bin/jest.js");

test("mobile Jest discovers only UI tests from a dotted worktree path", async () => {
  await using dir = tempDir("apx-mobile-jest-");
  const root = path.join(dir.path, ".worktrees", "sample", "apps", "mobile");
  fs.mkdirSync(path.join(root, "test", "nested"), { recursive: true });
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "test", "screen.test.tsx"), "export {};");
  fs.writeFileSync(path.join(root, "test", "nested", "hook.test.tsx"), "export {};");
  fs.writeFileSync(path.join(root, "test", "ignored.test.ts"), "export {};");
  fs.writeFileSync(path.join(root, "src", "outside.test.tsx"), "export {};");

  const patterns = testMatch.map((glob) => glob.replace(mobileRoot, root.replaceAll("\\", "/")));
  const config = JSON.stringify({ rootDir: root, testMatch: patterns, cache: false });
  const output = execFileSync(process.execPath, [jest, "--listTests", "--runInBand", "--config", config], {
    encoding: "utf8",
    timeout: scaled(30_000),
  });
  const names = output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((file) => path.basename(file))
    .sort();
  assert.deepEqual(names, ["hook.test.tsx", "screen.test.tsx"]);
});
