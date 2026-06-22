import { describe, it, expect } from "vitest";
import { toText } from "./contentText";

describe("toText", () => {
  it("passes a string through unchanged", () => {
    expect(toText("URL: /p\nTitle: Pricing")).toBe("URL: /p\nTitle: Pricing");
  });

  it("pulls text out of a [text, image] block array", () => {
    const content = [
      { type: "text" as const, text: "URL: /p\nTitle: Pricing" },
      { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: "AAAA" } },
    ];
    expect(toText(content)).toBe("URL: /p\nTitle: Pricing");
  });

  it("joins multiple text blocks and ignores images", () => {
    const content = [
      { type: "text" as const, text: "one" },
      { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: "AAAA" } },
      { type: "text" as const, text: "two" },
    ];
    expect(toText(content)).toBe("one\ntwo");
  });

  it("returns empty string for an image-only array", () => {
    const content = [
      { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: "AAAA" } },
    ];
    expect(toText(content)).toBe("");
  });
});
