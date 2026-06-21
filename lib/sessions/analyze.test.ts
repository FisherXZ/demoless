import { describe, it, expect, vi } from "vitest";
import { analyzeSession, parseRecap } from "./analyze";
import type { SessionRecord } from "./types";

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
  ],
  transcript: [
    { role: "user", text: "How much does the Pro plan cost?", turn: 1, ts: 1 },
    { role: "agent", text: "Pro is $99 per seat.", turn: 1, ts: 2 },
  ],
};

// A model reply with one grounded signal and one hallucinated one.
const reply = JSON.stringify({
  label: "follow_up_needed",
  labelEvidence: [{ kind: "quote", speaker: "user", text: "How much does the Pro plan cost" }],
  summary: "Buyer asked about pricing.",
  whyTheyCame: { text: "evaluating cost", evidence: [{ kind: "quote", speaker: "user", text: "How much does the Pro plan cost" }] },
  buyingSignals: [
    { text: "asked about Pro pricing", evidence: [{ kind: "quote", speaker: "user", text: "How much does the Pro plan cost" }] },
    { text: "said they have budget approved", evidence: [{ kind: "quote", speaker: "user", text: "we have budget approved" }] },
  ],
  objectionsQuestions: [],
  gaps: [],
  nextAction: { text: "send pricing one-pager", evidence: [{ kind: "quote", speaker: "agent", text: "Pro is $99 per seat" }] },
  draftEmail: { subject: "Pricing", body: "Hi, here's the pricing..." },
});

describe("analyzeSession", () => {
  it("parses the model reply and drops the hallucinated buying signal", async () => {
    const chat = vi.fn(async () => reply);
    const out = await analyzeSession(record, chat, 123);
    expect(out).not.toBeNull();
    expect(out!.sessionId).toBe("s1");
    expect(out!.generatedAt).toBe(123);
    expect(out!.label).toBe("follow_up_needed");
    expect(out!.buyingSignals).toHaveLength(1); // hallucinated one dropped by grounding
    expect(out!.buyingSignals[0].text).toBe("asked about Pro pricing");
  });

  it("tolerates prose wrapped around the JSON object", async () => {
    const chat = vi.fn(async () => "Here is the recap:\n" + reply + "\nDone.");
    const out = await analyzeSession(record, chat, 1);
    expect(out).not.toBeNull();
    expect(out!.label).toBe("follow_up_needed");
  });

  it("returns null when there are no user turns (nothing to analyze)", async () => {
    const chat = vi.fn(async () => reply);
    const empty: SessionRecord = { ...record, events: [], transcript: [] };
    const out = await analyzeSession(empty, chat, 1);
    expect(out).toBeNull();
    expect(chat).not.toHaveBeenCalled();
  });
});

describe("parseRecap", () => {
  it("returns null on unparseable input", () => {
    expect(parseRecap("not json at all", "s1", 0)).toBeNull();
  });
  it("coerces a missing or invalid label to nurture", () => {
    const r = parseRecap(JSON.stringify({ summary: "x" }), "s1", 7);
    expect(r).not.toBeNull();
    expect(r!.label).toBe("nurture");
    expect(r!.sessionId).toBe("s1");
    expect(r!.generatedAt).toBe(7);
  });
  it("extracts a JSON object wrapped in prose", () => {
    const r = parseRecap('Here you go: {"label":"hot","summary":"s"} thanks', "s1", 0);
    expect(r).not.toBeNull();
    expect(r!.label).toBe("hot");
  });
});
