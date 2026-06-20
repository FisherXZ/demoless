// The WebSocket wire envelope between the chat harness and the server.
//
// The server's Loop.send()/onCommand() API is internal. Over the socket the
// harness is BOTH an actor (sends user text, starts a run, resets) AND a pure
// observer (sees every Incoming, every Command, and a per-turn state snapshot).
//
// Server side: add one broadcast() that emits these ServerMsg events alongside
// the loop's normal dispatch. Nothing else about the agent changes.

import { z } from "zod";
import { Buyer, Command, Incoming } from "./contract";

// ---- Harness → Server ------------------------------------------------------
export const ClientMsg = z.discriminatedUnion("t", [
  // chat is the only inbound for now: typed text → loop.send(user_said)
  z.object({ t: z.literal("user_said"), text: z.string(), final: z.literal(true) }),
  // "demo-open": load (or create) a buyer and fire the GREET turn
  z.object({ t: z.literal("start"), buyerId: z.string() }),
  // reset between runs ("restock"): clear conversation + phase/bookmark;
  // wipeBuyer also drops the buyer's saved notes
  z.object({ t: z.literal("reset"), wipeBuyer: z.boolean() }),
]);

// ---- Server → Harness ------------------------------------------------------
// The snapshot is intentionally permissive: the phase machine and tour are
// still evolving server-side, so the harness only displays whatever it gets.
export const TurnSnapshot = z.object({
  phase: z.string().optional(),
  tourIndex: z.number().nullable().optional(),
  currentStep: z.string().nullable().optional(),
  buyer: Buyer.nullable().optional(),
});

export const ServerMsg = z.discriminatedUnion("t", [
  z.object({ t: z.literal("incoming"), msg: Incoming }),
  z.object({ t: z.literal("command"), cmd: Command }),
  z.object({ t: z.literal("turn"), snapshot: TurnSnapshot }),
  z.object({ t: z.literal("error"), message: z.string() }),
]);

export type ClientMsg = z.infer<typeof ClientMsg>;
export type ServerMsg = z.infer<typeof ServerMsg>;
export type TurnSnapshot = z.infer<typeof TurnSnapshot>;
