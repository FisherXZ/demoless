// server/model.test.ts
import { describe, it, expect, vi } from "vitest";

// Mock @anthropic-ai/sdk so streamWithTools tests don't need a real key.
const mockStream = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class Anthropic {
      messages = { stream: mockStream, create: vi.fn() };
    },
  };
});
vi.mock("@anthropic-ai/sdk/helpers/zod", () => ({ zodOutputFormat: vi.fn(() => ({})) }));

import { buildParams, complete, coerceReply, streamWithTools } from "./model";
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

describe("coerceReply", () => {
  it("snaps a stray note.type to interest instead of dropping the turn", () => {
    const r = coerceReply({ commands: [{ kind: "remember", note: { type: "pain", value: "x" } }] });
    expect(r.commands).toEqual([{ kind: "remember", note: { type: "interest", value: "x" } }]);
  });

  it("keeps valid commands and drops unknown command kinds", () => {
    const r = coerceReply({
      commands: [
        { kind: "say", text: "hi" },
        { kind: "bogus", text: "nope" },
        { kind: "navigate", target: "dashboard" },
      ],
      phase: "WALKTHROUGH",
      tour: "advance",
      select: ["sessions", 7],
    });
    expect(r.commands.map((c) => c.kind)).toEqual(["say", "navigate"]);
    expect(r.phase).toBe("WALKTHROUGH");
    expect(r.tour).toBe("advance");
    expect(r.select).toEqual(["sessions"]); // non-strings filtered
  });

  it("drops an out-of-enum phase/tour rather than erroring", () => {
    const r = coerceReply({ commands: [{ kind: "say", text: "hi" }], phase: "CHITCHAT", tour: "next" });
    expect(r.phase).toBeUndefined();
    expect(r.tour).toBeUndefined();
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

describe("streamWithTools abort propagation", () => {
  it("passes the AbortSignal to the SDK stream call", async () => {
    // The mock stream must return an async iterable that ends immediately.
    mockStream.mockReturnValue({
      [Symbol.asyncIterator]: async function* () { /* empty stream */ },
    });

    const ac = new AbortController();
    const req = {
      system: "s",
      messages: [{ role: "user" as const, content: "hi" }],
      tools: [] as any[],
      signal: ac.signal,
    };

    // Consume the stream so the call completes.
    for await (const _ of streamWithTools(req)) { /* drain */ }

    // Assert the SDK received our signal as a request option.
    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({ model: expect.any(String) }),
      expect.objectContaining({ signal: ac.signal })
    );
  });
});
