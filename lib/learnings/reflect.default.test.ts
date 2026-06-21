import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    messages = { create: mocks.create };
  },
}));

import { reflectOnSession } from "./reflect";

beforeEach(() => {
  mocks.create.mockReset();
  delete process.env.ANTHROPIC_MODEL;
});

describe("reflectOnSession default chat", () => {
  it("uses Anthropic and parses the returned text block", async () => {
    mocks.create.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '[{"text":"Lead with compliance proof","confidence":0.9}]',
        },
      ],
    });

    const out = await reflectOnSession([
      { role: "user", text: "is it compliant?" },
      { role: "agent", text: "let me show the audit trail" },
    ]);

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-opus-4-8",
        max_tokens: 1024,
      })
    );
    expect(out).toEqual([
      { text: "Lead with compliance proof", confidence: 0.9 },
    ]);
  });

  it("treats a response with no text block as no learnings", async () => {
    mocks.create.mockResolvedValue({ content: [{ type: "tool_use" }] });

    await expect(
      reflectOnSession([{ role: "user", text: "hello" }])
    ).resolves.toEqual([]);
  });
});
