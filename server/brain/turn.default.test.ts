import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  streamWithTools: vi.fn(),
}));

vi.mock("../model", () => ({
  streamWithTools: mocks.streamWithTools,
}));

import { runTurn } from "./turn";

beforeEach(() => {
  mocks.streamWithTools.mockReset();
});

describe("runTurn default stream", () => {
  it("uses the model stream when no stream override is provided", async () => {
    mocks.streamWithTools.mockImplementation(async function* () {
      yield { kind: "text", delta: "Default stream." };
      yield { kind: "end" };
    });

    const out: unknown[] = [];
    const executor = { phase: "HOOK", run: vi.fn() };
    for await (const command of runTurn({
      system: "s",
      messages: [],
      executor: executor as any,
      signal: new AbortController().signal,
    })) {
      out.push(command);
    }

    expect(mocks.streamWithTools).toHaveBeenCalledWith(
      expect.objectContaining({ system: "s" })
    );
    expect(out).toEqual([
      { type: "say", text: "Default stream." },
      { type: "done" },
    ]);
  });
});
