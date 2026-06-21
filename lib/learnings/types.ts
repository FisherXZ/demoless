/** A persisted cross-session rule-of-thumb about how to run the demo better. */
export interface Learning {
  /** Redis stream entry id. */
  id: string;
  /** The generalizable rule-of-thumb text. */
  text: string;
  /** Model-assigned confidence, 0..1. */
  confidence: number;
  /** Epoch ms when written. */
  ts: number;
}

/** A learning before it is persisted (id/ts assigned on write). */
export interface LearningInput {
  text: string;
  confidence: number;
}
