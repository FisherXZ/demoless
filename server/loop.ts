// LAYER 1 — Agent Runtime. Everything non-model: transport-agnostic state, the
// turn scheduler, guards, and command dispatch. It calls the Model Layer
// (model.ts) through one boundary: complete(). It never imports the SDK.

import type { Incoming, Command, TourDirective } from "../shared/contract";
import type { CommandHandler, LoopState, TurnType } from "./state";
import { assembleContext } from "./context";
import { complete } from "./model";
import { CATALOG } from "../product/catalog";

export class Loop {
  private state: LoopState;
  private commandHandlers: CommandHandler[] = []; // fakes (and later real lanes) subscribe
  private incomingObservers: ((m: Incoming) => void)[] = []; // wire broadcast
  private turnObservers: ((s: LoopState) => void)[] = []; // wire snapshot
  private chain: Promise<void> = Promise.resolve(); // serializes turns: one in flight

  constructor(sessionId: string, buyerId: string) {
    this.state = freshState(sessionId, buyerId);
  }

  // ── subscriptions ────────────────────────────────────────────────────────
  onCommand(cb: CommandHandler) {
    this.commandHandlers.push(cb);
  }
  onIncoming(cb: (m: Incoming) => void) {
    this.incomingObservers.push(cb);
  }
  onTurn(cb: (s: LoopState) => void) {
    this.turnObservers.push(cb);
  }

  getState(): Readonly<LoopState> {
    return this.state;
  }

  // ── inbound: lanes push messages in ───────────────────────────────────────
  send(msg: Incoming) {
    for (const o of this.incomingObservers) o(msg);
    switch (msg.kind) {
      case "user_said":
        if (msg.final) {
          this.state.history.push({ role: "user", text: msg.text });
          this.enqueue("human");
        }
        return;
      case "screen_is_on":
        this.state.screen = { url: msg.url, summary: msg.summary };
        this.enqueue("screen"); // narrate-only turn (Q5)
        return;
      case "buyer_loaded":
        this.state.buyer = msg.buyer; // context only, no turn (Q5)
        return;
    }
  }

  /** Demo-open: greet unprompted (Q6). Call after buyer_loaded. */
  start() {
    this.enqueue("greet");
  }

  /** Reset between runs ("restock"). wipeBuyer is handled by the memory lane. */
  reset() {
    this.state = freshState(this.state.sessionId, this.state.buyerId);
  }

  // ── the turn engine ────────────────────────────────────────────────────────
  private enqueue(turn: TurnType) {
    this.chain = this.chain.then(() => this.runTurn(turn)).catch((err) => {
      console.error("[loop] turn failed:", err);
    });
  }

  private async runTurn(turn: TurnType) {
    const { system, messages } = assembleContext(this.state, turn);
    const reply = await complete({ system, messages, turn, state: this.state });

    // Guard: only a human turn may move the product (Q5b). Strip nav otherwise.
    let commands: Command[] = reply.commands;
    if (turn !== "human") {
      commands = commands.filter(
        (c) => c.kind !== "navigate" && c.kind !== "click_or_type"
      );
    }

    this.applyTour(reply.tour);

    if (reply.phase) this.state.phase = reply.phase;
    if (reply.select) {
      const valid = new Set(CATALOG.map((s) => s.id));
      const picked = reply.select.filter((id) => valid.has(id));
      this.state.selected = picked;
      this.state.tourIndex = 0;
    }

    for (const c of commands) {
      if (c.kind === "say") this.state.history.push({ role: "assistant", text: c.text });
      for (const h of this.commandHandlers) h(c); // fire-and-forget dispatch
    }

    for (const o of this.turnObservers) o(this.state);
  }

  private applyTour(t?: TourDirective) {
    if (!t) return;
    const last = Math.max(0, this.state.selected.length - 1);
    if (t === "advance") this.state.tourIndex = Math.min(this.state.tourIndex + 1, last);
    else if (typeof t === "object") this.state.tourIndex = t.jump;
    // "stay" (detour) and "resume" leave the bookmark; the LLM re-navigates on resume.
  }
}

function freshState(sessionId: string, buyerId: string): LoopState {
  return {
    sessionId,
    buyerId,
    history: [],
    phase: "HOOK",
    tourIndex: 0,
    selected: [],
  };
}
