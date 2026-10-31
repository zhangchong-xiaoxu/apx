import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { tempDir } from "../apps/core/src/testkit/platform.ts";
import { installFakeSsh } from "../e2e/fake-ssh.ts";

test("the SSH fixture refuses a down server and recovers without losing authorization", async () => {
  await using dir = tempDir("apx-ssh-down-");
  installFakeSsh(
    dir.path,
    "#!/bin/sh\nif [ -f \"$FAKE_SSH_STATE/down\" ]; then echo 'Connection refused' >&2; exit 255; fi\nexit 0\n",
  );
  const executable = path.join(dir.path, process.platform === "win32" ? "ssh.exe" : "ssh");
  const env = { ...process.env, FAKE_SSH_STATE: dir.path };
  fs.writeFileSync(path.join(dir.path, "authorized"), "");
  fs.writeFileSync(path.join(dir.path, "down"), "");
  const down = spawnSync(executable, ["-o", "BatchMode=yes", "box", "true"], { env, encoding: "utf8" });
  assert.equal(down.status, 255);
  assert.match(down.stderr, /Connection refused/);
  fs.unlinkSync(path.join(dir.path, "down"));
  const recovered = spawnSync(executable, ["-o", "BatchMode=yes", "box", "true"], { env });
  assert.equal(recovered.status, 0);
});
