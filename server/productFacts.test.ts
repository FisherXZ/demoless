import { describe, expect, it } from "vitest";
import { getProductFacts } from "./productFacts";

describe("getProductFacts", () => {
  it("returns the stable Demoless facts object used by the stub brain", () => {
    const facts = getProductFacts();

    expect(facts.product).toBe("Demoless");
    expect(facts.blob).toContain("AI agent platform for live product demos");
    expect(facts.blob).toContain("Starter: $0/mo");
    expect(facts.blob).toContain("SOC 2 Type II");
  });

  it("returns the same object reference for repeated calls", () => {
    expect(getProductFacts()).toBe(getProductFacts());
  });
});
