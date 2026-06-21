import { describe, it, expect } from "vitest";
import { verifyRef, groundInsights, groundPacket } from "./ground";
import type { SessionRecord } from "../types";
import type { EvidenceInsight, SessionPacket } from "./types";

const record: SessionRecord = {
  id: "s1", company: "Acme", status: "ended", createdAt: 0, startedAt: 0, endedAt: 10,
  events: [
    { kind: "user_said", text: "How much does the Pro plan cost?", turn: 1, ts: 1 },
    { kind: "page_visited", url: "https://x.com/pricing", turn: 2, ts: 3 },
  ],
  transcript: [
    { role: "user", text: "How much does the Pro plan cost?", turn: 1, ts: 1 },
  ],
};

const insight = (text: string, role: "user" | "agent"): EvidenceInsight => ({
  id: "x", type: "buying_signal", title: "t", detail: "d",
  evidence: [{ kind: "quote", role, text, turn: 0, transcriptChunkId: "", ts: 0 }],
});

describe("packet grounding", () => {
  it("stamps a verified quote with the real turn as the chunk id", () => {
    const ev = verifyRef({ kind: "quote", role: "user", text: "Pro plan cost", turn: 0, transcriptChunkId: "", ts: 0 }, record);
    expect(ev).toEqual({ kind: "quote", role: "user", text: "Pro plan cost", turn: 1, transcriptChunkId: "1", ts: 1 });
  });

  it("returns null for a quote that is not in the transcript", () => {
    expect(verifyRef({ kind: "quote", role: "user", text: "we have budget approved", turn: 0, transcriptChunkId: "", ts: 0 }, record)).toBeNull();
  });

  it("verifies an action against a recorded page visit", () => {
    const ev = verifyRef({ kind: "action", label: "pricing", ts: 0 }, record);
    expect(ev).toEqual({ kind: "action", label: "pricing", ts: 3 });
  });

  it("drops insights whose evidence does not survive", () => {
    const kept = groundInsights([insight("Pro plan cost", "user"), insight("budget approved", "user")], record);
    expect(kept).toHaveLength(1);
    expect(kept[0].evidence[0]).toMatchObject({ turn: 1 });
  });

  it("grounds every bucket and drops an unsupported nextAction", () => {
    const packet: SessionPacket = {
      sessionId: "s1", generatedAt: 1,
      modelInfo: { provider: "anthropic", model: "m", promptVersion: "packet-v1" },
      summary: "", whyTheyCame: [insight("Pro plan cost", "user")],
      buyerBackground: [], painPoints: [], buyingSignals: [], objections: [],
      questions: [], workflowGaps: [], productGaps: [], productMoments: [],
      recommendedNextAction: { text: "follow up", evidence: [{ kind: "quote", role: "user", text: "ghost quote", turn: 0, transcriptChunkId: "", ts: 0 }] },
      labels: [],
    };
    const g = groundPacket(packet, record);
    expect(g.whyTheyCame).toHaveLength(1);
    expect(g.recommendedNextAction).toBeUndefined();
  });
});
