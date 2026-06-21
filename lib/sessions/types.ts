// Shared types for the post-session recap feature. Kept free of any server/
// imports (lib must not depend on server); the transcript turn shape is local.

export type RecapLabel = "hot" | "follow_up_needed" | "nurture";
export type RecapStatus = "pending" | "ready";

/** An ordered, timestamped record of what happened during a live demo. */
export type TraceEvent =
  | { kind: "user_said"; text: string; ts: number; turn: number }
  | { kind: "agent_said"; text: string; ts: number; turn: number }
  | { kind: "page_visited"; url: string; ts: number; turn: number }
  | { kind: "agent_action"; action: "navigate" | "click"; detail: string; ts: number; turn: number }
  | { kind: "phase"; phase: string; ts: number }
  | { kind: "remember"; note: string; noteType?: string; ts: number };

/** A spoken turn, derived from user_said/agent_said events (display + grounding). */
export interface TranscriptTurn {
  role: "user" | "agent";
  text: string;
  turn: number;
  ts: number;
}

/** Everything persisted about one finished session — the source of truth. */
export interface SessionRecord {
  id: string;          // Browserbase session id
  company: string;
  role?: string;       // visitor's self-reported role
  startedAt: number;
  endedAt: number;
  phaseReached?: string;
  replayUrl?: string;
  events: TraceEvent[];
  transcript: TranscriptTurn[];
}

/** Proof attached to every shown insight. */
export type Evidence =
  | { kind: "quote"; speaker: "user" | "agent"; text: string; turn: number; ts: number }
  | { kind: "action"; label: string; ts: number };

export interface InsightItem { text: string; evidence: Evidence[] }
export interface ObjectionItem { text: string; kind: "objection" | "question"; evidence: Evidence[] }

/** The salesperson-facing recap. Every insight here is evidence-verified. */
export interface RecapReport {
  sessionId: string;
  generatedAt: number;
  label: RecapLabel;
  labelEvidence: Evidence[];
  summary: string;                                   // paraphrase, exempt from per-line citation
  whyTheyCame: { text: string; evidence: Evidence[] };
  buyingSignals: InsightItem[];
  objectionsQuestions: ObjectionItem[];
  gaps: InsightItem[];
  nextAction: { text: string; evidence: Evidence[] };
  draftEmail: { subject: string; body: string };     // references only grounded insights
}
