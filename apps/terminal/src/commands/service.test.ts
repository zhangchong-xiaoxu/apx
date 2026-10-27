import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { stopped, tempDir, waitFor } from "../../../core/src/testkit/platform.ts";
import { lastLines, logs, stopCore } from "./service.ts";
import {
  NODE_FLAGS,
  windowsLauncherScript,
  windowsLoginCommand,
  windowsRunCommand,
  windowsStartScript,
  windowsStopScript,
} from "./service-files.ts";
import { printed } from "./testing.ts";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "apx-logs-"));
after(() => fs.rmSync(home, { recursive: true, force: true }));

for (const mode of ["restart", "spawn-error", "fatal"] as const) {
  test(`the supervisor records its lifecycle without credentials: ${mode}`, async () => {
    await using temp = tempDir("apx-supervisor-");
    const main = path.join(temp.path, "core.cjs");
    fs.writeFileSync(
      main,
      `const fs = require("node:fs"); const f = ${JSON.stringify(path.join(temp.path, "started"))};
       if (!fs.existsSync(f)) { fs.writeFileSync(f, "1"); process.exitCode = 75; }
       else { setInterval(() => {}, 1000); }`,
    );
    const module = new URL("./service.ts", import.meta.url).href;
    const runner = `
      import { supervise } from ${JSON.stringify(module)};
      process.on("message", () => {
        ${mode === "fatal" ? 'throw new Error("private-token-must-not-be-logged");' : 'process.emit("SIGTERM");'}
      });
      await supervise(${JSON.stringify(temp.path)}, {
        node: ${JSON.stringify(mode === "spawn-error" ? path.join(temp.path, "missing-node") : process.execPath)},
        main: ${JSON.stringify(main)}, cwd: ${JSON.stringify(temp.path)}, env: {}
      });
      process.disconnect();`;
    const child = spawn(process.execPath, ["--input-type=module", "-e", runner], {
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      windowsHide: true,
    });
    child.stdout?.resume();
    child.stderr?.resume();
    const file = path.join(temp.path, "logs", "core.log");
    const entries = () =>
      fs.existsSync(file)
        ? fs
            .readFileSync(file, "utf8")
            .trim()
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line))
        : [];
    try {
      await waitFor(
        () =>
          entries().some((e) => e.msg === (mode === "spawn-error" ? "core spawn failed" : "core restart scheduled")),
        "supervisor lifecycle evidence",
      );
      if (mode === "restart")
        await waitFor(() => entries().filter((e) => e.msg === "core started").length === 2, "restarted core");
      child.send("stop");
      await stopped(child);
      const rows = entries();
      assert.ok(rows.some((e) => e.msg === "supervisor started" && e.supervisor === child.pid));
      assert.ok(rows.some((e) => e.msg === "supervisor exiting"));
      assert.ok(rows.every((e) => e.scope === "supervisor" && e.t && e.level));
      assert.ok(!fs.readFileSync(file, "utf8").includes("private-token"));
      if (mode === "fatal") {
        assert.notEqual(child.exitCode, 0);
        assert.ok(rows.some((e) => e.msg === "supervisor fatal" && e.error === "Error"));
      } else {
        assert.equal(child.exitCode, 0);
        assert.ok(rows.some((e) => e.msg === "supervisor stopping" && e.signal === "SIGTERM"));
      }
      if (mode === "restart") {
        assert.ok(rows.some((e) => e.msg === "core exited" && e.code === 75));
        assert.ok(rows.some((e) => e.msg === "core restart scheduled" && e.delay_ms === 1000));
      }
      if (mode === "spawn-error") assert.ok(rows.some((e) => e.msg === "core spawn failed" && e.code === "ENOENT"));
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await stopped(child);
      const pids = entries()
        .filter((e) => e.msg === "core started")
        .map((e) => e.core as number);
      for (const pid of pids) {
        try {
          process.kill(pid);
        } catch (error) {
          assert.equal((error as NodeJS.ErrnoException).code, "ESRCH");
        }
      }
    }
  });
}

test("lastLines reads the end of a log, across read blocks, without a trailing empty line", () => {
  const file = path.join(home, "big.log");
  const all = Array.from({ length: 5000 }, (_, i) => `{"msg":"line ${i}","pad":"${"x".repeat(40)}"}`);
  fs.writeFileSync(file, `${all.join("\n")}\n`);
  assert.deepEqual(lastLines(file, 3), all.slice(-3));
  assert.deepEqual(lastLines(file, 2000), all.slice(-2000));
  fs.writeFileSync(file, "only\n");
  assert.deepEqual(lastLines(file, 100), ["only"]);
});

test("logs prints the last lines of <home>/logs/core.log and refuses a bad -n", async () => {
  fs.mkdirSync(path.join(home, "logs"), { recursive: true });
  fs.writeFileSync(path.join(home, "logs", "core.log"), "a\nb\nc\n");
  assert.equal(await printed(() => logs(home, 2, false)), "b\nc");
  await assert.rejects(logs(home, 0, false), /-n is a number/);
});

test("stopCore ends the core, keeps its last output and closes the log, even if a grandchild holds its pipes", async () => {
  const file = path.join(home, "stop.log");
  const log = fs.createWriteStream(file, { flags: "a" });
  await once(log, "open");
  // The core ignores SIGTERM (stopCore must escalate) and leaves a grandchild holding stdout.
  const script = `
    const { spawn } = require("node:child_process");
    process.on("SIGTERM", () => {});
    const g = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: ["ignore", "inherit", "inherit"] });
    console.log("grandchild " + g.pid);
    setInterval(() => {}, 1000);`;
  const child = spawn(process.execPath, ["-e", script], { stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  const [line] = (await once(child.stdout, "data")) as [Buffer];
  const grandchild = Number(/grandchild (\d+)/.exec(String(line))?.[1]);
  try {
    const started = Date.now();
    await stopCore(child, log, 300);
    assert.ok(Date.now() - started < 5000);
    assert.notEqual(child.exitCode ?? child.signalCode, null);
    assert.ok(log.writableFinished);
    assert.match(fs.readFileSync(file, "utf8"), /grandchild \d+/);
  } finally {
    if (grandchild) {
      try {
        process.kill(grandchild);
      } catch (error) {
        // Windows may already have terminated the descendant with its parent.
        assert.equal((error as NodeJS.ErrnoException).code, "ESRCH");
      }
    }
  }
});

test("stopCore with no core running only closes the log", async () => {
  const log = fs.createWriteStream(path.join(home, "idle.log"), { flags: "a" });
  await stopCore(undefined, log);
  assert.ok(log.writableFinished);
});

test("on Windows only an exact home supervisor and its child core may be stopped", () => {
  const home = "C:\\APX's data\\v2";
  const command = windowsRunCommand({
    node: "C:\\APX\\node.exe",
    terminal: "C:\\APX\\apps\\terminal\\src\\main.ts",
    home,
    electron: false,
  });
  const script = windowsStopScript(home, command);
  assert.ok(script.includes("APX''s data"), "the exact home argument, quoted for PowerShell");
  assert.ok(script.includes("$parents -contains $_.ParentProcessId"), "only children of the selected supervisor");
  assert.ok(script.includes("$_.CommandLine -imatch"), "only complete command lines authorize a stop");
  assert.ok(!script.includes(".Contains("), "substrings never authorize a stop");
  assert.ok(!script.includes("service install"), "never the command that is running this");
  assert.match(
    script,
    /while \(\(Get-Process -Id \$ids -ErrorAction SilentlyContinue\) -and \(Get-Date\) -lt \$until\)/,
  );
});

for (const packaged of [false, true]) {
  for (const port of [undefined, "7550"]) {
    for (const feed of [undefined, "https://updates.example.com/feed"]) {
      for (const electron of [false, true]) {
        test(`Windows stop uses the registered command: packaged=${packaged}, port=${port}, feed=${Boolean(feed)}, electron=${electron}`, () => {
          const root = packaged ? "C:\\Program Files\\APX\\current" : "C:\\work\\apx";
          const node = `${root}\\${electron ? "electron.exe" : "node.exe"}`;
          const terminal = `${root}\\apps\\terminal\\src\\main.ts`;
          const home = "C:\\APX's data\\v2";
          const command = windowsRunCommand({
            node,
            terminal,
            home,
            electron,
            env: { ...(port ? { APX_PORT: port } : {}), ...(feed ? { APX_RELEASES: feed } : {}) },
          });
          const script = windowsStopScript(home, command);
          const searchedCommand = /-ceq '((?:''|[^'])*)'/.exec(script)?.[1]?.replaceAll("''", "'");
          assert.equal(searchedCommand, command, "stop searches for exactly the registered line");
          const patterns = [...script.matchAll(/-imatch '((?:''|[^'])*)'/g)].map(
            (m) => new RegExp((m[1] as string).replaceAll("''", "'"), "i"),
          );
          assert.equal(patterns.length, 2);
          const supervisor = windowsRunCommand({ node, terminal, home, electron: false });
          assert.match(supervisor, patterns[0] as RegExp);
          assert.doesNotMatch(`${supervisor} --extra`, patterns[0] as RegExp);
          assert.doesNotMatch(supervisor.replace("service run", "service install"), patterns[0] as RegExp);
          assert.doesNotMatch(supervisor.replace(home, `${home}-other`), patterns[0] as RegExp);
          const core = `"${node}" ${NODE_FLAGS.join(" ")} "${root}\\apps\\core\\src\\main.ts"`;
          assert.match(core, patterns[1] as RegExp);
          assert.doesNotMatch(`${core} --extra`, patterns[1] as RegExp);
          if (packaged) assert.ok(script.includes("current"));
        });
      }
    }
  }
}

test("Windows stop ends a running supervisor and succeeds once it is gone", async () => {
  // Only Windows has the cmd.exe wrapper and WMI this checks.
  if (process.platform !== "win32") return;
  const dir = fs.mkdtempSync(path.join(home, "stop-'中文-"));
  const terminal = path.join(dir, "main.ts");
  fs.writeFileSync(terminal, "setInterval(() => {}, 1000);\n");
  const coreHome = path.join(dir, "home");
  // With env the entry is a cmd.exe wrapper, which exits by itself once its supervisor is stopped.
  const direct = windowsRunCommand({
    node: process.execPath,
    terminal,
    home: coreHome,
    electron: false,
    env: { APX_PORT: "1" },
  });
  fs.mkdirSync(coreHome, { recursive: true });
  fs.writeFileSync(path.join(coreHome, "service-start.js"), windowsLauncherScript(direct));
  const command = windowsLoginCommand(coreHome);
  const ps = (script: string) =>
    spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" });
  const running = () =>
    ps(
      `@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${dir.replaceAll("'", "''")}') -and $_.Name -ne 'powershell.exe' }).Count`,
    ).stdout.trim();
  try {
    const launch = spawnSync(
      "wscript.exe",
      ["//E:JScript", "//B", "//Nologo", path.join(coreHome, "service-start.js")],
      {
        encoding: "utf8",
      },
    );
    assert.equal(launch.status, 0, launch.stderr);
    for (const end = Date.now() + 10_000; running() !== "2" && Date.now() < end; )
      await new Promise((r) => setTimeout(r, 100));
    assert.equal(running(), "2", "cmd.exe and the supervisor are running");
    // Regression: a visible console for the cmd.exe wrapper lets a stray click kill the whole supervisor tree.
    const windowed = ps(
      `@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${dir.replaceAll("'", "''")}') }).ProcessId | ForEach-Object { (Get-Process -Id $_).MainWindowHandle }`,
    ).stdout.trim();
    assert.ok(!windowed || /^0(\s+0)*$/.test(windowed), `expected no visible window, got handles: ${windowed}`);
    const run = ps(windowsStopScript(coreHome, command));
    assert.equal(run.status, 0, run.stderr);
    assert.equal(running(), "0");
  } finally {
    ps(
      `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${dir.replaceAll("'", "''")}') -and $_.Name -ne 'powershell.exe' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    );
  }
});

test("Windows stop refuses unknown commands and entries registered for another home", () => {
  const command = windowsRunCommand({
    node: "C:\\APX\\node.exe",
    terminal: "C:\\APX\\apps\\terminal\\src\\main.ts",
    home: "C:\\data\\one",
    electron: false,
  });
  assert.throws(() => windowsStopScript("C:\\data\\two", command), /no process was stopped/);
  assert.throws(() => windowsStopScript("C:\\data\\one", "node anything"), /no process was stopped/);
});

test("Windows manual starts stay hidden and report a rejected process launch", async () => {
  if (process.platform !== "win32") return;
  await using temp = tempDir("apx-hidden-");
  const terminal = path.join(temp.path, "main.ts");
  fs.writeFileSync(terminal, "setInterval(() => {}, 1000);\n");
  const command = windowsRunCommand({
    node: process.execPath,
    terminal,
    home: temp.path,
    electron: false,
  });
  const ps = (script: string) =>
    spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" });
  const query = `@(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine.Contains('${temp.path.replaceAll("'", "''")}') })`;
  try {
    const start = ps(windowsStartScript(command));
    assert.equal(start.status, 0, start.stderr);
    await waitFor(() => ps(`${query}.Count`).stdout.trim() === "1", "hidden manual supervisor");
    assert.equal(
      ps(`${query}.ProcessId | ForEach-Object { (Get-Process -Id $_).MainWindowHandle }`).stdout.trim(),
      "0",
    );
    const stop = ps(windowsStopScript(temp.path, command));
    assert.equal(stop.status, 0, stop.stderr);
    assert.equal(ps(`${query}.Count`).stdout.trim(), "0");
    const rejected = ps(windowsStartScript(`"${path.join(temp.path, "missing.exe")}"`));
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /Windows service start failed/);
  } finally {
    ps(`${query} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`);
  }
});
