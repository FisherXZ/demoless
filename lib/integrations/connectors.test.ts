import { describe, it, expect } from "vitest";
import {
  buildActions,
  buildHubspotActions,
  buildClayActions,
  buildLinearActions,
} from "./connectors";
import type { SessionRecord } from "../sessions/types";
import type { EvidenceInsight, SessionPacket } from "../sessions/packet/types";

const record: SessionRecord = {
  id: "s1",
  company: "Acme",
  status: "ended",
  buyerEmail: "bea@acme.com",
  buyerName: "Bea",
  role: "Eng Lead",
  createdAt: 1,
  endedAt: 2,
  replayUrl: "https://browserbase.com/sessions/bb1",
  events: [],
  transcript: [{ role: "user", text: "hi", turn: 1, ts: 1 }],
};

function insight(id: string, title: string, quote?: string): EvidenceInsight {
  return {
    id,
    type: "product_gap",
    title,
    detail: `${title} detail`,
    evidence: quote ? [{ kind: "quote", role: "user", text: quote, turn: 1, transcriptChunkId: "c1", ts: 1 }] : [],
  };
}

const basePacket: SessionPacket = {
  sessionId: "s1",
  generatedAt: 9,
  modelInfo: { provider: "anthropic", model: "x", promptVersion: "1" },
  summary: "Great call about onboarding automation.",
  whyTheyCame: [],
  buyerBackground: [],
  painPoints: [],
  buyingSignals: [insight("bs1", "Asked how to get started")],
  objections: [insight("o1", "Worried about pricing")],
  questions: [],
  workflowGaps: [insight("wg1", "No Slack export", "we can't export to Slack")],
  productGaps: [insight("pg1", "Missing SSO", "we need SSO before we buy")],
  productMoments: [],
  recommendedNextAction: { text: "Book a technical follow-up with their platform team", evidence: [] },
  followUpEmail: { subject: "Next steps after your Browserbase demo", body: "..." },
  labels: ["hot", "product_gap", "objection"],
};

describe("buildHubspotActions", () => {
  it("emits one deal action mapped to a Hot stage with the recap and email", () => {
    const [a] = buildHubspotActions(record, basePacket);
    expect(a.connector).toBe("hubspot");
    expect(a.title).toBe("Deal updated → Hot — Demo Qualified");
    expect(a.externalRef).toMatch(/app\.hubspot\.com/);
    const byLabel = Object.fromEntries(a.fields.map((f) => [f.label, f.value]));
    expect(byLabel["Contact"]).toContain("bea@acme.com");
    expect(byLabel["Queued email"]).toBe("Next steps after your Browserbase demo");
    expect(byLabel["Buying signals"]).toContain("1 logged");
  });

  it("falls back to Follow-up then Nurture by label", () => {
    expect(buildHubspotActions(record, { ...basePacket, labels: ["asked_pricing"] })[0].title).toContain("Follow-up");
    expect(buildHubspotActions(record, { ...basePacket, labels: [] })[0].title).toContain("Nurture");
  });

  it("handles a packet with no buying signals and no email", () => {
    const [a] = buildHubspotActions(record, { ...basePacket, buyingSignals: [], followUpEmail: undefined });
    const byLabel = Object.fromEntries(a.fields.map((f) => [f.label, f.value]));
    expect(byLabel["Buying signals"]).toBe("none logged");
    expect(byLabel["Queued email"]).toBe("—");
  });
});

describe("buildClayActions", () => {
  it("builds a sequence that references signals, objections and next action", () => {
    const [a] = buildClayActions(record, basePacket);
    expect(a.connector).toBe("clay");
    const steps = a.fields.filter((f) => f.label.startsWith("Step")).map((f) => f.value);
    expect(a.title).toBe(`${steps.length}-step follow-up sequence built`);
    expect(steps.some((s) => s.includes("Reinforce interest"))).toBe(true);
    expect(steps.some((s) => s.includes("Address objection"))).toBe(true);
    expect(steps.some((s) => s.includes("technical follow-up"))).toBe(true);
  });

  it("adds a nurture step and case-study fallback when not hot/follow-up", () => {
    const [a] = buildClayActions(record, {
      ...basePacket,
      labels: [],
      objections: [],
      recommendedNextAction: undefined,
      buyingSignals: [],
    });
    const steps = a.fields.filter((f) => f.label.startsWith("Step")).map((f) => f.value);
    expect(steps.some((s) => s.includes("case study"))).toBe(true);
    expect(steps.some((s) => s.includes("Nurture touch"))).toBe(true);
    expect(steps.some((s) => s.includes("book a follow-up"))).toBe(true);
  });

  it("derives persona from buyerBackground when role is absent", () => {
    const noRole = { ...record, role: undefined };
    const [a] = buildClayActions(noRole, { ...basePacket, buyerBackground: [insight("bb1", "VP Engineering")] });
    expect(a.fields[0].value).toContain("VP Engineering");
  });
});

describe("buildLinearActions", () => {
  it("files one ticket per gap with grounded evidence and a session link", () => {
    const actions = buildLinearActions(record, basePacket);
    expect(actions).toHaveLength(2);
    const product = actions.find((a) => a.fields.some((f) => f.value.includes("Missing SSO")))!;
    expect(product.externalRef).toMatch(/linear\.app\/demoless\/issue\/DEM-\d+/);
    const byLabel = Object.fromEntries(product.fields.map((f) => [f.label, f.value]));
    expect(byLabel["Evidence"]).toContain("we need SSO before we buy");
    expect(byLabel["Labels"]).toBe("product-gap, from-demo");
    expect(byLabel["Session"]).toBe("https://browserbase.com/sessions/bb1");
  });

  it("emits nothing when there are no gaps", () => {
    expect(buildLinearActions(record, { ...basePacket, productGaps: [], workflowGaps: [] })).toEqual([]);
  });

  it("handles gaps without evidence and missing replay url", () => {
    const noReplay = { ...record, replayUrl: undefined };
    const [a] = buildLinearActions(noReplay, {
      ...basePacket,
      productGaps: [{ id: "pg2", type: "product_gap", title: "Gap", detail: "", evidence: [] }],
      workflowGaps: [],
    });
    const byLabel = Object.fromEntries(a.fields.map((f) => [f.label, f.value]));
    expect(a.detail).toContain("0 evidence quotes");
    expect(byLabel["Evidence"]).toBe("—");
    expect(byLabel["Description"]).toBe("Reported during a live demo.");
    expect(byLabel["Session"]).toBe("session s1");
  });

  it("caps at four tickets", () => {
    const many = Array.from({ length: 6 }, (_, i) => insight(`g${i}`, `Gap ${i}`));
    expect(buildLinearActions(record, { ...basePacket, productGaps: many, workflowGaps: [] })).toHaveLength(4);
  });
});

describe("buildActions", () => {
  it("combines all three connectors in feed order", () => {
    const actions = buildActions(record, basePacket);
    expect(actions.map((a) => a.connector)).toEqual(["hubspot", "clay", "linear", "linear"]);
  });

  it("truncates a long title and a long buyer falls back to email/Visitor", () => {
    const anon = { ...record, buyerName: undefined, buyerEmail: undefined };
    const longTitle = "x".repeat(120);
    const [a] = buildLinearActions(anon, {
      ...basePacket,
      productGaps: [insight("pgL", longTitle)],
      workflowGaps: [],
    });
    expect(a.buyer).toBe("Visitor");
    expect(a.title).toContain("…");
  });
});
