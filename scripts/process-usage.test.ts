import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { stopped } from "../apps/core/src/testkit/platform.ts";
import { processUsage } from "./process-usage.ts";

test("process sampling reports real resident memory and cumulative CPU", async () => {
  const sample = await processUsage(process.pid);
  assert.ok(Number.isFinite(sample.rss) && sample.rss > 0, `invalid RSS: ${sample.rss}`);
  assert.ok(Number.isFinite(sample.cpu) && sample.cpu >= 0, `invalid CPU: ${sample.cpu}`);
});

test("a process that has exited cannot produce a success-shaped zero sample", async () => {
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  await stopped(child);
  assert.ok(child.pid);
  await assert.rejects(processUsage(child.pid));
});

test("invalid process IDs fail before invoking a sampler", async () => {
  for (const pid of [0, -1, Number.NaN, 1.5]) await assert.rejects(processUsage(pid), RangeError);
});
