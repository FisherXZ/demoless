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
      buyer: s.buyer ?? null,
    },
  };
}

function attach(ws: WebSocket) {
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

export function startServer(port: number) {
  const wss = new WebSocketServer({ port });
  wss.on("connection", attach);
  return {
    get port() { return (wss.address() as { port: number }).port; },
    close: () => new Promise<void>((res) => wss.close(() => res())),
  };
}

// Run directly: `npm run server`
if (process.argv[1] && process.argv[1].endsWith("index.ts")) {
  const port = Number(process.env.PORT ?? 8787);
  startServer(port);
  console.log(`[orchestrator] ws://localhost:${port} — send {t:"start",buyerId:"..."}`);
}
