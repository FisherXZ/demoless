import { describe, it, expect, vi, beforeEach } from "vitest";

const mkStream = (events: any[]) => ({ async *[Symbol.asyncIterator]() { for (const e of events) yield e; } });

vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { stream: vi.fn(() => mkStream([
    { type: "content_block_delta", delta: { type: "text_delta", text: "Hi " } },
    { type: "content_block_delta", delta: { type: "text_delta", text: "there." } },
    { type: "message_stop" },
  ])) } },
}));

describe("streamWithTools", () => {
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = "x"; });
  it("yields text deltas then end", async () => {
    const { streamWithTools } = await import("./model");
    const out: any[] = [];
    for await (const e of streamWithTools({ system: "s", messages: [{ role: "user", content: "hi" }], tools: [] })) out.push(e);
    expect(out.filter((e) => e.kind === "text").map((e) => e.delta).join("")).toBe("Hi there.");
    expect(out.at(-1)).toEqual({ kind: "end" });
  });
});
