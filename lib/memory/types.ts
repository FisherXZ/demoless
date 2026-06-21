/**
 * Shared types for the P4 memory layer.
 *
 * The message contracts (RememberCommand / BuyerLoadedEvent / NoteAddedEvent)
 * are the seam with other tracks and should be reconciled with P1B.1's shared
 * message types once those land.
 */

/** Note taxonomy. Mirrors the buyer concepts the UI already renders
 *  (painPoints / objections / summary / followUp in lib/types.ts). */
export type NoteType =
  | "preference"
  | "pain_point"
  | "objection"
  | "interest"
  | "persona"
  | "next_step";

/** A single thing the agent learned about a buyer. */
export interface Note {
  /** Redis Stream entry id (e.g. "1718900000000-0"). Assigned on write. */
  id: string;
  type: NoteType;
  text: string;
  /** 0..1 ranking weight used by recall. Defaults to 0.5 when unspecified. */
  importance: number;
  /** Demo section/moment the note came from, if known. */
  section?: string;
  /** Epoch ms the note was created. */
  ts: number;
}

/** Fields the agent may write when remembering something — id/ts are assigned
 *  by the store, so callers (P1F) omit them. */
export type NoteInput = Pick<Note, "type" | "text"> &
  Partial<Pick<Note, "importance" | "section">>;

/** Persistent buyer profile (Redis hash). */
export interface BuyerProfile {
  email: string;
  name?: string;
  role?: string;
  company?: string;
  size?: string;
  useCase?: string;
  /** Epoch ms of first and most recent visit; visitCount increments per load. */
  firstSeen: number;
  lastSeen: number;
  visitCount: number;
}

/** Structured recall derived from a buyer's notes (P4C). */
export interface Recall {
  /** Human-readable "welcome back…" line, "" for a first-time buyer. */
  line: string;
  topInterests: string[];
  painPoints: string[];
  objections: string[];
  nextStep?: string;
}

/** Everything loaded for a buyer at demo start; backs the buyer_loaded event. */
export interface BuyerMemory {
  profile: BuyerProfile;
  notes: Note[];
  /** True when this buyer has been seen before (visitCount > 1). */
  isReturning: boolean;
  recall: Recall;
}

/* ---- Message contracts (reconcile with P1B.1) ---- */

/** Inbound: P1F fires this after extracting a note from the transcript. */
export interface RememberCommand {
  type: "remember";
  buyerKey: string;
  note: NoteInput;
}

/** Outbound: emitted on demo start so the LM can personalize. */
export interface BuyerLoadedEvent {
  type: "buyer_loaded";
  buyer: BuyerMemory;
}

/** Live push: published on NOTES_CHANNEL, forwarded to the P5 panel over WS. */
export interface NoteAddedEvent {
  type: "note_added";
  buyerKey: string;
  note: Note;
}

/** Live push: published on NOTES_CHANNEL when the brain advances the demo phase. */
export interface PhaseChangedEvent {
  type: "phase_changed";
  phase: string;
  buyerId: string;
}
