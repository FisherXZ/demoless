import { describe, expect, it } from "vitest";
import { buildMemoryContext, composeRecall } from "./recall";
import type { BuyerMemory, Note } from "./types";

const note = (
  type: Note["type"],
  text: string,
  importance: number,
  ts: number
): Note => ({ id: `${ts}-0`, type, text, importance, ts });

describe("composeRecall", () => {
  it("returns empty recall when there are no notes", () => {
    expect(composeRecall([])).toEqual({
      line: "",
      topInterests: [],
      painPoints: [],
      objections: [],
      nextStep: undefined,
    });
  });

  it("ranks notes by importance, then recency, and groups by type", () => {
    const recall = composeRecall([
      note("interest", "old high interest", 0.8, 1),
      note("preference", "new high preference", 0.8, 2),
      note("pain_point", "slow prep", 0.9, 1),
      note("objection", "security review", 0.7, 1),
      note("next_step", "send the SOC2 report", 0.6, 1),
    ]);

    expect(recall.topInterests).toEqual([
      "new high preference",
      "old high interest",
    ]);
    expect(recall.painPoints).toEqual(["slow prep"]);
    expect(recall.objections).toEqual(["security review"]);
    expect(recall.nextStep).toBe("send the SOC2 report");
    expect(recall.line).toBe(
      "Welcome back — last time you were focused on new high preference."
    );
  });

  it("uses a single cared-about item naturally in the welcome-back line", () => {
    const recall = composeRecall([
      note("interest", "SOC2 automation", 0.8, 1),
    ]);

    expect(recall.line).toBe(
      "Welcome back — last time you were focused on SOC2 automation."
    );
  });

  it("does not print undefined when a stored note is missing text", () => {
    const recall = composeRecall([
      { ...note("interest", "ignored", 0.8, 1), text: undefined as unknown as string },
    ]);

    expect(recall.line).toBe("");
  });

  it("caps each recall bucket to three notes", () => {
    const recall = composeRecall([
      note("interest", "one", 1, 1),
      note("interest", "two", 1, 2),
      note("interest", "three", 1, 3),
      note("interest", "four", 1, 4),
      note("pain_point", "pain one", 1, 1),
      note("pain_point", "pain two", 1, 2),
      note("pain_point", "pain three", 1, 3),
      note("pain_point", "pain four", 1, 4),
      note("objection", "objection one", 1, 1),
      note("objection", "objection two", 1, 2),
      note("objection", "objection three", 1, 3),
      note("objection", "objection four", 1, 4),
    ]);

    expect(recall.topInterests).toEqual(["four", "three", "two"]);
    expect(recall.painPoints).toEqual(["pain four", "pain three", "pain two"]);
    expect(recall.objections).toEqual([
      "objection four",
      "objection three",
      "objection two",
    ]);
  });
});

describe("buildMemoryContext", () => {
  const baseMemory: BuyerMemory = {
    profile: {
      email: "buyer@example.com",
      visitCount: 1,
      firstSeen: 1,
      lastSeen: 2,
    },
    notes: [],
    isReturning: false,
    recall: {
      line: "",
      topInterests: [],
      painPoints: [],
      objections: [],
    },
  };

  it("returns empty text when there is no useful context", () => {
    expect(buildMemoryContext(baseMemory)).toBe("");
  });

  it("formats profile, returning status, recall, and next step", () => {
    const context = buildMemoryContext({
      ...baseMemory,
      isReturning: true,
      profile: {
        ...baseMemory.profile,
        name: "Avery",
        role: "VP Sales",
        company: "Acme",
        useCase: "automated demos",
        visitCount: 3,
      },
      recall: {
        line: "",
        topInterests: ["session replay"],
        painPoints: ["slow demo prep"],
        objections: ["needs SSO"],
        nextStep: "send security docs",
      },
    });

    expect(context).toContain("Known buyer memory:");
    expect(context).toContain("- Buyer: Avery, VP Sales, Acme");
    expect(context).toContain("- Use case: automated demos");
    expect(context).toContain("- Returning buyer (visit #3).");
    expect(context).toContain("- Cares about: session replay");
    expect(context).toContain("- Pain points: slow demo prep");
    expect(context).toContain("- Open objections: needs SSO");
    expect(context).toContain("- Suggested next step: send security docs");
  });
});
