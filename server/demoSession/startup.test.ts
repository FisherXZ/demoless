import { describe, expect, it, vi } from "vitest";
import { createDemoSessionStartup } from "./startup";

describe("demo session startup", () => {
  it("prepares browser, orchestrator, buyer notes, and learnings behind one interface", async () => {
    const onLiveView = vi.fn();
    const orchestrator = { runTurn: vi.fn(async function* () {}) };
    const startSession = vi.fn(async (_url: string, onReady?: (url: string, sessionId: string) => void) => {
      onReady?.("https://live.example.com/early", "bb-123");
      return {
        liveViewUrl: "https://live.example.com/final",
        sessionId: "bb-123",
        url: "https://browserbase.test/",
        title: "Browserbase",
      };
    });
    const createOrchestrator = vi.fn(() => orchestrator);
    const loadBuyer = vi.fn(async () => ({
      profile: {
        email: "buyer@example.com",
        firstSeen: 1,
        lastSeen: 2,
        visitCount: 1,
      },
      notes: [
        {
          id: "n1",
          type: "interest" as const,
          text: "cares about session replay",
          importance: 0.8,
          ts: 3,
        },
      ],
      isReturning: false,
      recall: { line: "", topInterests: [], painPoints: [], objections: [] },
    }));
    const getLearnings = vi.fn(async () => [
      { id: "l1", text: "Show sessions before pricing.", confidence: 0.9, ts: 4 },
    ]);

    const startup = createDemoSessionStartup({
      startSession,
      createOrchestrator,
      loadBuyer,
      getLearnings,
      learningsEnabled: true,
      memoryEnabled: true,
      buildLearningsContext: (learnings) =>
        `Past demo learnings:\n${learnings.map((l) => `- ${l.text}`).join("\n")}`,
      getDemoConfig: () => ({
        company: "browserbase",
        productName: "Browserbase",
        persona: "Messi",
        browseTargetUrl: "https://browserbase.test/",
        corpusSeed: "browserbase",
      }),
      log: vi.fn(),
    });

    const prepared = await startup.prepare({
      buyerId: "buyer@example.com",
      onLiveView,
    });

    expect(startSession).toHaveBeenCalledWith(
      "https://browserbase.test/",
      expect.any(Function)
    );
    expect(onLiveView).toHaveBeenCalledWith(
      "https://live.example.com/early",
      "bb-123"
    );
    expect(createOrchestrator).toHaveBeenCalledWith({
      sessionId: "bb-123",
      buyerId: "buyer@example.com",
      company: "browserbase",
    });
    expect(loadBuyer).toHaveBeenCalledWith("buyer@example.com");
    expect(getLearnings).toHaveBeenCalledWith("browserbase");
    expect(prepared).toMatchObject({
      sessionId: "bb-123",
      liveViewUrl: "https://live.example.com/final",
      company: "browserbase",
      buyerNotes: ["cares about session replay"],
      learningsContext: "Past demo learnings:\n- Show sessions before pricing.",
      orchestrator,
    });
  });

  it("skips learnings entirely when disabled (default)", async () => {
    const getLearnings = vi.fn(async () => [
      { id: "l1", text: "Show sessions before pricing.", confidence: 0.9, ts: 4 },
    ]);
    const buildLearningsContext = vi.fn(() => "should not be used");

    const startup = createDemoSessionStartup({
      startSession: vi.fn(async () => ({
        liveViewUrl: "https://live.example.com/final",
        sessionId: "bb-123",
        url: "https://browserbase.test/",
        title: "Browserbase",
      })),
      createOrchestrator: vi.fn(() => ({ runTurn: vi.fn(async function* () {}) })),
      loadBuyer: vi.fn(async () => ({
        profile: { email: "buyer@example.com", firstSeen: 1, lastSeen: 2, visitCount: 1 },
        notes: [],
        isReturning: false,
        recall: { line: "", topInterests: [], painPoints: [], objections: [] },
      })),
      getLearnings,
      buildLearningsContext,
      learningsEnabled: false,
      getDemoConfig: () => ({
        company: "browserbase",
        productName: "Browserbase",
        persona: "Messi",
        browseTargetUrl: "https://browserbase.test/",
        corpusSeed: "browserbase",
      }),
      log: vi.fn(),
    });

    const prepared = await startup.prepare({
      buyerId: "buyer@example.com",
      onLiveView: vi.fn(),
    });

    expect(getLearnings).not.toHaveBeenCalled();
    expect(buildLearningsContext).not.toHaveBeenCalled();
    expect(prepared.learningsContext).toBe("");
  });

  it("skips buyer memory entirely when disabled (default)", async () => {
    const loadBuyer = vi.fn(async () => ({
      profile: { email: "buyer@example.com", firstSeen: 1, lastSeen: 2, visitCount: 3 },
      notes: [
        { id: "n1", type: "interest" as const, text: "cares about session replay", importance: 0.8, ts: 3 },
      ],
      isReturning: true,
      recall: {
        line: "Welcome back — last time you were focused on session replay.",
        topInterests: [],
        painPoints: [],
        objections: [],
      },
    }));

    const startup = createDemoSessionStartup({
      startSession: vi.fn(async () => ({
        liveViewUrl: "https://live.example.com/final",
        sessionId: "bb-123",
        url: "https://browserbase.test/",
        title: "Browserbase",
      })),
      createOrchestrator: vi.fn(() => ({ runTurn: vi.fn(async function* () {}) })),
      loadBuyer,
      getLearnings: vi.fn(async () => []),
      buildLearningsContext: vi.fn(() => ""),
      // memoryEnabled omitted → defaults off
      getDemoConfig: () => ({
        company: "browserbase",
        productName: "Browserbase",
        persona: "Messi",
        browseTargetUrl: "https://browserbase.test/",
        corpusSeed: "browserbase",
      }),
      log: vi.fn(),
    });

    const prepared = await startup.prepare({
      buyerId: "buyer@example.com",
      onLiveView: vi.fn(),
    });

    expect(loadBuyer).not.toHaveBeenCalled();
    expect(prepared.buyer).toBeUndefined();
    expect(prepared.buyerNotes).toEqual([]);
  });

  it("prewarms once and lets the next prepare adopt the warm browser", async () => {
    let now = 1_000;
    const onLiveView = vi.fn();
    const startSession = vi.fn(async () => ({
      liveViewUrl: "https://live.example.com/warm",
      sessionId: "warm-1",
      url: "https://browserbase.test/",
      title: "Browserbase",
    }));
    const createOrchestrator = vi.fn(() => ({
      runTurn: vi.fn(async function* () {}),
    }));

    const startup = createDemoSessionStartup({
      startSession,
      createOrchestrator,
      loadBuyer: vi.fn(async () => ({
        profile: { email: "buyer@example.com", firstSeen: 1, lastSeen: 2, visitCount: 1 },
        notes: [],
        isReturning: false,
        recall: { line: "", topInterests: [], painPoints: [], objections: [] },
      })),
      getLearnings: vi.fn(async () => []),
      buildLearningsContext: vi.fn(() => ""),
      getDemoConfig: () => ({
        company: "browserbase",
        productName: "Browserbase",
        persona: "Messi",
        browseTargetUrl: "https://browserbase.test/",
        corpusSeed: "browserbase",
      }),
      now: () => now,
    });

    await startup.prewarm();
    await startup.prewarm();

    const prepared = await startup.prepare({
      buyerId: "buyer@example.com",
      onLiveView,
    });

    expect(startSession).toHaveBeenCalledTimes(1);
    expect(onLiveView).not.toHaveBeenCalled();
    expect(prepared.sessionId).toBe("warm-1");
    expect(prepared.liveViewUrl).toBe("https://live.example.com/warm");

    now += 1;
    await startup.prewarm();
    expect(startSession).toHaveBeenCalledTimes(2);
  });

  it("expires stale warm sessions before preparing a new browser", async () => {
    let now = 1_000;
    const startSession = vi
      .fn()
      .mockResolvedValueOnce({
        liveViewUrl: "https://live.example.com/warm",
        sessionId: "warm-1",
        url: "https://browserbase.test/",
        title: "Browserbase",
      })
      .mockResolvedValueOnce({
        liveViewUrl: "https://live.example.com/fresh",
        sessionId: "fresh-1",
        url: "https://browserbase.test/",
        title: "Browserbase",
      });
    const onLiveView = vi.fn();

    const startup = createDemoSessionStartup({
      startSession,
      createOrchestrator: vi.fn(() => ({
        runTurn: vi.fn(async function* () {}),
      })),
      loadBuyer: vi.fn(async () => ({
        profile: { email: "buyer@example.com", firstSeen: 1, lastSeen: 2, visitCount: 1 },
        notes: [],
        isReturning: false,
        recall: { line: "", topInterests: [], painPoints: [], objections: [] },
      })),
      getLearnings: vi.fn(async () => []),
      buildLearningsContext: vi.fn(() => ""),
      getDemoConfig: () => ({
        company: "browserbase",
        productName: "Browserbase",
        persona: "Messi",
        browseTargetUrl: "https://browserbase.test/",
        corpusSeed: "browserbase",
      }),
      now: () => now,
    });

    await startup.prewarm();
    now += 121_000;

    const prepared = await startup.prepare({
      buyerId: "buyer@example.com",
      onLiveView,
    });

    expect(prepared.sessionId).toBe("fresh-1");
    expect(startSession).toHaveBeenCalledTimes(2);
  });

  it("swallows prewarm and context-loading failures", async () => {
    const log = vi.fn();
    const startup = createDemoSessionStartup({
      startSession: vi
        .fn()
        .mockRejectedValueOnce(new Error("warm failed"))
        .mockResolvedValueOnce({
          liveViewUrl: "https://live.example.com/final",
          sessionId: "bb-123",
          url: "https://browserbase.test/",
          title: "Browserbase",
        }),
      createOrchestrator: vi.fn(() => ({
        runTurn: vi.fn(async function* () {}),
      })),
      loadBuyer: vi.fn(async () => {
        throw new Error("redis down");
      }),
      getLearnings: vi.fn(async () => {
        throw new Error("learnings down");
      }),
      learningsEnabled: true,
      memoryEnabled: true,
      getDemoConfig: () => ({
        company: "browserbase",
        productName: "Browserbase",
        persona: "Messi",
        browseTargetUrl: "https://browserbase.test/",
        corpusSeed: "browserbase",
      }),
      log,
    });

    await expect(startup.prewarm()).resolves.toBeUndefined();
    const prepared = await startup.prepare({
      buyerId: "buyer@example.com",
      onLiveView: vi.fn(),
    });

    expect(prepared.buyer).toBeUndefined();
    expect(prepared.buyerNotes).toEqual([]);
    expect(prepared.learningsContext).toBe("");
    expect(log).not.toHaveBeenCalled();
  });
});
