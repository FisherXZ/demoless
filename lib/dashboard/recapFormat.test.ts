import { describe, expect, it } from "vitest";
import { LABEL_CLASS, LABEL_TEXT, relativeTime } from "./recapFormat";

describe("recapFormat", () => {
  it("maps recap labels to display text and classes", () => {
    expect(LABEL_TEXT).toEqual({
      hot: "Hot",
      follow_up_needed: "Follow-up",
      nurture: "Nurture",
    });
    expect(LABEL_CLASS.hot).toContain("text-goodlit");
    expect(LABEL_CLASS.follow_up_needed).toContain("text-warnlit");
    expect(LABEL_CLASS.nurture).toContain("text-ash");
  });

  it("formats relative times from seconds through days", () => {
    const now = 1_000_000;

    expect(relativeTime(now - 10_000, now)).toBe("just now");
    expect(relativeTime(now - 5 * 60_000, now)).toBe("5m ago");
    expect(relativeTime(now - 3 * 60 * 60_000, now)).toBe("3h ago");
    expect(relativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe("2d ago");
  });

  it("does not return negative relative times for future timestamps", () => {
    expect(relativeTime(2_000, 1_000)).toBe("just now");
  });
});
