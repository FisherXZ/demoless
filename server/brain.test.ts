// server/brain.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const mockComplete = vi.fn();
vi.mock("./model", () => ({ complete: (...a: unknown[]) => mockComplete(...a) }));
import { Loop } from "./loop";
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("brain: phase + selection", () => {
  beforeEach(() => mockComplete.mockReset());

  it("advances phase when the reply sets one", async () => {
    mockComplete.mockResolvedValue({ commands: [{ kind: "say", text: "q?" }], phase: "DISCOVERY" });
    const loop = new Loop("s", "u");
    loop.send({ kind: "user_said", text: "hi", final: true });
    await flush();
    expect(loop.getState().phase).toBe("DISCOVERY");
  });

  it("applies select to the bookmark subset", async () => {
    mockComplete.mockResolvedValue({
      commands: [{ kind: "say", text: "let me show you" }],
      phase: "WALKTHROUGH",
      select: ["automation", "analytics"],
    });
    const loop = new Loop("s", "u");
    loop.send({ kind: "user_said", text: "we waste time and can't measure", final: true });
    await flush();
    expect(loop.getState().selected).toEqual(["automation", "analytics"]);
    expect(loop.getState().tourIndex).toBe(0);
  });

  it("ignores select ids not in the catalog", async () => {
    mockComplete.mockResolvedValue({ commands: [], select: ["automation", "bogus"] });
    const loop = new Loop("s", "u");
    loop.send({ kind: "user_said", text: "x", final: true });
    await flush();
    expect(loop.getState().selected).toEqual(["automation"]); // bogus dropped
  });
});
