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
    setTimeout(() => { ws.close(); resolve(msgs); }, 3000);
  });
}

describe("ws server (stub model)", () => {
  it("greets on start and replies to user_said", async () => {
    server = startServer(0 as number); // ephemeral
    // ws 'port 0' picks a random port; read the actual one:
    const port = (server as unknown as { port: number }).port;
    // NOTE: with port 0, read wss.address().port — see Step 3 fix if this is 0.
    const msgs = await collect(port, [
      { t: "start", buyerId: "tester" },
      { t: "user_said", text: "we waste hours prepping", final: true },
    ], 2);
    const says = msgs.filter((m): m is Extract<ServerMsg, { t: "command" }> => m.t === "command")
      .map((m) => m.cmd).filter((c) => c.kind === "say");
    expect(says.length).toBeGreaterThanOrEqual(2); // greet + reply
  });
});
