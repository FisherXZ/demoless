import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory fake of the bits of ioredis we use (hset/hgetall/zadd/zrevrange).
const hashes = new Map<string, Record<string, string>>();
const zsets = new Map<string, { member: string; score: number }[]>();
const fake = {
  hset: vi.fn(async (key: string, obj: Record<string, string>) => {
    hashes.set(key, { ...(hashes.get(key) ?? {}), ...obj });
  }),
  hgetall: vi.fn(async (key: string) => hashes.get(key) ?? {}),
  zadd: vi.fn(async (key: string, score: number, member: string) => {
    const arr = zsets.get(key) ?? [];
    const next = arr.filter((e) => e.member !== member);
    next.push({ member, score });
    zsets.set(key, next);
  }),
  zrevrange: vi.fn(async (key: string, start: number, stop: number) => {
    const arr = [...(zsets.get(key) ?? [])].sort((a, b) => b.score - a.score);
    return arr.slice(start, stop + 1).map((e) => e.member);
  }),
};
vi.mock("../memory/redis", () => ({ getRedis: () => fake }));

import { saveSession, loadSession, saveRecap, loadRecap, listSessions } from "./store";
import type { RecapReport, SessionRecord } from "./types";

const record: SessionRecord = {
  id: "s1", company: "Acme", role: "Engineer", startedAt: 1, endedAt: 2,
  phaseReached: "CLOSE", replayUrl: "u",
  events: [{ kind: "user_said", text: "hi", turn: 1, ts: 1 }],
  transcript: [{ role: "user", text: "hi", turn: 1, ts: 1 }],
};
const recap: RecapReport = {
  sessionId: "s1", generatedAt: 9, label: "hot", labelEvidence: [],
  summary: "good call", whyTheyCame: { text: "", evidence: [] },
  buyingSignals: [], objectionsQuestions: [], gaps: [],
  nextAction: { text: "", evidence: [] }, draftEmail: { subject: "", body: "" },
};

beforeEach(() => { hashes.clear(); zsets.clear(); });

describe("sessions store", () => {
  it("round-trips a SessionRecord and indexes it", async () => {
    await saveSession(record);
    const got = await loadSession("s1");
    expect(got).toEqual(record);
    expect(await listSessions()).toEqual([{ id: "s1", company: "Acme", endedAt: 2, label: undefined, summary: undefined }]);
  });

  it("round-trips a RecapReport and reports ready status", async () => {
    await saveRecap("s1", recap);
    const got = await loadRecap("s1");
    expect(got.status).toBe("ready");
    expect(got.recap).toEqual(recap);
  });

  it("returns pending status when no recap exists", async () => {
    const got = await loadRecap("missing");
    expect(got).toEqual({ status: "pending", recap: null });
  });

  it("merges recap label/summary into the index after analysis", async () => {
    await saveSession(record);
    await saveRecap("s1", recap);
    const list = await listSessions();
    expect(list[0]).toMatchObject({ id: "s1", label: "hot", summary: "good call" });
  });

  it("returns null for an unknown session", async () => {
    expect(await loadSession("nope")).toBeNull();
  });
});
