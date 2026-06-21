import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory fake of the ioredis bits we use (matches lib/sessions/store.test.ts).
const hashes = new Map<string, Record<string, string>>();
const fake = {
  hset: vi.fn(async (key: string, obj: Record<string, string>) => {
    hashes.set(key, { ...(hashes.get(key) ?? {}), ...obj });
  }),
  hgetall: vi.fn(async (key: string) => hashes.get(key) ?? {}),
};
vi.mock("../../memory/redis", () => ({ getRedis: () => fake }));

import { packetKey, setExtractionStatus, savePacket, loadPacket } from "./store";
import type { SessionPacket } from "./types";

const packet: SessionPacket = {
  sessionId: "s1", generatedAt: 9,
  modelInfo: { provider: "anthropic", model: "claude-opus-4-8", promptVersion: "packet-v1" },
  summary: "good call",
  whyTheyCame: [], buyerBackground: [], painPoints: [], buyingSignals: [],
  objections: [], questions: [], workflowGaps: [], productGaps: [],
  productMoments: [], labels: ["hot"],
};

beforeEach(() => hashes.clear());

describe("packet store", () => {
  it("keys the packet under the session namespace", () => {
    expect(packetKey("s1")).toBe("demoless:session:s1:packet");
  });

  it("returns not_started when nothing is stored", async () => {
    expect(await loadPacket("missing")).toEqual({ status: "not_started", packet: null });
  });

  it("round-trips a packet and reports ready", async () => {
    await savePacket("s1", packet);
    const got = await loadPacket("s1");
    expect(got.status).toBe("ready");
    expect(got.packet).toEqual(packet);
  });

  it("records processing/failed status without a packet", async () => {
    await setExtractionStatus("s1", "processing");
    expect(await loadPacket("s1")).toEqual({ status: "processing", packet: null });
    await setExtractionStatus("s1", "failed", "boom");
    const got = await loadPacket("s1");
    expect(got.status).toBe("failed");
    expect(got.packet).toBeNull();
  });
});
