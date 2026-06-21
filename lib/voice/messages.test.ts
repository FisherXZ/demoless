import { describe, it, expect } from "vitest";
import { parseServerEvent } from "./messages";

describe("voice contract extensions", () => {
  it("parses a live_view event", () => {
    expect(parseServerEvent(JSON.stringify({ t: "live_view", url: "https://x" })))
      .toEqual({ t: "live_view", url: "https://x" });
  });
  it("parses a set_phase event", () => {
    expect(parseServerEvent(JSON.stringify({ t: "set_phase", phase: "DISCOVERY" })))
      .toEqual({ t: "set_phase", phase: "DISCOVERY" });
  });
});
