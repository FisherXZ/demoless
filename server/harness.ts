// LAYER 1 transport: WebSocket server speaking shared/wire.ts. The frontend
// test harness connects here. One Loop per connection.

import { WebSocketServer, type WebSocket } from "ws";
import { ClientMsg, type ServerMsg } from "../shared/wire";
import { Loop } from "./loop";
import { registerVoiceFake } from "./fakes/voice";
import { registerBrowserFake } from "./fakes/browser";
import { registerMemoryFake, wipeBuyer } from "./fakes/memory";

function snapshot(loop: Loop): ServerMsg {
  const s = loop.getState();
  return {
    t: "turn",
    snapshot: {
      phase: s.phase,
      tourIndex: s.tourIndex,
      currentStep: s.selected[s.tourIndex] ?? null,
      /* v8 ignore next -- the harness wires memory before emitting turn snapshots. */
      buyer: s.buyer ?? null,
    },
  };
}

export function attach(ws: WebSocket) {
  let loop: Loop | null = null;
  let buyerId = "";

  const emit = (m: ServerMsg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
  };

  const wire = (l: Loop) => {
    registerVoiceFake(l);
    registerBrowserFake(l);
    registerMemoryFake(l, buyerId); // fires buyer_loaded
    l.onIncoming((msg) => emit({ t: "incoming", msg }));
    l.onCommand((cmd) => emit({ t: "command", cmd }));
    l.onTurn(() => emit(snapshot(l)));
  };

  ws.on("message", (raw) => {
    let parsed: unknown;
    try {
      parsed = ClientMsg.parse(JSON.parse(raw.toString()));
    } catch (e) {
      emit({ t: "error", message: `bad ClientMsg: ${(e as Error).message}` });
      return;
    }
    const msg = parsed as import("../shared/wire").ClientMsg;

    if (msg.t === "start") {
      if (!msg.buyerId) {
        emit({ t: "error", message: "buyerId required" });
        return;
      }
      buyerId = msg.buyerId;
      loop = new Loop(`sess-${Date.now()}`, buyerId);
      wire(loop);
      // greet AFTER wire(): buyer_loaded must land first
      loop.start();
      return;
    }
    if (!loop) {
      emit({ t: "error", message: "send {t:'start'} first" });
      return;
    }
    if (msg.t === "user_said") {
      loop.send({ kind: "user_said", text: msg.text, final: true });
    } else if (msg.t === "reset") {
      if (msg.wipeBuyer) wipeBuyer(buyerId);
      // Recreate the Loop so handler arrays are fresh (no double-registration).
      loop = new Loop(`sess-${Date.now()}`, buyerId);
      wire(loop);
      // greet AFTER wire(): buyer_loaded must land first
      loop.start();
    }
  });
}

/* v8 ignore start -- opening a real WebSocket port is covered outside the sandbox. */
export function startServer(port: number, host = "127.0.0.1") {
  const wss = new WebSocketServer({ port, host });
  const ready = new Promise<void>((resolve, reject) => {
    wss.once("listening", () => resolve());
    wss.once("error", reject);
  });
  wss.on("connection", attach);
  return {
    ready,
    get port() { return (wss.address() as { port: number }).port; },
    close: () => new Promise<void>((res) => wss.close(() => res())),
  };
}
/* v8 ignore stop */

// Run directly: `npm run server`
/* v8 ignore next 5 -- CLI entrypoint would leave a long-lived server open in unit tests. */
if (process.argv[1] && process.argv[1].endsWith("harness.ts")) {
  const port = Number(process.env.PORT ?? 8787);
  startServer(port);
  console.log(`[orchestrator] ws://127.0.0.1:${port} — send {t:"start",buyerId:"..."}`);
}
