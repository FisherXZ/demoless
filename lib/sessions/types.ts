// Shared types for the post-session recap feature. Kept free of any server/
// imports (lib must not depend on server); the transcript turn shape is local.

export type RecapLabel = "hot" | "follow_up_needed" | "nurture";
export type RecapStatus = "pending" | "ready";

/** Lifecycle of a demo session, from up-front creation through teardown. */
export type SessionStatus = "created" | "live" | "ended";
/** Whether a Browserbase replay is expected (pending) or won't exist. */
export type ReplayStatus = "pending" | "unavailable";

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

/**
 * Everything persisted about one demo session — the single source of truth for
 * both the live dashboard (status === "live") and the post-session recap
 * (status === "ended"). The id is app-owned and created up-front (at enterDemo),
 * so a session exists before the cloud browser does; the Browserbase id is an
 * attached field, not the key. The event log is append-only; transcript and
 * recap are projections of it.
 */
export interface SessionRecord {
  id: string;                       // app-owned demo session id (created up-front)
  company: string;
  status: SessionStatus;
  buyerEmail?: string;              // verified identity from the pre-call form
  buyerName?: string;
  role?: string;                    // discovery-derived audience hint (no longer form-fed)
  createdAt: number;                // when the session was created (pre-browser)
  startedAt?: number;               // when the live browser phase began
  endedAt?: number;                 // when the session ended
  durationSec?: number;
  phaseReached?: string;
  browserbaseSessionId?: string;    // the vendor session id, attached when live
  liveViewUrl?: string;
  language?: string;
  replayStatus?: ReplayStatus;
  replayUrl?: string;               // derived from browserbaseSessionId
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
