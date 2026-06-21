import { describe, it, expect, vi, type Mock } from "vitest";
import { getDemoConfig } from "./config/demoConfig";

// We test VoiceSession with fake deps injected via the optional ctor param.
// Import after mocking the real modules it would otherwise load at module-init time.
vi.mock("./deepgram/stt", () => ({
  DeepgramStt: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    sendAudio: vi.fn(),
  })),
}));
vi.mock("./tts", () => ({
  createTts: vi.fn().mockReturnValue({
    synthesize: vi.fn().mockReturnValue((async function* () {})()),
    voiceName: vi.fn().mockReturnValue("Maya"),
  }),
}));
vi.mock("./bargeIn", () => ({
  readBargeConfig: vi.fn().mockReturnValue({ mode: "off" }),
  novelWordCount: vi.fn().mockReturnValue(0),
  tokenize: vi.fn().mockReturnValue([]),
}));
vi.mock("../lib/memory/store", () => ({
  loadBuyer: vi.fn().mockResolvedValue({
    profile: {
      email: "anonymous",
      firstSeen: 0,
      lastSeen: 0,
      visitCount: 1,
    },
    notes: [],
    isReturning: false,
    recall: { line: "", topInterests: [], painPoints: [], objections: [] },
  }),
}));
vi.mock("../lib/memory/pubsub", () => ({
  publishPhase: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/learnings", () => ({
  getLearnings: vi.fn().mockResolvedValue([]),
  buildLearningsContext: vi.fn().mockReturnValue(""),
  reflectAndStore: vi.fn().mockResolvedValue(undefined),
}));

import { VoiceSession } from "./session";

function makeWs() {
  const sent: string[] = [];
  return {
    OPEN: 1,
    readyState: 1 as number,
    send: vi.fn((data: string) => sent.push(data)),
    on: vi.fn(),
    sent,
  };
}

async function waitForEvent(ws: ReturnType<typeof makeWs>, eventType: string) {
  for (let i = 0; i < 25; i++) {
    const events = ws.sent.map((s) => JSON.parse(s) as { t: string });
    const event = events.find((e) => e.t === eventType);
    if (event) return event;
    await new Promise((r) => setTimeout(r, 1));
  }
  throw new Error(`Timed out waiting for ${eventType}`);
}

describe("VoiceSession — browser session ownership", () => {
  it("calls startSession with browseTargetUrl and emits live_view with the URL", async () => {
    const ws = makeWs();

    const fakeStartSession = vi.fn().mockResolvedValue({
      liveViewUrl: "https://live.example.com/view",
      sessionId: "bb-session-123",
      url: "https://www.browserbase.com",
      title: "Browserbase",
    });
    const fakeStopSession = vi.fn().mockResolvedValue(undefined);
    const fakeOrchestrator = {
      runTurn: vi.fn(async function* () {}),
      greeting: vi.fn().mockReturnValue(null),
    };
    const fakeCreateOrchestrator = vi.fn().mockReturnValue(fakeOrchestrator);

    new VoiceSession(ws as unknown as import("ws").WebSocket, "dg-key", {
      startSession: fakeStartSession,
      stopSession: fakeStopSession,
      createOrchestrator: fakeCreateOrchestrator,
      saveSession: vi.fn().mockResolvedValue(undefined),
      loadSession: vi.fn().mockResolvedValue(null),
      analyzeAndStore: vi.fn().mockResolvedValue(undefined),
    });

    // Simulate audio_start control message
    const [[, handler]] = (ws.on as Mock).mock.calls.filter(
      (args: unknown[]) => args[0] === "message"
    );
    await handler(
      JSON.stringify({
        t: "audio_start",
        language: "en",
        buyer: { demoSessionId: "demo-1", buyerEmail: "buyer@example.com" },
      }),
      false
    );

    await waitForEvent(ws, "ready");

    // Cold-start path passes the target URL plus an early live-view callback.
    expect(fakeStartSession).toHaveBeenCalledWith(
      getDemoConfig().browseTargetUrl,
      expect.any(Function)
    );

    const events = ws.sent.map((s) => JSON.parse(s) as { t: string; url?: string });
    const liveView = events.find((e) => e.t === "live_view");
    expect(liveView).toBeDefined();
    expect(liveView?.url).toBe("https://live.example.com/view");

    expect(fakeCreateOrchestrator).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "bb-session-123" })
    );
  });

  it("calls stopSession on ws close", async () => {
    const ws = makeWs();

    const fakeStartSession = vi.fn().mockResolvedValue({
      liveViewUrl: "https://live.example.com/view",
      sessionId: "bb-session-456",
      url: "https://www.browserbase.com",
      title: "",
    });
    const fakeStopSession = vi.fn().mockResolvedValue(undefined);
    const fakeCreateOrchestrator = vi.fn().mockReturnValue({
      runTurn: vi.fn(async function* () {}),
      greeting: vi.fn().mockReturnValue(null),
    });

    new VoiceSession(ws as unknown as import("ws").WebSocket, "dg-key", {
      startSession: fakeStartSession,
      stopSession: fakeStopSession,
      createOrchestrator: fakeCreateOrchestrator,
      saveSession: vi.fn().mockResolvedValue(undefined),
      loadSession: vi.fn().mockResolvedValue(null),
      analyzeAndStore: vi.fn().mockResolvedValue(undefined),
    });

    // Trigger audio_start so sessionId gets set
    const [[, msgHandler]] = (ws.on as Mock).mock.calls.filter(
      (args: unknown[]) => args[0] === "message"
    );
    await msgHandler(
      JSON.stringify({
        t: "audio_start",
        language: "en",
        buyer: { demoSessionId: "demo-1", buyerEmail: "buyer@example.com" },
      }),
      false
    );
    await waitForEvent(ws, "ready");

    // Trigger close
    const closeHandlerCall = (ws.on as Mock).mock.calls.find(
      (args: unknown[]) => args[0] === "close"
    );
    await closeHandlerCall?.[1]?.();

    expect(fakeStopSession).toHaveBeenCalledWith("bb-session-456");
  });

  it("still stops the browser when finalization throws during close", async () => {
    const ws = makeWs();

    const fakeStartSession = vi.fn().mockResolvedValue({
      liveViewUrl: "https://live.example.com/view",
      sessionId: "bb-session-finalizer-fails",
      url: "https://www.browserbase.com",
      title: "",
    });
    const fakeStopSession = vi.fn().mockResolvedValue(undefined);
    const fakeCreateOrchestrator = vi.fn().mockReturnValue({
      runTurn: vi.fn(async function* () {}),
      greeting: vi.fn().mockReturnValue(null),
    });
    const fakeFinalizer = {
      finalize: vi.fn(() => {
        throw new Error("finalizer failed");
      }),
    };

    new VoiceSession(ws as unknown as import("ws").WebSocket, "dg-key", {
      startSession: fakeStartSession,
      stopSession: fakeStopSession,
      createOrchestrator: fakeCreateOrchestrator,
      finalizer: fakeFinalizer,
      saveSession: vi.fn().mockResolvedValue(undefined),
      loadSession: vi.fn().mockResolvedValue(null),
      analyzeAndStore: vi.fn().mockResolvedValue(undefined),
    });

    const [[, msgHandler]] = (ws.on as Mock).mock.calls.filter(
      (args: unknown[]) => args[0] === "message"
    );
    await msgHandler(
      JSON.stringify({
        t: "audio_start",
        language: "en",
        buyer: { demoSessionId: "demo-1", buyerEmail: "buyer@example.com" },
      }),
      false
    );
    await waitForEvent(ws, "ready");

    const closeHandlerCall = (ws.on as Mock).mock.calls.find(
      (args: unknown[]) => args[0] === "close"
    );
    const close = closeHandlerCall?.[1] as () => void;

    expect(close).not.toThrow();
    expect(fakeFinalizer.finalize).toHaveBeenCalled();
    expect(fakeStopSession).toHaveBeenCalledWith("bb-session-finalizer-fails");
  });

  it("can stop the browser if the socket closes after early live_view but before startup resolves", async () => {
    const ws = makeWs();

    const fakeStartSession = vi.fn(
      (_url: string, onLiveView?: (liveViewUrl: string, sessionId: string) => void) =>
        new Promise<{
          liveViewUrl: string;
          sessionId: string;
          url: string;
          title: string;
        }>(() => {
          onLiveView?.("https://live.example.com/early", "bb-session-early");
        })
    );
    const fakeStopSession = vi.fn().mockResolvedValue(undefined);
    const fakeCreateOrchestrator = vi.fn();

    new VoiceSession(ws as unknown as import("ws").WebSocket, "dg-key", {
      startSession: fakeStartSession,
      stopSession: fakeStopSession,
      createOrchestrator: fakeCreateOrchestrator,
      saveSession: vi.fn().mockResolvedValue(undefined),
      loadSession: vi.fn().mockResolvedValue(null),
      analyzeAndStore: vi.fn().mockResolvedValue(undefined),
    });

    const [[, msgHandler]] = (ws.on as Mock).mock.calls.filter(
      (args: unknown[]) => args[0] === "message"
    );
    await msgHandler(
      JSON.stringify({
        t: "audio_start",
        language: "en",
        buyer: { demoSessionId: "demo-1", buyerEmail: "buyer@example.com" },
      }),
      false
    );

    const closeHandlerCall = (ws.on as Mock).mock.calls.find(
      (args: unknown[]) => args[0] === "close"
    );
    await closeHandlerCall?.[1]?.();

    expect(fakeStopSession).toHaveBeenCalledWith("bb-session-early");
    expect(fakeCreateOrchestrator).not.toHaveBeenCalled();
  });
});
