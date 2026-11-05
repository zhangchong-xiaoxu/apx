import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { tempDir } from "../../../core/src/testkit/platform.ts";
import { artifactSourceDir, artifacts } from "./artifacts.ts";
import { printed, recordingClient } from "./testing.ts";

const shown = { id: "srf_1", name: "expenses", title: "Expenses", version: 3, app: true, project_id: "p_acme" };

test("artifacts push shows a built page by name, in the project asked for, titled from the page", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apx-artifacts-"));
  try {
    const file = path.join(dir, "index.html");
    fs.writeFileSync(file, "<title>Expenses</title><p>built</p>");
    const { client, calls } = recordingClient({ "surfaces.show": shown });
    const out = await printed(() =>
      artifacts(client, ["push", "expenses", file], {
        app: true,
        project: "p_acme",
        connect: "https://api.example.com, https://rates.example.com",
      }),
    );
    assert.match(out, /expenses {2}v3 {2}app {2}p_acme/);
    assert.deepEqual(calls, [
      [
        "surfaces.show",
        {
          name: "expenses",
          title: "Expenses",
          html: "<title>Expenses</title><p>built</p>",
          app: true,
          connect: ["https://api.example.com", "https://rates.example.com"],
          project: "p_acme",
        },
      ],
    ]);
    await assert.rejects(artifacts(client, ["push", "Bad Name", file], {}), /kebab-case/);
    await assert.rejects(artifacts(client, ["push", "expenses"], {}), /usage:/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("artifacts list shows each one's kind and project", async () => {
  const { client, calls } = recordingClient({
    "surfaces.list": { surfaces: [shown, { ...shown, name: "rates", app: false, project_id: undefined }] },
  });
  const out = await printed(() => artifacts(client, [], {}));
  assert.match(out, /expenses +app +v3 +p_acme {2}Expenses/);
  assert.match(out, /rates +widget +v3 +global/);
  assert.deepEqual(calls, [["surfaces.list", {}]]);
});

test("a built artifact's source lives in APX's home apart from its memory, per project", () => {
  assert.equal(artifactSourceDir("/h", "expenses"), path.join("/h", "artifact-sources", "global", "expenses"));
  assert.equal(
    artifactSourceDir("/h", "expenses", "p_acme"),
    path.join("/h", "artifact-sources", "p_acme", "expenses"),
  );
  assert.throws(() => artifactSourceDir("/h", "../up"), /kebab-case/);
  assert.throws(() => artifactSourceDir("/h", "expenses", "../x"), /not a project id/);
});

test("artifact store patches only the named project's cache and reports no values on write", async () => {
  await using dir = tempDir("apx-artifact-store-");
  const file = path.join(dir.path, "patch.json");
  const patch = { progress: { version: 1, state: "working" }, old: null };
  fs.writeFileSync(file, JSON.stringify(patch));
  const { client, calls } = recordingClient({
    "surfaces.list": { surfaces: [{ ...shown, id: "srf_other", project_id: "p_other" }, shown] },
    "surfaces.store_set": { keys: 1, bytes: 50 },
  });
  const out = await printed(() => artifacts(client, ["store", "expenses", "set", file], { project: "p_acme" }));
  assert.deepEqual(JSON.parse(out), { keys: 1, bytes: 50 });
  assert.deepEqual(calls.at(-1), ["surfaces.store_set", { surface: "srf_1", patch }]);
  fs.writeFileSync(file, "[]");
  await assert.rejects(artifacts(client, ["store", "expenses", "set", file], { project: "p_acme" }));
  fs.writeFileSync(file, "{");
  await assert.rejects(artifacts(client, ["store", "expenses", "set", file], { project: "p_acme" }));
});

test("artifact store reads selected keys without changing HTML or selecting a different scope", async () => {
  const { client, calls } = recordingClient({
    "surfaces.list": { surfaces: [shown] },
    "surfaces.store_get": { values: { progress: { state: "completed" } } },
  });
  const out = await printed(() => artifacts(client, ["store", "expenses", "get", "progress"], { project: "p_acme" }));
  assert.deepEqual(JSON.parse(out), { values: { progress: { state: "completed" } } });
  assert.deepEqual(calls.at(-1), ["surfaces.store_get", { surface: "srf_1", keys: ["progress"] }]);
  await assert.rejects(artifacts(client, ["store", "expenses", "get"], {}), /no artifact.*global/);
  await assert.rejects(artifacts(client, ["store", "expenses", "set"], {}), /usage:/);
  const failed = recordingClient({ "surfaces.list": new Error("offline") });
  await assert.rejects(artifacts(failed.client, ["store", "expenses", "get"], {}), /offline/);
});
