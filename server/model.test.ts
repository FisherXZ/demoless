// server/model.test.ts
import { describe, it, expect } from "vitest";
import { buildParams, complete } from "./model";
import type { LoopState } from "./state";

const state: LoopState = {
  sessionId: "s", buyerId: "u", history: [], phase: "HOOK", tourIndex: 0, selected: [],
};

describe("buildParams", () => {
  it("targets claude-opus-4-8 at low effort with a cached system block", () => {
    const p = buildParams({
      system: "SYS", messages: [{ role: "user", content: "hi" }], turn: "human", state,
    });
    expect(p.model).toBe("claude-opus-4-8");
    expect(p.output_config.effort).toBe("low");
    expect(Array.isArray(p.system)).toBe(true);
    expect(p.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(p.messages).toEqual([{ role: "user", content: "hi" }]);
  });
});

describe("complete (live — skipped without ANTHROPIC_API_KEY)", () => {
  it.skipIf(!process.env.ANTHROPIC_API_KEY)(
    "live: complete() returns a parsed Reply",
    async () => {
      const r = await complete({
        system: "You are a demo guide. Greet the user with one say command.",
        messages: [{ role: "user", content: "hi" }],
        turn: "human",
        state,
      });
      expect(r.commands.length).toBeGreaterThan(0);
    }
  );
});
