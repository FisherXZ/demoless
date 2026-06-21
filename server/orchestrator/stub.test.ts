import { describe, expect, it } from "vitest";
import { StubOrchestrator } from "./stub";

describe("StubOrchestrator greeting", () => {
  it("asks a discovery question instead of offering a tour", () => {
    const text = new StubOrchestrator().greeting("en", "Messi");

    expect(text).toMatch(/what .*trying to figure out/i);
    expect(text).not.toMatch(/walk you through|what would you like to see first/i);
  });
});
