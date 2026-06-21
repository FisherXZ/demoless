// server/harness.test.ts
import { EventEmitter } from "node:events";
import { describe, it, expect, vi } from "vitest";
import { attach } from "./harness";
import { loadBuyer, wipeBuyer } from "./fakes/memory";
import type { ServerMsg } from "../shared/wire";

function connect(readyState = 1) {
  const ws = new EventEmitter() as EventEmitter & {
    OPEN: number;
    readyState: number;
    send: ReturnType<typeof vi.fn>;
    sent: ServerMsg[];
  };
  ws.OPEN = 1;
  ws.readyState = readyState;
  ws.sent = [];
  ws.send = vi.fn((raw: string) => {
    ws.sent.push(JSON.parse(raw) as ServerMsg);
  });
  attach(ws as never);
  return ws;
}

function send(ws: ReturnType<typeof connect>, message: object | string) {
  ws.emit(
    "message",
    Buffer.from(typeof message === "string" ? message : JSON.stringify(message))
  );
}

async function collect(messages: object[], untilCommands: number) {
  const ws = connect();
  messages.forEach((message) => send(ws, message));
  await vi.waitFor(() => {
    expect(ws.sent.filter((x) => x.t === "command").length).toBeGreaterThanOrEqual(
      untilCommands
    );
  });
  return ws.sent;
}

async function receiveError(sendRaw: string) {
  const ws = connect();
  send(ws, sendRaw);
  await vi.waitFor(() => {
    expect(ws.sent.some((m) => m.t === "error")).toBe(true);
  });
  return ws.sent.find((m) => m.t === "error") as Extract<ServerMsg, { t: "error" }>;
}

describe("ws server (stub model)", () => {
  it("greets on start and replies to user_said", async () => {
    const msgs = await collect([
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

    // Phase the messages like a real client: send `reset` only AFTER turn 1's
    // remember is observed (turn 1 settled), not interleaved with an in-flight
    // turn. saveNote runs before the wire emit for a remember, so the store is
    // already written when we see the command.
    const ws = connect();
    send(ws, { t: "start", buyerId: "reset-tester" });
    send(ws, { t: "user_said", text: "first turn", final: true });
    await vi.waitFor(() => {
      expect(
        ws.sent.filter((m) => m.t === "command" && m.cmd.kind === "remember")
      ).toHaveLength(1);
    });
    send(ws, { t: "reset", wipeBuyer: true });
    send(ws, { t: "user_said", text: "second turn", final: true });
    await vi.waitFor(() => {
      expect(
        ws.sent.filter((m) => m.t === "command" && m.cmd.kind === "remember")
      ).toHaveLength(2);
    });

    // wipeBuyer cleared turn 1's note; turn 2 saves exactly one. Doubled → 2.
    expect(loadBuyer("reset-tester").notes.length).toBe(1);
  });

  it("reports malformed client messages", async () => {
    await expect(receiveError("not-json")).resolves.toMatchObject({
      t: "error",
      message: expect.stringContaining("bad ClientMsg"),
    });
  });

  it("requires a non-empty buyer id to start", async () => {
    await expect(
      receiveError(JSON.stringify({ t: "start", buyerId: "" }))
    ).resolves.toEqual({ t: "error", message: "buyerId required" });
  });

  it("requires start before accepting user messages", async () => {
    await expect(
      receiveError(
        JSON.stringify({ t: "user_said", text: "hello", final: true })
      )
    ).resolves.toEqual({ t: "error", message: "send {t:'start'} first" });
  });

  it("does not emit to a closed websocket", () => {
    const ws = connect(3);

    send(ws, { t: "start", buyerId: "closed" });

    expect(ws.send).not.toHaveBeenCalled();
  });
});
