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

import {
  createSession, saveSession, loadSession, saveRecap, loadRecap,
  listSessions, getBuyerSessions,
} from "./store";
import type { RecapReport, SessionRecord } from "./types";

const record: SessionRecord = {
  id: "s1", company: "Acme", status: "ended", buyerEmail: "buyer@acme.com",
  buyerName: "Bea", role: "Engineer", createdAt: 1, startedAt: 2, endedAt: 3,
  durationSec: 1, phaseReached: "CLOSE", browserbaseSessionId: "bb1",
  liveViewUrl: "lv", language: "en", replayStatus: "pending", replayUrl: "u",
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
    expect(await listSessions()).toEqual([
      {
        id: "s1", company: "Acme", status: "ended", buyerEmail: "buyer@acme.com",
        buyerName: "Bea", createdAt: 1, startedAt: 2, endedAt: 3, durationSec: 1,
        replayStatus: "pending", label: undefined, summary: undefined,
      },
    ]);
  });

  it("creates a session up-front with an app-owned id and status 'created'", async () => {
    const s = await createSession({ buyerEmail: "New@Acme.com", buyerName: "Nia" });
    expect(s.id).toBeTruthy();
    expect(s.status).toBe("created");
    expect(s.buyerEmail).toBe("new@acme.com"); // normalized
    const got = await loadSession(s.id);
    expect(got).toMatchObject({ id: s.id, status: "created", buyerEmail: "new@acme.com", buyerName: "Nia" });
  });

  it("indexes sessions per buyer for the people directory", async () => {
    const a1 = await createSession({ buyerEmail: "p@x.com", buyerName: "P" });
    const a2 = await createSession({ buyerEmail: "p@x.com" });
    await createSession({ buyerEmail: "other@x.com" });
    const sessions = await getBuyerSessions("P@x.com"); // normalized lookup
    expect(sessions.map((s) => s.id).sort()).toEqual([a1.id, a2.id].sort());
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
