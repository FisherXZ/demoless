import { describe, it, expect } from "vitest";
import { deriveLabels } from "./labels";
import type { SessionRecord } from "../types";
import type { EvidenceInsight, SessionPacket } from "./types";

const emptyRecord: SessionRecord = { id: "s1", company: "Acme", status: "ended", createdAt: 0, startedAt: 0, endedAt: 1, events: [], transcript: [] };

const insight = (type: EvidenceInsight["type"], quote: string): EvidenceInsight => ({
  id: "x", type, title: quote, detail: "",
  evidence: [{ kind: "quote", role: "user", text: quote, turn: 1, transcriptChunkId: "1", ts: 1 }],
});

const base = (over: Partial<SessionPacket>): SessionPacket => ({
  sessionId: "s1", generatedAt: 1,
  modelInfo: { provider: "anthropic", model: "m", promptVersion: "packet-v1" },
  summary: "", whyTheyCame: [], buyerBackground: [], painPoints: [], buyingSignals: [],
  objections: [], questions: [], workflowGaps: [], productGaps: [], productMoments: [],
  labels: [], ...over,
});

describe("deriveLabels", () => {
  it("labels strong_pain, product_gap, objection from surviving buckets", () => {
    const p = base({ painPoints: [insight("pain_point", "manual work")], productGaps: [insight("product_gap", "no sso")], objections: [insight("objection", "too pricey")] });
    const labels = deriveLabels(p, emptyRecord);
    expect(labels).toEqual(expect.arrayContaining(["strong_pain", "product_gap", "objection"]));
  });

  it("labels asked_pricing from a pricing question and follow_up_needed follows", () => {
    const p = base({ questions: [insight("question", "what does the Pro plan cost?")] });
    const labels = deriveLabels(p, emptyRecord);
    expect(labels).toContain("asked_pricing");
    expect(labels).toContain("follow_up_needed");
  });

  it("labels hot from a start/buy buying signal", () => {
    const p = base({ buyingSignals: [insight("buying_signal", "how do we get started this quarter?")] });
    expect(deriveLabels(p, emptyRecord)).toContain("hot");
  });

  it("labels no_clear_next_step when nothing actionable survived", () => {
    expect(deriveLabels(base({}), emptyRecord)).toEqual(["no_clear_next_step"]);
  });
});
