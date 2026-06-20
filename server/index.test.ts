// server/index.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { startServer } from "./index";
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

  it("reset recreates the loop: exactly one note after start → user_said → reset → user_said", async () => {
    server = startServer(0 as number);
    const port = server.port;

    // Collect all commands from the full sequence:
    // start → user_said (produces a remember) → reset(wipeBuyer) → user_said (produces another remember)
    // We need 4 command batches: greet, reply1, greet2, reply2
    const msgs = await collect(port, [
      { t: "start", buyerId: "reset-tester" },
      { t: "user_said", text: "first turn", final: true },
      { t: "reset", wipeBuyer: true },
      { t: "user_said", text: "second turn", final: true },
    ], 4);

    // After wipeBuyer + reset, the second user_said fires one remember.
    // If handlers doubled, there would be two saves for the second turn.
    const remembers = msgs
      .filter((m): m is Extract<ServerMsg, { t: "command" }> => m.t === "command")
      .map((m) => m.cmd)
      .filter((c) => c.kind === "remember");

    // Two turns emit remember, but after wipeBuyer the buyer is fresh.
    // The stub emits exactly one remember per human turn, so we expect 2 total.
    // If handlers doubled, the second turn would emit 2 remembers (total 3).
    expect(remembers.length).toBe(2);
  });
});
