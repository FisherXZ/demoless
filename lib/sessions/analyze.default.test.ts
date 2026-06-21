import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionRecord } from "./types";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  saveRecap: vi.fn(async () => {}),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    messages = { create: mocks.create };
  },
}));

vi.mock("./store", () => ({
  saveRecap: mocks.saveRecap,
}));

import { analyzeAndStore, analyzeSession } from "./analyze";

const record: SessionRecord = {
  id: "s1",
  company: "Acme",
  startedAt: 0,
  endedAt: 10,
  events: [
    { kind: "user_said", text: "Can we buy this now?", turn: 1, ts: 1 },
    { kind: "agent_said", text: "I can send the purchase link.", turn: 1, ts: 2 },
  ],
  transcript: [
    { role: "user", text: "Can we buy this now?", turn: 1, ts: 1 },
    { role: "agent", text: "I can send the purchase link.", turn: 1, ts: 2 },
  ],
};

const recapJson = JSON.stringify({
  label: "hot",
  labelEvidence: [{ kind: "quote", speaker: "user", text: "Can we buy this now?" }],
  summary: "Buyer asked how to buy.",
  whyTheyCame: {
    text: "ready to buy",
    evidence: [{ kind: "quote", speaker: "user", text: "Can we buy this now?" }],
  },
  buyingSignals: [
    {
      text: "asked to buy now",
      evidence: [{ kind: "quote", speaker: "user", text: "Can we buy this now?" }],
    },
  ],
  objectionsQuestions: [],
  gaps: [],
  nextAction: {
    text: "send purchase link",
    evidence: [{ kind: "quote", speaker: "agent", text: "purchase link" }],
  },
  draftEmail: { subject: "Purchase link", body: "Here is the link." },
});

beforeEach(() => {
  mocks.create.mockReset();
  mocks.saveRecap.mockReset();
  delete process.env.ANTHROPIC_MODEL;
});

describe("analyzeSession default chat", () => {
  it("uses Anthropic and grounds the returned text block", async () => {
    mocks.create.mockResolvedValue({
      content: [{ type: "text", text: recapJson }],
    });

    const out = await analyzeSession(record);

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-opus-4-8",
        max_tokens: 3000,
      })
    );
    expect(out).toMatchObject({
      sessionId: "s1",
      label: "hot",
      summary: "Buyer asked how to buy.",
    });
  });

  it("returns null when Anthropic returns no text block", async () => {
    mocks.create.mockResolvedValue({ content: [{ type: "tool_use" }] });

    await expect(analyzeSession(record)).resolves.toBeNull();
  });
});

describe("analyzeAndStore", () => {
  it("stores a grounded recap when analysis succeeds", async () => {
    await analyzeAndStore(record, vi.fn(async () => recapJson));

    expect(mocks.saveRecap).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ label: "hot" })
    );
  });

  it("does not store anything when analysis returns null", async () => {
    await analyzeAndStore(
      { ...record, events: [], transcript: [] },
      vi.fn(async () => recapJson)
    );

    expect(mocks.saveRecap).not.toHaveBeenCalled();
  });

  it("swallows analysis failures", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      analyzeAndStore(record, vi.fn(async () => {
        throw new Error("model down");
      }))
    ).resolves.toBeUndefined();

    expect(mocks.saveRecap).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
