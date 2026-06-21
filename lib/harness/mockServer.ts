// In-browser fake "agent" that speaks the exact wire.ts schemas.
//
// Lets the harness be built and verified standalone, before the real WebSocket
// server exists. Flip the harness to "Live" to talk to the real server instead.
// This file is disposable — delete it once the real server is the only target.

import type { Buyer, NoteInput } from "@/shared/contract";
import type { ClientMsg, ServerMsg } from "@/shared/wire";

const PHASES = ["DISCOVERY", "WALKTHROUGH", "CLOSE"] as const;
const STEPS = ["Dashboard", "Create a campaign", "Analytics", "Pricing"];

// What the "LLM" emits — no timestamp. The runtime stamps `at` when storing.
function noteFor(text: string): NoteInput {
  const t = text.toLowerCase();
  const type: NoteInput["type"] = /\?$/.test(text.trim())
    ? "question"
    : /(expensive|cost|price|pricing|budget)/.test(t)
      ? "objection"
      : /(i am|i'm|my role|we are|our team)/.test(t)
        ? "role"
        : "interest";
  return { type, value: text.trim().slice(0, 120) };
}

export interface MockServer {
  handle(msg: ClientMsg): void;
}

/** Build a mock server that pushes ServerMsg events into `emit`. */
export function createMockServer(emit: (m: ServerMsg) => void): MockServer {
  const buyers = new Map<string, Buyer>();
  let activeId: string | null = null;
  let turnCount = 0;

  const at = (ms: number, fn: () => void) => setTimeout(fn, ms);
  const phaseFor = (n: number) => PHASES[Math.min(n, PHASES.length - 1)];
  const active = () => (activeId ? buyers.get(activeId) ?? null : null);

  const snapshot = () => {
    const n = turnCount;
    const phase = phaseFor(Math.floor(n / 2));
    emit({
      t: "turn",
      snapshot: {
        phase,
        tourIndex: phase === "WALKTHROUGH" ? n % STEPS.length : null,
        currentStep: phase === "WALKTHROUGH" ? STEPS[n % STEPS.length] : null,
        buyer: active(),
      },
    });
  };

  return {
    handle(msg) {
      if (msg.t === "reset") {
        turnCount = 0;
        if (msg.wipeBuyer && activeId) buyers.delete(activeId);
        at(60, snapshot);
        return;
      }

      if (msg.t === "start") {
        activeId = msg.buyerId;
        turnCount = 0;
        let buyer = buyers.get(msg.buyerId);
        const returning = !!buyer && buyer.notes.length > 0;
        if (!buyer) buyer = { id: msg.buyerId, notes: [] };
        const lastInterest = buyer.notes.find((x) => x.type === "interest");
        buyer = { ...buyer, name: buyer.name ?? msg.buyerId, lastSeen: new Date().toISOString() };
        buyers.set(msg.buyerId, buyer);

        at(100, () => emit({ t: "incoming", msg: { kind: "buyer_loaded", buyer: buyer! } }));
        at(350, () =>
          emit({
            t: "command",
            cmd: {
              kind: "say",
              text: returning
                ? `Welcome back, ${buyer!.name}! Last time you were interested in ${lastInterest?.value ?? "the product"}. Want to pick up there?`
                : `Hi ${buyer!.name}, I'm your demo agent. What brought you in today?`,
            },
          }),
        );
        at(450, snapshot);
        return;
      }

      // user_said — the main inbound
      turnCount += 1;
      const text = msg.text;
      const phase = phaseFor(Math.floor(turnCount / 2));
      at(80, () => emit({ t: "incoming", msg: { kind: "user_said", text, final: true } }));

      // remember a signal from what they said (command carries no `at`)
      const note = noteFor(text);
      const buyer = active();
      if (buyer) {
        buyer.notes = [...buyer.notes, { ...note, at: new Date().toISOString() }];
        buyers.set(buyer.id, buyer);
      }
      at(300, () => emit({ t: "command", cmd: { kind: "remember", note } }));

      // the spoken reply
      at(550, () =>
        emit({
          t: "command",
          cmd: {
            kind: "say",
            text:
              phase === "CLOSE"
                ? `Makes sense. Based on what you told me, I'd suggest a 14-day trial — want me to set that up?`
                : `Got it — "${text.slice(0, 60)}". Let me show you how that works.`,
          },
        }),
      );

      // during the walkthrough, drive the (fake) screen
      if (phase === "WALKTHROUGH") {
        at(700, () =>
          emit({ t: "command", cmd: { kind: "navigate", target: STEPS[turnCount % STEPS.length] } }),
        );
      }

      at(850, snapshot);
    },
  };
}
