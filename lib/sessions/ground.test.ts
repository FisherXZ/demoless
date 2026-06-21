import { describe, it, expect } from "vitest";
import { verifyEvidence, groundInsights, groundEvidenceList } from "./ground";
import type { RecapReport, SessionRecord } from "./types";

const record: SessionRecord = {
  id: "s1",
  company: "Acme",
  status: "ended",
  createdAt: 0,
  startedAt: 0,
  endedAt: 10,
  events: [
    { kind: "user_said", text: "How much does the Pro plan cost?", turn: 1, ts: 1 },
    { kind: "agent_said", text: "Pro is $99 per seat.", turn: 1, ts: 2 },
    { kind: "page_visited", url: "https://acme.com/pricing", turn: 1, ts: 3 },
  ],
  transcript: [
    { role: "user", text: "How much does the Pro plan cost?", turn: 1, ts: 1 },
    { role: "agent", text: "Pro is $99 per seat.", turn: 1, ts: 2 },
  ],
};

describe("verifyEvidence", () => {
  it("accepts a quote that is a (normalized) substring of the claimed speaker's turn", () => {
    const ev = verifyEvidence(
      { kind: "quote", speaker: "user", text: "how much does the   PRO plan cost", turn: 0, ts: 0 },
      record
    );
    expect(ev).not.toBeNull();
    expect(ev).toMatchObject({ kind: "quote", speaker: "user", turn: 1, ts: 1 });
  });

  it("rejects a fabricated quote that appears nowhere", () => {
    expect(
      verifyEvidence({ kind: "quote", speaker: "user", text: "we have a $2M budget", turn: 0, ts: 0 }, record)
    ).toBeNull();
  });

  it("accepts an action that matches a recorded page visit", () => {
    expect(
      verifyEvidence({ kind: "action", label: "pricing", ts: 0 }, record)
    ).not.toBeNull();
  });

  it("rejects an action with no matching trace event", () => {
    expect(verifyEvidence({ kind: "action", label: "checkout", ts: 0 }, record)).toBeNull();
  });
});

function baseReport(over: Partial<RecapReport>): RecapReport {
  return {
    sessionId: "s1",
    generatedAt: 0,
    label: "hot",
    labelEvidence: [],
    summary: "s",
    whyTheyCame: { text: "evaluating pricing", evidence: [] },
    buyingSignals: [],
    objectionsQuestions: [],
    gaps: [],
    nextAction: { text: "send pricing", evidence: [] },
    draftEmail: { subject: "x", body: "y" },
    ...over,
  };
}

describe("groundInsights", () => {
  it("drops insights whose evidence cannot be verified", () => {
    const out = groundInsights(
      baseReport({
        buyingSignals: [
          { text: "asked about pricing", evidence: [{ kind: "quote", speaker: "user", text: "how much does the Pro plan cost", turn: 0, ts: 0 }] },
          { text: "fabricated", evidence: [{ kind: "quote", speaker: "user", text: "nope never said", turn: 0, ts: 0 }] },
        ],
      }),
      record
    );
    expect(out.buyingSignals).toHaveLength(1);
    expect(out.buyingSignals[0].text).toBe("asked about pricing");
  });

  it("downgrades label to nurture when no buying signal survives grounding", () => {
    const out = groundInsights(
      baseReport({
        label: "hot",
        labelEvidence: [{ kind: "quote", speaker: "user", text: "ungrounded", turn: 0, ts: 0 }],
        buyingSignals: [{ text: "x", evidence: [{ kind: "quote", speaker: "user", text: "ungrounded", turn: 0, ts: 0 }] }],
      }),
      record
    );
    expect(out.label).toBe("nurture");
    expect(out.labelEvidence).toHaveLength(0);
  });

  it("keeps a verified hot label with grounded evidence", () => {
    const ev = { kind: "quote", speaker: "user", text: "how much does the Pro plan cost", turn: 0, ts: 0 } as const;
    const out = groundInsights(
      baseReport({ label: "hot", labelEvidence: [ev], buyingSignals: [{ text: "pricing", evidence: [ev] }] }),
      record
    );
    expect(out.label).toBe("hot");
    expect(out.labelEvidence.length).toBeGreaterThan(0);
  });

  it("downgrades follow_up_needed to nurture when no buying signal survives", () => {
    const out = groundInsights(
      baseReport({ label: "follow_up_needed", buyingSignals: [], labelEvidence: [] }),
      record
    );
    expect(out.label).toBe("nurture");
  });
});

describe("groundEvidenceList", () => {
  it("keeps only verifiable evidence and drops the rest", () => {
    const kept = groundEvidenceList(
      [
        { kind: "quote", speaker: "user", text: "how much does the Pro plan cost", turn: 0, ts: 0 },
        { kind: "quote", speaker: "user", text: "this was never said", turn: 0, ts: 0 },
      ],
      record
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ kind: "quote", turn: 1 });
  });
});
