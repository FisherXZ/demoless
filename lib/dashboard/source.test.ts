import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RecapReport,
  SessionRecord,
  SessionSummary,
  TraceEvent,
} from "../sessions";

vi.mock("../sessions", () => ({
  loadSession: vi.fn(),
  loadRecap: vi.fn(),
  listSessions: vi.fn(async () => []),
  getBuyerSessions: vi.fn(async () => []),
}));

import { getBuyerSessions, loadRecap, loadSession, listSessions } from "../sessions";
import {
  dashboardHref,
  getLivePerson,
  getLiveSession,
  getRecapView,
  listLivePeople,
  listLiveSessions,
  listRecapSessions,
  liveKpis,
  resolveDashboardMode,
  traceEventLabel,
  type LiveSessionView,
} from "./source";

const mockLoadSession = vi.mocked(loadSession);
const mockLoadRecap = vi.mocked(loadRecap);
const mockListSessions = vi.mocked(listSessions);
const mockGetBuyerSessions = vi.mocked(getBuyerSessions);

const recap: RecapReport = {
  sessionId: "s1",
  generatedAt: 9,
  label: "hot",
  labelEvidence: [],
  summary: "ready to buy",
  whyTheyCame: { text: "", evidence: [] },
  buyingSignals: [],
  objectionsQuestions: [],
  gaps: [],
  nextAction: { text: "", evidence: [] },
  draftEmail: { subject: "", body: "" },
};

function summary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: "s1",
    company: "Browserbase",
    status: "live",
    buyerEmail: "bea@acme.com",
    buyerName: "Bea Builder",
    createdAt: 100,
    startedAt: 110,
    endedAt: undefined,
    durationSec: undefined,
    replayStatus: "pending",
    label: "hot",
    summary: "ready to buy",
    ...overrides,
  };
}

function record(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "s1",
    company: "Browserbase",
    status: "ended",
    buyerEmail: "bea@acme.com",
    buyerName: "Bea Builder",
    createdAt: 100,
    startedAt: 110,
    endedAt: 200,
    durationSec: 90,
    browserbaseSessionId: "bb1",
    liveViewUrl: "https://live.example.com",
    language: "en",
    replayStatus: "pending",
    replayUrl: "https://replay.example.com/bb1",
    events: [{ kind: "phase", phase: "demo", ts: 150 }],
    transcript: [{ role: "user", text: "show pricing", turn: 1, ts: 120 }],
    ...overrides,
  };
}

beforeEach(() => {
  mockLoadSession.mockReset();
  mockLoadRecap.mockReset();
  mockListSessions.mockReset().mockResolvedValue([]);
  mockGetBuyerSessions.mockReset().mockResolvedValue([]);
});

describe("getRecapView", () => {
  it("returns null when the session is unknown", async () => {
    mockLoadSession.mockResolvedValue(null);
    mockLoadRecap.mockResolvedValue({ status: "pending", recap: null });
    expect(await getRecapView("nope")).toBeNull();
  });

  it("returns the record + recap + status when present", async () => {
    mockLoadSession.mockResolvedValue(record());
    mockLoadRecap.mockResolvedValue({ status: "ready", recap });
    const v = await getRecapView("s1");
    expect(v).toMatchObject({ status: "ready" });
    expect(v!.record.id).toBe("s1");
    expect(v!.recap!.label).toBe("hot");
  });

  it("returns pending status when the recap is not ready yet", async () => {
    mockLoadSession.mockResolvedValue(record());
    mockLoadRecap.mockResolvedValue({ status: "pending", recap: null });
    const v = await getRecapView("s1");
    expect(v).toMatchObject({ status: "pending" });
    expect(v!.recap).toBeNull();
  });
});

describe("listRecapSessions", () => {
  it("delegates to the sessions store with the provided limit", async () => {
    mockListSessions.mockResolvedValue([summary()]);

    await expect(listRecapSessions(7)).resolves.toEqual([summary()]);
    expect(listSessions).toHaveBeenCalledWith(7);
  });
});

describe("dashboard live source helpers", () => {
  it("resolves dashboard mode and preserves it in dashboard links", () => {
    expect(resolveDashboardMode()).toBe("demo");
    expect(resolveDashboardMode({ mode: "live" })).toBe("live");
    expect(resolveDashboardMode({ mode: ["live", "demo"] })).toBe("live");
    expect(resolveDashboardMode({ mode: "other" })).toBe("demo");

    expect(dashboardHref("/dashboard", "live")).toBe("/dashboard?mode=live");
    expect(dashboardHref("/dashboard?tab=people", "demo")).toBe(
      "/dashboard?tab=people&mode=demo"
    );
  });

  it("projects live session summaries without fabricating transcript data", async () => {
    mockListSessions.mockResolvedValue([
      summary(),
      summary({
        id: "s2",
        company: "",
        status: "ended",
        buyerEmail: "solo@foo-bar.com",
        buyerName: "Solo",
        createdAt: 90,
        startedAt: undefined,
        endedAt: 140,
        replayStatus: "unavailable",
        label: "nurture",
        summary: "needs timing",
      }),
      summary({
        id: "s3",
        company: "",
        buyerEmail: "",
        buyerName: "",
        createdAt: 80,
        startedAt: undefined,
        endedAt: undefined,
        replayStatus: undefined,
        label: undefined,
        summary: undefined,
      }),
    ]);

    const views = await listLiveSessions(3);

    expect(mockListSessions).toHaveBeenCalledWith(3);
    expect(views[0]).toMatchObject({
      id: "s1",
      isLive: true,
      whenTs: 110,
      recapLabel: "hot",
      recapSummary: "ready to buy",
      transcript: [],
      events: [],
      buyer: {
        id: "bea%40acme.com",
        name: "Bea Builder",
        company: "Browserbase",
        initials: "BB",
      },
    });
    expect(views[1].buyer).toMatchObject({
      id: "solo%40foo-bar.com",
      name: "Solo",
      company: "Foo Bar",
      initials: "SO",
    });
    expect(views[1].whenTs).toBe(140);
    expect(views[2].buyer).toMatchObject({
      id: "",
      name: "",
      company: "Unknown",
      initials: "UN",
    });
    expect(views[2].whenTs).toBe(80);
  });

  it("hydrates a full live session and attaches a real recap when it exists", async () => {
    mockLoadSession.mockResolvedValue(record());
    mockLoadRecap.mockResolvedValue({ status: "ready", recap });

    const view = await getLiveSession("s1");

    expect(view).toMatchObject({
      id: "s1",
      isLive: false,
      whenTs: 200,
      durationSec: 90,
      language: "en",
      replayUrl: "https://replay.example.com/bb1",
      recapLabel: "hot",
      recapSummary: "ready to buy",
    });
    expect(view!.events).toEqual(record().events);
    expect(view!.transcript).toEqual(record().transcript);
  });

  it("returns null for missing live sessions and omits absent recaps", async () => {
    mockLoadSession.mockResolvedValueOnce(null);
    await expect(getLiveSession("missing")).resolves.toBeNull();

    mockLoadSession.mockResolvedValueOnce(record({ id: "s2" }));
    mockLoadRecap.mockResolvedValueOnce({ status: "pending", recap: null });
    const view = await getLiveSession("s2");
    expect(view!.recapLabel).toBeUndefined();
    expect(view!.recapSummary).toBeUndefined();
  });

  it("folds live people by buyer email and sorts them by last activity", async () => {
    mockListSessions.mockResolvedValue([
      summary({ id: "newer", buyerEmail: "bea@acme.com", endedAt: 400 }),
      summary({ id: "solo", buyerEmail: "solo@example.com", buyerName: "Solo", endedAt: 250 }),
      summary({ id: "older", buyerEmail: "bea@acme.com", endedAt: 200 }),
      summary({ id: "anonymous", buyerEmail: undefined }),
    ]);

    const people = await listLivePeople(4);

    expect(people.map((person) => person.email)).toEqual([
      "bea@acme.com",
      "solo@example.com",
    ]);
    expect(people[0]).toMatchObject({
      id: "bea%40acme.com",
      sessionCount: 2,
      lastSeenTs: 400,
    });
    expect(people[0].sessions.map((session) => session.id)).toEqual(["newer", "older"]);
  });

  it("hydrates one live person by decoded email", async () => {
    mockGetBuyerSessions.mockResolvedValue([
      record({ id: "s2", buyerEmail: "sales+one@acme.com", endedAt: 300 }),
      record({ id: "s1", buyerEmail: "sales+one@acme.com", endedAt: 200 }),
    ]);

    const person = await getLivePerson("sales%2Bone%40acme.com");

    expect(mockGetBuyerSessions).toHaveBeenCalledWith("sales+one@acme.com");
    expect(person).toMatchObject({
      id: "sales%2Bone%40acme.com",
      email: "sales+one@acme.com",
      sessionCount: 2,
      lastSeenTs: 300,
    });
    expect(person!.sessions.map((session) => session.id)).toEqual(["s2", "s1"]);
  });

  it("returns null when a live person has no persisted sessions", async () => {
    mockGetBuyerSessions.mockResolvedValue([]);

    await expect(getLivePerson("missing%40acme.com")).resolves.toBeNull();
  });

  it("derives factual live KPIs from live session rows", () => {
    const sessions = [
      { status: "live", isLive: true, browserbaseSessionId: "bb1" },
      { status: "ended", isLive: false, replayStatus: "pending" },
      { status: "created", isLive: false, replayStatus: "unavailable" },
    ] as LiveSessionView[];

    expect(liveKpis(sessions)).toEqual({
      total: 3,
      live: 1,
      ended: 1,
      withReplay: 2,
    });
  });

  it("labels every trace event kind for factual rendering", () => {
    const events: TraceEvent[] = [
      { kind: "user_said", text: "hello", ts: 1, turn: 1 },
      { kind: "agent_said", text: "hi", ts: 2, turn: 1 },
      { kind: "page_visited", url: "/dashboard", ts: 3, turn: 1 },
      { kind: "agent_action", action: "click", detail: "Click pricing", ts: 4, turn: 1 },
      { kind: "phase", phase: "demo", ts: 5 },
      { kind: "remember", note: "likes replay", ts: 6 },
    ];

    expect(events.map(traceEventLabel)).toEqual([
      { kind: "visitor", text: "hello" },
      { kind: "agent", text: "hi" },
      { kind: "page", text: "Visited /dashboard" },
      { kind: "click", text: "Click pricing" },
      { kind: "phase", text: "demo" },
      { kind: "noted", text: "likes replay" },
    ]);
  });
});
