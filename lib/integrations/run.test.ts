import { describe, it, expect, vi, beforeEach } from "vitest";

const recordActions = vi.fn();
vi.mock("./store", () => ({ recordActions: (...a: unknown[]) => recordActions(...a) }));

import { dispatchIntegrations } from "./run";
import type { SessionRecord } from "../sessions/types";
import type { SessionPacket } from "../sessions/packet/types";

const record = { id: "s1", company: "Acme", status: "ended", createdAt: 0, events: [], transcript: [] } as SessionRecord;
const packet = {
  sessionId: "s1", generatedAt: 1, modelInfo: { provider: "a", model: "m", promptVersion: "1" },
  summary: "s", whyTheyCame: [], buyerBackground: [], painPoints: [], buyingSignals: [],
  objections: [], questions: [], workflowGaps: [], productGaps: [], productMoments: [], labels: [],
} as SessionPacket;

// Block body, not a concise arrow: mockReset() returns the mock (a callable),
// and vitest treats a function returned from beforeEach as a teardown callback
// it then invokes — which would re-call recordActions and throw mid-teardown.
beforeEach(() => {
  recordActions.mockReset();
});

describe("dispatchIntegrations", () => {
  it("records the built actions", async () => {
    recordActions.mockResolvedValue([{ id: "x" }]);
    await dispatchIntegrations(record, packet);
    expect(recordActions).toHaveBeenCalledOnce();
    // hubspot + clay always emit, no gaps → 2 drafts
    expect(recordActions.mock.calls[0][0]).toHaveLength(2);
  });

  it("swallows a store failure", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    recordActions.mockRejectedValue(new Error("redis down"));
    await dispatchIntegrations(record, packet);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
