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
      select: ["sessions", "live-view"],
    });
    const loop = new Loop("s", "u");
    loop.send({
      kind: "user_said",
      text: "we waste time running browsers and need to debug them",
      final: true,
    });
    await flush();
    expect(loop.getState().selected).toEqual(["sessions", "live-view"]);
    expect(loop.getState().tourIndex).toBe(0);
  });

  it("ignores select ids not in the catalog", async () => {
    mockComplete.mockResolvedValue({ commands: [], select: ["sessions", "bogus"] });
    const loop = new Loop("s", "u");
    loop.send({ kind: "user_said", text: "x", final: true });
    await flush();
    expect(loop.getState().selected).toEqual(["sessions"]); // bogus dropped
  });
});
