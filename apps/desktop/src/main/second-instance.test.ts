import assert from "node:assert/strict";
import { test } from "node:test";
import { RELEASE_FEED } from "@apx/protocol";
import { adoptionData, secondInstance } from "./second-instance.ts";

test("a tray-hidden primary adopts off and custom feeds even when its connection is unchanged", () => {
  for (const feed of ["off", "acme/apx", "https://updates.example/releases"]) {
    const env: NodeJS.ProcessEnv = { APX_RELEASES: "northwind/apx", APX_URL: "http://localhost:7440" };
    const relaunched: NodeJS.ProcessEnv[] = [];
    let focused = 0;
    const handle = secondInstance({
      env,
      openedConnection: "local",
      connection: () => "local",
      relaunch: () => {
        relaunched.push({ ...env });
      },
      openFiles: () => assert.fail("adoption must relaunch before opening files"),
      focus: () => focused++,
    });
    const argv = ["APX.exe", "--apx-adopt-local"];
    handle({}, argv, "", adoptionData(argv, { APX_RELEASES: feed }));
    assert.equal(relaunched.length, 1);
    assert.equal(relaunched[0]?.APX_RELEASES, feed);
    assert.equal(relaunched[0]?.APX_URL, "http://localhost:7440");
    assert.equal(focused, 0);
    handle({}, argv, "", adoptionData(argv, { APX_RELEASES: feed }));
    assert.equal(relaunched.length, 1, "duplicate native events do not schedule multiple relaunches");
  }
});

test("ordinary launches and invalid handoffs cannot change the primary environment", () => {
  for (const data of [
    undefined,
    null,
    {},
    { releaseFeed: 1 },
    { releaseFeed: "" },
    { releaseFeed: "x".repeat(4097) },
    { releaseFeed: "off\n" },
    { releaseFeed: "https://updates.example/\u0000" },
    { releaseFeed: "file:///etc/hosts" },
    { releaseFeed: "--inspect" },
    { APX_RELEASES: "off", APX_TOKEN: "test" },
  ]) {
    const env = { APX_RELEASES: "acme/apx" };
    const opened: string[][] = [];
    let focused = 0;
    secondInstance({
      env,
      openedConnection: "local",
      connection: () => "local",
      relaunch: () => assert.fail("invalid feed cannot relaunch"),
      openFiles: (argv) => {
        opened.push(argv);
      },
      focus: () => focused++,
    })({}, ["APX.exe", "--apx-adopt-local"], "", data);
    assert.deepEqual(env, { APX_RELEASES: "acme/apx" });
    assert.deepEqual(opened, [["APX.exe", "--apx-adopt-local"]]);
    assert.equal(focused, 1);
  }
  const env = { APX_RELEASES: "acme/apx" };
  let focused = false;
  secondInstance({
    env,
    openedConnection: "local",
    connection: () => assert.fail("ordinary open cannot adopt a connection"),
    relaunch: () => assert.fail("ordinary open cannot relaunch"),
    openFiles: () => {},
    focus: () => {
      focused = true;
    },
  })({}, ["APX.exe", "artifact.apxart"], "", { releaseFeed: "off" });
  assert.deepEqual(env, { APX_RELEASES: "acme/apx" });
  assert.equal(focused, true);
  assert.deepEqual(adoptionData(["APX.exe"], { APX_RELEASES: "off" }), {});
  assert.deepEqual(adoptionData(["APX.exe", "--apx-adopt-local"], { APX_RELEASES: "x".repeat(4097) }), {});
});

test("unchanged effective feeds focus the primary without restarting it", () => {
  for (const feed of [undefined, "", "off", "acme/apx"]) {
    const env: NodeJS.ProcessEnv = { APX_RELEASES: feed };
    let focused = false;
    const argv = ["APX.exe", "--apx-adopt-local"];
    const data = adoptionData(argv, env);
    assert.equal(data.releaseFeed, feed || RELEASE_FEED || "off");
    secondInstance({
      env,
      openedConnection: "local",
      connection: () => "local",
      relaunch: () => assert.fail("unchanged feed cannot relaunch"),
      openFiles: () => {},
      focus: () => {
        focused = true;
      },
    })({}, argv, "", data);
    assert.equal(focused, true);
  }
});

test("a changed connection still clears stale core credentials before relaunch", () => {
  const env = { APX_HOME: "old", APX_PORT: "7550", APX_URL: "http://localhost:7550", APX_TOKEN: "test" };
  let relaunched = false;
  secondInstance({
    env,
    openedConnection: "old",
    connection: () => "new",
    relaunch: () => {
      relaunched = true;
    },
    openFiles: () => assert.fail("must relaunch"),
    focus: () => assert.fail("must relaunch"),
  })({}, ["APX.exe", "--apx-adopt-local"], "", {});
  assert.equal(relaunched, true);
  assert.deepEqual(env, {});
});
