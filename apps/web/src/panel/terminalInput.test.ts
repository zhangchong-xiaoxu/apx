import assert from "node:assert/strict";
import test from "node:test";
import { createInputQueue } from "./terminalInput.ts";

function controlledTransport() {
  const arrived: string[] = [];
  const pending: { data: string; resolve: () => void; reject: (error: Error) => void }[] = [];
  let inFlight = 0;
  let overlapped = false;
  const send = (data: string) => {
    inFlight++;
    if (inFlight > 1) overlapped = true;
    return new Promise<void>((resolve, reject) => pending.push({ data, resolve, reject }));
  };
  const completeNext = async (error?: Error) => {
    const request = pending.shift();
    assert.ok(request, "a request must be in flight");
    inFlight--;
    if (error) request.reject(error);
    else {
      arrived.push(request.data);
      request.resolve();
    }
    await Promise.resolve();
  };
  return { send, completeNext, arrived, overlapped: () => overlapped };
}

test("keys typed while an earlier one is still on its way reach the terminal in the order typed", async () => {
  const net = controlledTransport();
  const type = createInputQueue(net.send);
  const typed = "echo e2e-$((6*7))";
  for (const key of typed) type(key);
  type("\r");
  assert.deepEqual(net.arrived, []);
  await net.completeNext();
  await net.completeNext();
  assert.equal(net.arrived.join(""), `${typed}\r`);
  assert.equal(net.overlapped(), false, "one request at a time per terminal");
});

test("what is typed while a request is in flight goes up together afterwards", async () => {
  const net = controlledTransport();
  const type = createInputQueue(net.send);
  for (const key of "ls -la") type(key);
  await net.completeNext();
  await net.completeNext();
  assert.deepEqual(net.arrived, ["l", "s -la"]);
});

test("a paste longer than one request carries goes up in pieces, in order", async () => {
  const net = controlledTransport();
  const type = createInputQueue(net.send);
  const paste = `${"a".repeat(64 * 1024)}${"b".repeat(10)}`;
  type(paste);
  await net.completeNext();
  await net.completeNext();
  assert.deepEqual(
    net.arrived.map((d) => d.length),
    [64 * 1024, 10],
  );
  assert.equal(net.arrived.join(""), paste);
});

test("a request that fails loses its keys, not the ones typed after it", async () => {
  const net = controlledTransport();
  const type = createInputQueue(net.send);
  type("a");
  type("b");
  type("c");
  await net.completeNext(new Error("offline"));
  await net.completeNext();
  assert.equal(net.arrived.join(""), "bc");
  type("d");
  await net.completeNext();
  assert.equal(net.arrived.join(""), "bcd");
});
