import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Command } from "../shared/contract";

// Mock Layer 2 so we control exactly what the loop receives.
const mockComplete = vi.fn();
vi.mock("./model", () => ({ complete: (...a: unknown[]) => mockComplete(...a) }));

import { Loop } from "./loop";

// The loop serializes turns on an internal promise chain; flush microtasks.
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("Loop", () => {
  beforeEach(() => mockComplete.mockReset());

  it("dispatches say + navigate on a human turn", async () => {
    mockComplete.mockResolvedValue({
      commands: [
        { kind: "say", text: "ok" },
        { kind: "navigate", target: "dashboard" },
      ],
    });
    const loop = new Loop("s1", "u1");
    const got: Command[] = [];
    loop.onCommand((c) => got.push(c));
    loop.send({ kind: "user_said", text: "show me", final: true });
    await flush();
    expect(got.map((c) => c.kind)).toEqual(["say", "navigate"]);
  });

  it("strips navigate/click_or_type on a screen (narrate-only) turn", async () => {
    mockComplete.mockResolvedValue({
      commands: [
        { kind: "say", text: "this page shows X" },
        { kind: "navigate", target: "elsewhere" }, // must be dropped
      ],
    });
    const loop = new Loop("s1", "u1");
    const got: Command[] = [];
    loop.onCommand((c) => got.push(c));
    loop.send({ kind: "screen_is_on", url: "/dashboard", summary: "the dashboard" });
    await flush();
    expect(got.map((c) => c.kind)).toEqual(["say"]); // navigate stripped
  });

  it("ignores non-final user_said", async () => {
    mockComplete.mockResolvedValue({ commands: [{ kind: "say", text: "x" }] });
    const loop = new Loop("s1", "u1");
    const got: Command[] = [];
    loop.onCommand((c) => got.push(c));
    loop.send({ kind: "user_said", text: "partial", final: false });
    await flush();
    expect(got).toHaveLength(0);
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it("applies tour:advance to the bookmark (clamped to selected length)", async () => {
    mockComplete.mockResolvedValue({ commands: [{ kind: "say", text: "next" }], tour: "advance" });
    const loop = new Loop("s1", "u1");
    // seed a selected subset so advance has room
    (loop.getState() as { selected: string[] }).selected = ["a", "b", "c"];
    loop.send({ kind: "user_said", text: "next", final: true });
    await flush();
    expect(loop.getState().tourIndex).toBe(1);
  });

  it("applies object tour jumps within the selected catalog bounds", async () => {
    mockComplete.mockResolvedValue({ commands: [], tour: { jump: 10 } });
    const loop = new Loop("s1", "u1");
    (loop.getState() as { selected: string[] }).selected = ["a", "b", "c"];

    loop.send({ kind: "user_said", text: "jump", final: true });
    await flush();

    expect(loop.getState().tourIndex).toBe(2);
  });

  it("buyer_loaded updates state without a turn", async () => {
    const loop = new Loop("s1", "u1");
    const got: Command[] = [];
    loop.onCommand((c) => got.push(c));
    loop.send({ kind: "buyer_loaded", buyer: { id: "u1", notes: [] } });
    await flush();
    expect(got).toHaveLength(0);
    expect(loop.getState().buyer?.id).toBe("u1");
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it("logs a failed turn and keeps the queue usable for the next turn", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockComplete
      .mockRejectedValueOnce(new Error("model failed"))
      .mockResolvedValueOnce({ commands: [{ kind: "say", text: "recovered" }] });
    const loop = new Loop("s1", "u1");
    const got: Command[] = [];
    loop.onCommand((c) => got.push(c));

    loop.send({ kind: "user_said", text: "first", final: true });
    await flush();
    loop.send({ kind: "user_said", text: "second", final: true });
    await flush();

    expect(error).toHaveBeenCalledWith("[loop] turn failed:", expect.any(Error));
    expect(got).toEqual([{ kind: "say", text: "recovered" }]);
    error.mockRestore();
  });
});
