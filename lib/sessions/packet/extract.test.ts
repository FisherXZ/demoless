import { describe, it, expect, vi } from "vitest";
import { extractPacket, parsePacket } from "./extract";
import type { SessionRecord } from "../types";

const record: SessionRecord = {
  id: "s1", company: "Acme", status: "ended", createdAt: 0, startedAt: 0, endedAt: 10,
  events: [
    { kind: "user_said", text: "We waste hours on manual onboarding. How do we get started?", turn: 1, ts: 1 },
    { kind: "agent_said", text: "Browserbase automates that.", turn: 1, ts: 2 },
  ],
  transcript: [
    { role: "user", text: "We waste hours on manual onboarding. How do we get started?", turn: 1, ts: 1 },
    { role: "agent", text: "Browserbase automates that.", turn: 1, ts: 2 },
  ],
};

// One grounded pain + one grounded hot signal, plus a hallucinated objection.
const reply = JSON.stringify({
  summary: "Buyer has a manual onboarding pain and asked to get started.",
  whyTheyCame: [{ title: "evaluating automation", detail: "", evidence: [{ kind: "quote", role: "user", text: "manual onboarding" }] }],
  painPoints: [{ title: "manual onboarding", detail: "", evidence: [{ kind: "quote", role: "user", text: "waste hours on manual onboarding" }] }],
  buyingSignals: [{ title: "ready to start", detail: "", evidence: [{ kind: "quote", role: "user", text: "How do we get started" }] }],
  objections: [{ title: "too expensive", detail: "", evidence: [{ kind: "quote", role: "user", text: "this costs too much" }] }],
  recommendedNextAction: { text: "send onboarding guide", evidence: [{ kind: "quote", role: "agent", text: "Browserbase automates that" }] },
  followUpEmail: { subject: "Getting started", body: "Hi..." },
});

describe("extractPacket", () => {
  it("parses, grounds (dropping the hallucinated objection), and derives labels", async () => {
    const chat = vi.fn(async () => reply);
    const packet = await extractPacket(record, chat, 123);
    expect(chat).toHaveBeenCalledOnce();
    expect(packet.generatedAt).toBe(123);
    expect(packet.painPoints).toHaveLength(1);
    expect(packet.objections).toHaveLength(0); // hallucinated quote not in transcript -> dropped
    expect(packet.labels).toEqual(expect.arrayContaining(["strong_pain", "hot"]));
    expect(packet.modelInfo.promptVersion).toBe("packet-v1");
  });

  it("throws when the model output has no JSON object", async () => {
    const chat = vi.fn(async () => "sorry, no JSON here");
    await expect(extractPacket(record, chat, 1)).rejects.toThrow("packet parse failed");
  });

  it("parsePacket returns null on unparseable input", () => {
    expect(parsePacket("nope", "s1", 1, { provider: "a", model: "m", promptVersion: "packet-v1" })).toBeNull();
  });
});
