import { describe, it, expect } from "vitest";
import { rankLearnings, buildLearningsContext } from "./store";
import type { Learning } from "./types";

const L = (text: string, confidence: number, ts: number): Learning => ({
  id: `${ts}-0`,
  text,
  confidence,
  ts,
});

describe("rankLearnings", () => {
  it("orders by confidence desc, then recency desc", () => {
    const ranked = rankLearnings([
      L("a", 0.5, 100),
      L("b", 0.9, 100),
      L("c", 0.9, 200),
    ]);
    expect(ranked.map((l) => l.text)).toEqual(["c", "b", "a"]);
  });
  it("does not mutate the input array", () => {
    const input = [L("a", 0.1, 1), L("b", 0.9, 2)];
    rankLearnings(input);
    expect(input.map((l) => l.text)).toEqual(["a", "b"]);
  });
});

describe("buildLearningsContext", () => {
  it("returns '' for no learnings", () => {
    expect(buildLearningsContext([])).toBe("");
  });
  it("formats the top-K ranked learnings as a bulleted block", () => {
    const block = buildLearningsContext(
      [L("lower", 0.4, 1), L("high", 0.9, 1), L("mid", 0.5, 1)],
      2
    );
    expect(block).toContain("Past demo learnings");
    expect(block).toContain("- high");
    expect(block).toContain("- mid");
    expect(block).not.toContain("- lower");
  });
  it("never injects learnings below the confidence floor", () => {
    // 0.2 is below MIN_CONFIDENCE (0.3) → excluded even with room in top-K.
    expect(buildLearningsContext([L("poison", 0.2, 1)])).toBe("");
  });
});
