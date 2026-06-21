import { describe, expect, it, vi } from "vitest";
import { withSpeechKeepalive } from "./keepalive";

async function collect(source: AsyncIterable<{ type: string; text?: string }>) {
  const out: Array<{ type: string; text?: string }> = [];
  for await (const c of source) out.push(c);
  return out;
}

describe("withSpeechKeepalive", () => {
  it("speaks the bridge when the source is silent for longer than ms", async () => {
    vi.useFakeTimers();
    async function* slow() {
      await new Promise((r) => setTimeout(r, 1500));
      yield { type: "say", text: "Late reply." };
    }

    const pending = collect(withSpeechKeepalive(slow(), "Here's the payoff.", 1000));
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(500);
    const out = await pending;

    expect(out[0]).toEqual({ type: "say", text: "Here's the payoff." });
    expect(out[1]).toEqual({ type: "say", text: "Late reply." });
    vi.useRealTimers();
  });

  it("does not speak the bridge when say arrives quickly", async () => {
    async function* fast() {
      yield { type: "say", text: "Immediate." };
    }
    const out = await collect(withSpeechKeepalive(fast(), "Nope.", 1000));
    expect(out).toEqual([{ type: "say", text: "Immediate." }]);
  });
});
