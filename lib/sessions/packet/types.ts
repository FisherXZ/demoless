// Issue #21 post-demo packet schema. Richer than main's RecapReport: split
// insight buckets, 8 factual labels (derived in code), and an extraction
// status lifecycle. Every shown insight carries a verified EvidenceRef.
export type SessionLabel =
  | "hot" | "follow_up_needed" | "asked_pricing" | "asked_integration"
  | "product_gap" | "strong_pain" | "objection" | "no_clear_next_step";

export type InsightType =
  | "why_here" | "buyer_background" | "pain_point" | "buying_signal"
  | "objection" | "question" | "workflow_gap" | "product_gap";

// A quote ref is stamped during grounding with the real transcript turn (used
// as the stable chunk id). An action ref points at a recorded page/agent action.
export type EvidenceRef =
  | { kind: "quote"; role: "user" | "agent"; text: string; turn: number; transcriptChunkId: string; ts: number }
  | { kind: "action"; label: string; ts: number };

export interface EvidenceInsight {
  id: string;
  type: InsightType;
  title: string;
  detail: string;
  evidence: EvidenceRef[];
}

export interface ProductMoment { id: string; label: string; evidence: EvidenceRef[] }
export interface NextAction { text: string; evidence: EvidenceRef[] }

export interface SessionPacket {
  sessionId: string;
  generatedAt: number;
  modelInfo: { provider: string; model: string; promptVersion: string };
  summary: string;
  whyTheyCame: EvidenceInsight[];
  buyerBackground: EvidenceInsight[];
  painPoints: EvidenceInsight[];
  buyingSignals: EvidenceInsight[];
  objections: EvidenceInsight[];
  questions: EvidenceInsight[];
  workflowGaps: EvidenceInsight[];
  productGaps: EvidenceInsight[];
  productMoments: ProductMoment[];
  recommendedNextAction?: NextAction;
  followUpEmail?: { subject: string; body: string };
  labels: SessionLabel[];
}

export type ExtractionStatus =
  | "not_started" | "processing" | "ready" | "failed" | "insufficient_evidence";
