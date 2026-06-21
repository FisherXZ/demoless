import { describe, expect, it } from "vitest";
import { isPhantomTranscript, shouldDropUserTranscript } from "./filter";

describe("isPhantomTranscript", () => {
  it("drops common video outro bleed", () => {
    expect(isPhantomTranscript("Thank you so much for watching!")).toBe(true);
    expect(isPhantomTranscript("Thanks for watching")).toBe(true);
    expect(isPhantomTranscript("Please subscribe")).toBe(true);
  });

  it("keeps real demo questions", () => {
    expect(isPhantomTranscript("what features do you have")).toBe(false);
    expect(isPhantomTranscript("can you extract sec filing")).toBe(false);
  });
});

describe("shouldDropUserTranscript", () => {
  it("drops low-confidence finals", () => {
    expect(shouldDropUserTranscript("hello there", 0.2, true)).toBe(true);
    expect(shouldDropUserTranscript("hello there", 0.9, true)).toBe(false);
  });
});
