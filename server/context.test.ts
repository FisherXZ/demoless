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

  it("injects a kickoff user message on the greet turn (empty history) so messages is never empty", () => {
    // The real API rejects `messages: []` with a 400; the greet turn fires
    // before the visitor speaks, so context must supply a user turn.
    const greetState: LoopState = { ...base, history: [] };
    const { messages } = assembleContext(greetState, "greet");
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].role).toBe("user"); // API requires the first message be a user turn
  });

  it("ends with a user turn on a screen turn (history ending in assistant would 400 as a prefill)", () => {
    // After a navigate, history ends with the agent's say; a screen/narrate turn
    // must not send a trailing assistant message (prefill → 400 on Opus 4.8).
    const screenState: LoopState = {
      ...base,
      history: [
        { role: "user", text: "show me analytics" },
        { role: "assistant", text: "Opening the dashboard." },
      ],
      screen: { url: "/analytics", summary: "the analytics view" },
    };
    const { messages } = assembleContext(screenState, "screen");
    expect(messages[messages.length - 1].role).toBe("user");
    expect(messages[messages.length - 1].content).toContain("analytics");
  });
});
