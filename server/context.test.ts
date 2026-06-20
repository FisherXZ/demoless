import { describe, it, expect } from "vitest";
import { assembleContext } from "./context";
import type { LoopState } from "./state";

const base: LoopState = {
  sessionId: "s",
  buyerId: "u",
  history: [{ role: "user", text: "we waste hours prepping demos" }],
  phase: "DISCOVERY",
  tourIndex: 0,
  selected: [],
};

describe("assembleContext", () => {
  it("includes the demo arc, product facts, the catalog, and current state", () => {
    const { system } = assembleContext(base, "human");
    expect(system).toContain("HOOK");
    expect(system).toContain("Demoless"); // from facts.md
    expect(system).toContain("automation"); // a catalog id
    expect(system).toContain("phase=DISCOVERY");
  });

  it("maps history into messages", () => {
    const { messages } = assembleContext(base, "human");
    expect(messages).toEqual([{ role: "user", content: "we waste hours prepping demos" }]);
  });
});
