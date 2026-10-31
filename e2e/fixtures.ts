// The world the e2e core lives in, written into a temp folder: an APX v1 to import (a project with an agent, tasks,
// a routine, notes, a variable, a skill), a Claude Code and a Codex session to resume, and a project folder of its own.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const write = (file: string, v: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof v === "string" ? v : JSON.stringify(v, null, 2));
};
const lines = (...rows: unknown[]) => `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`;

export function fixturePath(bin: string): string {
  if (process.platform === "win32") {
    const git = (process.env.PATH ?? "")
      .split(path.delimiter)
      .map((dir) => path.join(dir, "git.exe"))
      .find((file) => fs.existsSync(file));
    if (!git) throw new Error("Git is required for the e2e sandbox");
    const system = process.env.SystemRoot;
    if (!system) throw new Error("SystemRoot is required for the Windows e2e sandbox");
    return [
      bin,
      path.dirname(git),
      path.join(system, "System32"),
      path.join(system, "System32", "WindowsPowerShell", "v1.0"),
    ].join(path.delimiter);
  }
  return [bin, "/usr/bin", "/bin"].join(path.delimiter);
}

export function writeFixtures(dir: string, opts: { embedUrl: string }) {
  const home = path.join(dir, "apx-home");
  const v1 = path.join(dir, "apx-v1");
  const claude = path.join(dir, "claude");
  const codex = path.join(dir, "codex");
  const repo = path.join(dir, "work", "acme");
  const legacy = path.join(dir, "work", "northwind");
  fs.mkdirSync(home, { recursive: true });

  // A project of its own (not in v1): the one tests register by hand.
  write(path.join(repo, "AGENTS.md"), "# Acme\n\nThe Acme storefront.\n");
  write(path.join(repo, "README.md"), "# Acme\n\nA small shop.\n");
  write(path.join(repo, "src", "index.ts"), "export const hello = () => 'hi';\n");
  // A plain folder (no AGENTS.md): added from the sidebar later.
  write(path.join(dir, "work", "globex", "notes.txt"), "Globex notes.\n");

  // APX v1, as it leaves its folder.
  write(path.join(legacy, "AGENTS.md"), "# Northwind\n");
  write(path.join(legacy, ".apc", "project.json"), { name: "Northwind", apx_id: "nw0000000001" });
  write(path.join(legacy, ".apc", "agents", "dev.md"), "---\nname: Dev\nrole: developer\n---\nYou build.\n");
  write(path.join(legacy, ".apc", "agents", "ops.md"), "---\nname: Ops\nrole: operations\n---\nYou deploy.\n");
  write(path.join(v1, "config.json"), {
    projects: [{ path: legacy }],
    memory: { embeddings: { order: ["ollama"], ollama: { model: "embeddinggemma:300m", base_url: opts.embedUrl } } },
    // The fake model under v1's "custom" engine (v2 already has it) and a local Ollama as its fallback.
    engines: {
      custom: { engine: "custom", base_url: `${opts.embedUrl}/v1`, api_key: "e2e-placeholder" },
      ollama: { base_url: opts.embedUrl, default_model: "gemma-e2e" },
    },
    super_agent: { model: "custom:fake-1", model_fallback: { enabled: true, models: ["ollama:gemma-e2e"] } },
    // An image server and a voice of the owner's own (nothing listens there: they are only brought in).
    images: { custom: { homelab: { kind: "sdcpp", label: "Homelab", base_url: "http://127.0.0.1:9" } } },
    voice: { tts: { custom: { qvox: { label: "QVox", base_url: "http://127.0.0.1:9/v1", voice: "ryan" } } } },
  });
  write(path.join(v1, "update-check.json"), { current: "1.120.0" });
  write(path.join(v1, "identity.json"), { agent_name: "Roby", owner_name: "Ana" });
  write(path.join(v1, "vars.json"), { NORTHWIND_API: "nw-e2e-value" });
  write(path.join(v1, "skills", "brief", "SKILL.md"), "---\nname: brief\ndescription: Write a brief.\n---\nHow.\n");
  write(path.join(v1, "memory.md"), "## 2026-09-01\n- [09:00][app] Ana prefers short answers\n");
  const storage = path.join(v1, "projects", "nw0000000001");
  write(path.join(storage, "memory.md"), "## 2026-09-02\n- [11:00][app] Deploys go out on Fridays\n");
  write(
    path.join(storage, "tasks", "2026-09.jsonl"),
    lines(
      { id: "t1", op: "create", ts: "2026-09-01T10:00:00Z", title: "Ship the invoice page", priority: "high" },
      { id: "t2", op: "create", ts: "2026-09-01T10:01:00Z", title: "Old chore" },
      { id: "t2", op: "done", ts: "2026-09-02T10:00:00Z" },
    ),
  );
  write(path.join(storage, "routines.json"), {
    routines: [{ name: "Morning brief", kind: "exec_agent", schedule: "0 9 * * *", spec: { prompt: "Brief me." } }],
  });

  // A Claude Code session and a Codex one the owner started outside APX.
  write(
    path.join(claude, "projects", "-work-acme", "11111111-2222-3333-4444-555555555555.jsonl"),
    lines(
      { type: "user", cwd: repo, message: { role: "user", content: "Refactor the cart module" } },
      { type: "assistant", cwd: repo, message: { role: "assistant", content: [{ type: "text", text: "Done." }] } },
    ),
  );
  write(
    path.join(codex, "sessions", "2026", "09", "30", "rollout-2026-09-30T10-00-00-cdx1.jsonl"),
    lines(
      { type: "session_meta", payload: { id: "cdx1", cwd: repo, originator: "codex_cli_rs" } },
      {
        type: "response_item",
        payload: { type: "message", role: "user", content: [{ type: "input_text", text: "Add a footer" }] },
      },
    ),
  );
  // Claude Code and Codex as this sandbox's only CLIs: installed, signed out. The machine's own are never found.
  const bin = path.join(dir, "bin");
  write(
    path.join(bin, "claude"),
    `#!/bin/sh\ncase "$1" in --version) echo "2.0.0 (Claude Code)";; auth) echo '{"loggedIn":false}';; esac\n`,
  );
  write(
    path.join(bin, "codex"),
    // `debug models`: one model that takes reasoning efforts, as the real CLI lists them.
    `#!/bin/sh\ncase "$1" in --version) echo "codex-cli 0.1.0";; login) echo "Not logged in";; debug) echo '${JSON.stringify({ models: [{ slug: "gpt-e2e", display_name: "GPT e2e", supported_reasoning_levels: [{ effort: "low" }, { effort: "high" }], default_reasoning_level: "low" }] })}';; esac\n`,
  );
  if (process.platform === "win32") {
    const source = path.join(bin, "cli.cs");
    write(
      source,
      `using System;
using System.IO;
class Cli {
  static void Main(string[] args) {
    string name = Path.GetFileNameWithoutExtension(Environment.GetCommandLineArgs()[0]);
    string command = args.Length > 0 ? args[0] : "";
    if (command == "--version") Console.WriteLine(name == "claude" ? "2.0.0 (Claude Code)" : "codex-cli 0.1.0");
    else if (command == "auth") Console.WriteLine("{\\"loggedIn\\":false}");
    else if (command == "login") Console.WriteLine("Not logged in");
    else if (command == "debug") Console.WriteLine("{\\"models\\":[{\\"slug\\":\\"gpt-e2e\\",\\"display_name\\":\\"GPT e2e\\",\\"supported_reasoning_levels\\":[{\\"effort\\":\\"low\\"},{\\"effort\\":\\"high\\"}],\\"default_reasoning_level\\":\\"low\\"}]}");
    else Environment.ExitCode = 1;
  }
}`,
    );
    const compiler = path.join(process.env.SystemRoot ?? "", "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe");
    execFileSync(compiler, ["/nologo", `/out:${path.join(bin, "claude.exe")}`, source], { timeout: 15_000 });
    fs.copyFileSync(path.join(bin, "claude.exe"), path.join(bin, "codex.exe"));
  } else {
    for (const f of ["claude", "codex"]) fs.chmodSync(path.join(bin, f), 0o755);
  }
  // node itself, without the folder it lives in (globally installed CLIs sit there too).
  fs.symlinkSync(process.execPath, path.join(bin, process.platform === "win32" ? "node.exe" : "node"));
  return { home, v1, claude, codex, repo, bin };
}
