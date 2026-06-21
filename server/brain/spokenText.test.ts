import { describe, expect, it } from "vitest";
import { sanitizeSpokenText } from "./spokenText";

describe("sanitizeSpokenText", () => {
  it("drops meta-narration sentences", () => {
    expect(sanitizeSpokenText("Let me see what's on the screen right now.")).toBe("");
    expect(sanitizeSpokenText("I'll look it up for you.")).toBe("");
    expect(sanitizeSpokenText("Here's how Browserbase handles that.")).toBe("");
    expect(sanitizeSpokenText("Let me check. Here is pricing.")).toBe("Here is pricing.");
  });

  it("keeps payoff-only sentences", () => {
    expect(sanitizeSpokenText("Cloud browsers your agents drive — run a thousand at once.")).toBe(
      "Cloud browsers your agents drive — run a thousand at once."
    );
  });
});
