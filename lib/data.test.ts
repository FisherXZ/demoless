import { describe, expect, it } from "vitest";
import { CAPTIONS } from "./data";

describe("static demo captions", () => {
  it("start with discovery-first copy", () => {
    expect(CAPTIONS[0]).toMatch(/before I show anything/i);
    expect(CAPTIONS[0]).toMatch(/what .*trying to figure out/i);
    expect(CAPTIONS[0]).not.toMatch(/walk you through/i);
  });

  it("does not call the static demo a tour", () => {
    expect(CAPTIONS.join("\n")).not.toMatch(/walk you through|that's the tour/i);
  });
});
