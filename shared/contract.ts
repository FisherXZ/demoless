// Source of truth for the loop's message contract (zod). The server lane owns
// this authoritative version; the chat harness validates the wire against it.
//
// Reconciled with the harness lane's draft, plus one addition: NoteInput — the
// LLM emits a note WITHOUT a timestamp, and the Agent Runtime stamps `at` at
// dispatch (decision Q9). Stored notes (Buyer.notes) keep `at`.

import { z } from "zod";

export const NoteType = z.enum(["objection", "interest", "role", "question"]);

/** What the LLM produces — no timestamp. */
export const NoteInput = z.object({
  type: NoteType,
  value: z.string(),
});

/** What we store — `at` stamped by the runtime. */
export const Note = NoteInput.extend({
  at: z.string(),
});

export const Buyer = z.object({
  id: z.string(),
  name: z.string().optional(),
  lastSeen: z.string().optional(),
  notes: z.array(Note),
});

// Messages INTO the loop
export const Incoming = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user_said"), text: z.string(), final: z.boolean() }),
  z.object({ kind: z.literal("screen_is_on"), url: z.string(), summary: z.string() }),
  z.object({ kind: z.literal("buyer_loaded"), buyer: Buyer }),
]);

// Commands OUT of the loop
export const Command = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("say"), text: z.string() }),
  z.object({ kind: z.literal("navigate"), target: z.string() }),
  z.object({ kind: z.literal("click_or_type"), instruction: z.string() }),
  z.object({ kind: z.literal("remember"), note: NoteInput }), // runtime stamps `at` → Note
]);

// The LLM's validated reply (Layer 2 → Layer 1).
export const Reply = z.object({
  commands: z.array(Command),
  tour: z
    .union([
      z.literal("advance"),
      z.literal("stay"),
      z.literal("resume"),
      z.object({ jump: z.number() }),
    ])
    .optional(),
  phase: z.enum(["HOOK", "DISCOVERY", "WALKTHROUGH", "CLOSE", "DONE"]).optional(), // next phase
  select: z.array(z.string()).optional(), // catalog ids chosen from discovery
});

export type NoteType = z.infer<typeof NoteType>;
export type NoteInput = z.infer<typeof NoteInput>;
export type Note = z.infer<typeof Note>;
export type Buyer = z.infer<typeof Buyer>;
export type Incoming = z.infer<typeof Incoming>;
export type Command = z.infer<typeof Command>;
export type Reply = z.infer<typeof Reply>;
export type TourDirective = NonNullable<Reply["tour"]>;
