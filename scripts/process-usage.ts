import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** Resident memory in MB and cumulative CPU seconds for a live process. */
export async function processUsage(pid: number): Promise<{ rss: number; cpu: number }> {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new RangeError("Sampling requires a positive process ID");
  let sample: { rss: number; cpu: number };
  if (process.platform === "win32") {
    const root = process.env.SystemRoot;
    if (!root) throw new Error("SystemRoot is required for Windows process sampling");
    const { stdout } = await exec(
      path.join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `$p = Get-Process -Id ${pid} -ErrorAction Stop; Write-Output "$($p.WorkingSet64) $($p.TotalProcessorTime.Ticks)"`,
      ],
      { windowsHide: true, timeout: 15_000 },
    );
    if (!/^\d+\s+\d+$/.test(stdout.trim())) throw new Error(`Invalid Windows process sample for ${pid}`);
    const [bytes, ticks] = stdout.trim().split(/\s+/).map(Number);
    sample = { rss: Number(bytes) / 1024 ** 2, cpu: Number(ticks) / 10_000_000 };
  } else {
    const { stdout } = await exec("ps", ["-o", "rss=,time=", "-p", String(pid)], { timeout: 15_000 });
    if (!/^\d+\s+(?:\d+-)?\d+(?::\d+){1,2}(?:\.\d+)?$/.test(stdout.trim()))
      throw new Error(`Invalid ps sample for ${pid}`);
    const [rss, time = ""] = stdout.trim().split(/\s+/);
    const [first = "", second] = time.split("-");
    const days = second === undefined ? 0 : Number(first);
    const cpu = (second ?? first)
      .split(":")
      .map(Number)
      .reduce((acc, n) => acc * 60 + n, 0);
    sample = { rss: Number(rss) / 1024, cpu: days * 86_400 + cpu };
  }
  if (!Number.isFinite(sample.rss) || sample.rss <= 0 || !Number.isFinite(sample.cpu) || sample.cpu < 0)
    throw new Error(`Invalid process sample for ${pid}`);
  return sample;
}
