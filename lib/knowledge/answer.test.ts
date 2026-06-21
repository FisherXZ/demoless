import { describe, expect, it } from "vitest";
import { buildAnswerContext } from "./answer";

describe("buildAnswerContext", () => {
  it("returns an empty string when there are no search hits", () => {
    expect(buildAnswerContext([])).toBe("");
  });

  it("formats titled and untitled hits as a grounded prompt block", () => {
    const context = buildAnswerContext([
      { id: "1", score: 0.9, title: "Docs", text: " Browserbase   runs cloud browsers. " },
      { id: "2", score: 0.8, text: "No title here." },
    ]);

    expect(context).toContain("Product knowledge");
    expect(context).toContain("- [Docs] Browserbase runs cloud browsers.");
    expect(context).toContain("- No title here.");
  });

  it("truncates long chunks with an ellipsis", () => {
    const context = buildAnswerContext([
      { id: "1", score: 1, text: `${"a".repeat(330)}   ` },
    ]);

    expect(context).toContain(`${"a".repeat(320)}...`.replace("...", "…"));
    expect(context).not.toContain("a".repeat(321));
  });
});
