// server/model.test.ts
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

// Mock @anthropic-ai/sdk so streamWithTools tests don't need a real key.
const anthropicMocks = vi.hoisted(() => ({
  create: vi.fn(),
  stream: vi.fn(),
}));
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class Anthropic {
      messages = { stream: anthropicMocks.stream, create: anthropicMocks.create };
    },
  };
});
vi.mock("@anthropic-ai/sdk/helpers/zod", () => ({ zodOutputFormat: vi.fn(() => ({})) }));

import { buildParams, complete, coerceReply, streamWithTools } from "./model";
import type { LoopState } from "./state";

const state: LoopState = {
  sessionId: "s", buyerId: "u", history: [], phase: "HOOK", tourIndex: 0, selected: [],
};
const originalApiKey = process.env.ANTHROPIC_API_KEY;
const originalUseStub = process.env.USE_STUB;

beforeEach(() => {
  anthropicMocks.create.mockReset();
  anthropicMocks.stream.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.USE_STUB;
});

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalApiKey;
  if (originalUseStub === undefined) delete process.env.USE_STUB;
  else process.env.USE_STUB = originalUseStub;
});

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
  it("returns an empty command list for null or malformed command containers", () => {
    expect(coerceReply(null)).toEqual({ commands: [] });
    expect(coerceReply({ commands: "not-array" })).toEqual({ commands: [] });
  });

  it("snaps a stray note.type to interest instead of dropping the turn", () => {
    const r = coerceReply({ commands: [{ kind: "remember", note: { type: "pain", value: "x" } }] });
    expect(r.commands).toEqual([{ kind: "remember", note: { type: "interest", value: "x" } }]);
  });

  it("keeps valid remember notes and drops malformed remember commands", () => {
    const r = coerceReply({
      commands: [
        { kind: "remember", note: { type: "question", value: "How long is setup?" } },
        { kind: "remember", note: { type: "interest" } },
      ],
    });

    expect(r.commands).toEqual([
      {
        kind: "remember",
        note: { type: "question", value: "How long is setup?" },
      },
    ]);
  });

  it("preserves durable discovery note types when coercing replies", () => {
    const r = coerceReply({
      commands: [
        { kind: "remember", note: { type: "pain_point", value: "demo prep takes hours" } },
        { kind: "remember", note: { type: "next_step", value: "send security docs" } },
      ],
    });

    expect(r.commands).toEqual([
      { kind: "remember", note: { type: "pain_point", value: "demo prep takes hours" } },
      { kind: "remember", note: { type: "next_step", value: "send security docs" } },
    ]);
  });

  it("drops commands whose required fields are malformed", () => {
    const r = coerceReply({
      commands: [
        { kind: "say", text: 1 },
        { kind: "navigate", target: 1 },
        { kind: "click_or_type", instruction: 1 },
      ],
    });

    expect(r.commands).toEqual([]);
  });

  it("keeps numeric tour jumps and ignores malformed jump objects", () => {
    expect(coerceReply({ commands: [], tour: { jump: 3 } }).tour).toEqual({ jump: 3 });
    expect(coerceReply({ commands: [], tour: { jump: "bad" } }).tour).toBeUndefined();
  });

  it("does not add select when select is not an array", () => {
    expect(coerceReply({ commands: [], select: "sessions" }).select).toBeUndefined();
  });

  it("keeps valid commands and drops unknown command kinds", () => {
    const r = coerceReply({
      commands: [
        { kind: "say", text: "hi" },
        { kind: "bogus", text: "nope" },
        { kind: "navigate", target: "dashboard" },
        { kind: "click_or_type", instruction: "Click settings" },
      ],
      phase: "WALKTHROUGH",
      tour: "advance",
      select: ["sessions", 7],
    });
    expect(r.commands.map((c) => c.kind)).toEqual(["say", "navigate", "click_or_type"]);
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

describe("complete", () => {
  it("returns a coerced reply from the SDK text block", async () => {
    anthropicMocks.create.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            commands: [{ kind: "say", text: "Hi there." }],
            tour: { jump: 2 },
          }),
        },
      ],
    });

    const r = await complete({
      system: "You are a demo guide.",
      messages: [{ role: "user", content: "hi" }],
      turn: "human",
      state,
    });

    expect(anthropicMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [{ role: "user", content: "hi" }] })
    );
    expect(r).toEqual({
      commands: [{ kind: "say", text: "Hi there." }],
      tour: { jump: 2 },
    });
  });

  it("returns the graceful fallback when the SDK reply has no valid commands", async () => {
    anthropicMocks.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ commands: [] }) }],
    });

    const r = await complete({
      system: "You are a demo guide.",
      messages: [{ role: "user", content: "hi" }],
      turn: "human",
      state,
    });

    expect(r.commands[0]).toEqual({
      kind: "say",
      text: "Sorry — give me one second.",
    });
  });

  it("returns the graceful fallback when the SDK response cannot be parsed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    anthropicMocks.create.mockResolvedValue({
      content: [{ type: "text", text: "not json" }],
    });

    const r = await complete({
      system: "You are a demo guide.",
      messages: [{ role: "user", content: "hi" }],
      turn: "human",
      state,
    });

    expect(r.commands[0].kind).toBe("say");
    expect(r.commands[0]).toHaveProperty("text", "Sorry — give me one second.");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("returns the graceful fallback when the SDK response has no text block", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    anthropicMocks.create.mockResolvedValue({
      content: [{ type: "tool_use", name: "look" }],
    });

    const r = await complete({
      system: "You are a demo guide.",
      messages: [{ role: "user", content: "hi" }],
      turn: "human",
      state,
    });

    expect(r.commands[0]).toHaveProperty("text", "Sorry — give me one second.");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("uses the offline stub when no Anthropic key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const r = await complete({
      system: "You are a demo guide.",
      messages: [{ role: "user", content: "pricing" }],
      turn: "human",
      state,
    });

    expect(anthropicMocks.create).not.toHaveBeenCalled();
    expect(r.commands.map((command) => command.kind)).toEqual([
      "say",
      "navigate",
      "remember",
    ]);
  });

  it("uses returning-buyer context in the offline greet stub", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const r = await complete({
      system: "You are a demo guide.",
      messages: [],
      turn: "greet",
      state: {
        ...state,
        buyer: {
          id: "buyer-1",
          name: "Avery",
          notes: [
            {
              type: "interest",
              value: "security automation",
              at: "2026-06-21T00:00:00.000Z",
            },
          ],
        },
      },
    });

    expect(r.commands[0]).toEqual({
      kind: "say",
      text: 'Welcome back, Avery! Last time you were interested in "security automation". What are you trying to figure out today?',
    });
  });

  it("uses the screen summary in the offline screen stub", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const r = await complete({
      system: "You are a demo guide.",
      messages: [],
      turn: "screen",
      state: {
        ...state,
        screen: { url: "/analytics", summary: "the analytics page" },
      },
    });

    expect(r.commands[0]).toEqual({
      kind: "say",
      text: "(stub) Here's the analytics page.",
    });
  });

  it("uses a generic page label in the offline screen stub when no screen is set", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const r = await complete({
      system: "You are a demo guide.",
      messages: [],
      turn: "screen",
      state,
    });

    expect(r.commands[0]).toEqual({
      kind: "say",
      text: "(stub) Here's the page.",
    });
  });
});

describe("complete stub discovery behavior", () => {
  it("returning greeting asks what the buyer is figuring out today", async () => {
    const previous = process.env.USE_STUB;
    process.env.USE_STUB = "1";
    try {
      const r = await complete({
        system: "s",
        messages: [{ role: "user", content: "[The visitor just opened the demo.]" }],
        turn: "greet",
        state: {
          ...state,
          buyer: {
            id: "u",
            notes: [{ type: "interest", value: "pricing", at: "2026-06-20T00:00:00Z" }],
          },
        } as any,
      });

      expect(r.commands[0]).toMatchObject({ kind: "say" });
      expect((r.commands[0] as any).text).toMatch(/pricing/);
      expect((r.commands[0] as any).text).toMatch(/trying to figure out today/i);
      expect((r.commands[0] as any).text).not.toMatch(/pick up there/i);
    } finally {
      if (previous === undefined) delete process.env.USE_STUB;
      else process.env.USE_STUB = previous;
    }
  });

  it("direct pricing request navigates and asks a contextual follow-up", async () => {
    const previous = process.env.USE_STUB;
    process.env.USE_STUB = "1";
    try {
      const r = await complete({
        system: "s",
        messages: [{ role: "user", content: "show pricing" }],
        turn: "human",
        state,
      });

      expect(r.commands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "navigate", target: "pricing" }),
          expect.objectContaining({
            kind: "remember",
            note: expect.objectContaining({ type: "interest" }),
          }),
        ])
      );
      const say = r.commands.find((c) => c.kind === "say") as any;
      expect(say.text).toMatch(/pricing/i);
      expect(say.text).toMatch(/\?/);
    } finally {
      if (previous === undefined) delete process.env.USE_STUB;
      else process.env.USE_STUB = previous;
    }
  });
});

describe("streamWithTools abort propagation", () => {
  it("passes the AbortSignal to the SDK stream call", async () => {
    // The mock stream must return an async iterable that ends immediately.
    anthropicMocks.stream.mockReturnValue({
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
    expect(anthropicMocks.stream).toHaveBeenCalledWith(
      expect.objectContaining({ model: expect.any(String) }),
      expect.objectContaining({ signal: ac.signal })
    );
  });

  it("reassembles tool-use JSON deltas and defaults empty tool input to an object", async () => {
    anthropicMocks.stream.mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          type: "content_block_start",
          index: 0,
          content_block: { type: "tool_use", name: "navigate" },
        };
        yield {
          type: "content_block_delta",
          index: 0,
          delta: { type: "input_json_delta", partial_json: '{"url":' },
        };
        yield {
          type: "content_block_delta",
          index: 0,
          delta: { type: "input_json_delta", partial_json: '"/pricing"}' },
        };
        yield { type: "content_block_stop", index: 0 };
        yield {
          type: "content_block_start",
          index: 1,
          content_block: { type: "tool_use", name: "look" },
        };
        yield { type: "content_block_stop", index: 1 };
      },
    });

    const out: unknown[] = [];
    for await (const event of streamWithTools({
      system: "s",
      messages: [{ role: "user" as const, content: "show pricing" }],
      tools: [] as any[],
    })) {
      out.push(event);
    }

    expect(out).toEqual([
      { kind: "tool_use", id: "0", name: "navigate", input: { url: "/pricing" } },
      { kind: "tool_use", id: "1", name: "look", input: {} },
      { kind: "end" },
    ]);
  });
});
