// server/harness.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { startServer } from "./harness";
import { loadBuyer, wipeBuyer } from "./fakes/memory";
import type { ServerMsg } from "../shared/wire";

let server: { close: () => Promise<void>; port: number } | null = null;
afterEach(async () => { await server?.close(); server = null; });

function collect(port: number, send: object[], untilCommands: number) {
  return new Promise<ServerMsg[]>((resolve, reject) => {
    const msgs: ServerMsg[] = [];
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("open", () => send.forEach((m) => ws.send(JSON.stringify(m))));
    ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString()) as ServerMsg;
      msgs.push(m);
      if (msgs.filter((x) => x.t === "command").length >= untilCommands) {
        ws.close();
        resolve(msgs);
      }
    });
    ws.on("error", reject);
    setTimeout(() => { ws.close(); reject(new Error("timeout")); }, 3000);
  });
}

describe("ws server (stub model)", () => {
  it("greets on start and replies to user_said", async () => {
    server = startServer(0 as number);
    const port = server.port;
    const msgs = await collect(port, [
      { t: "start", buyerId: "tester" },
      { t: "user_said", text: "we waste hours prepping", final: true },
    ], 2);
    const says = msgs.filter((m): m is Extract<ServerMsg, { t: "command" }> => m.t === "command")
      .map((m) => m.cmd).filter((c) => c.kind === "say");
    expect(says.length).toBeGreaterThanOrEqual(2); // greet + reply
  });

  it("reset recreates the loop without doubling the memory handler (store has 1 note, not 2)", async () => {
    // Regression guard for the reset double-register bug. The bug doubled the
    // memory *handler* (→ duplicate saveNote per remember), NOT the wire
    // observer — so counting `remember` commands on the wire can't see it.
    // The store is the real signal: after wipeBuyer + one human turn, a single
    // handler leaves 1 note; a doubled handler leaves 2.
    wipeBuyer("reset-tester");
    server = startServer(0 as number);
    const port = server.port;

    // Phase the messages like a real client: send `reset` only AFTER turn 1's
    // remember is observed (turn 1 settled), not interleaved with an in-flight
    // turn. saveNote runs before the wire emit for a remember, so the store is
    // already written when we see the command.
    await new Promise<void>((resolve, reject) => {
      let remembers = 0;
      const ws = new WebSocket(`ws://localhost:${port}`);
      const send = (m: object) => ws.send(JSON.stringify(m));
      ws.on("open", () => {
        send({ t: "start", buyerId: "reset-tester" });
        send({ t: "user_said", text: "first turn", final: true });
      });
      ws.on("message", (raw) => {
        const m = JSON.parse(raw.toString()) as ServerMsg;
        if (m.t === "command" && m.cmd.kind === "remember") {
          remembers++;
          if (remembers === 1) {
            // turn 1 done — now reset and run a second turn
            send({ t: "reset", wipeBuyer: true });
            send({ t: "user_said", text: "second turn", final: true });
          } else if (remembers === 2) {
            ws.close();
            resolve();
          }
        }
      });
      ws.on("error", reject);
      setTimeout(() => { ws.close(); reject(new Error("timeout")); }, 3000);
    });

    // wipeBuyer cleared turn 1's note; turn 2 saves exactly one. Doubled → 2.
    expect(loadBuyer("reset-tester").notes.length).toBe(1);
  });
});
