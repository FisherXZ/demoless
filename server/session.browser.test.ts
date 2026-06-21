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
    });

    // Simulate audio_start control message
    const [[, handler]] = (ws.on as Mock).mock.calls.filter(
      (args: unknown[]) => args[0] === "message"
    );
    await handler(JSON.stringify({ t: "audio_start", language: "en" }), false);

    // Give async startSession time to resolve
    await new Promise((r) => setTimeout(r, 10));

    expect(fakeStartSession).toHaveBeenCalledWith(getDemoConfig().browseTargetUrl);

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
    });

    // Trigger audio_start so sessionId gets set
    const [[, msgHandler]] = (ws.on as Mock).mock.calls.filter(
      (args: unknown[]) => args[0] === "message"
    );
    await msgHandler(JSON.stringify({ t: "audio_start", language: "en" }), false);
    await new Promise((r) => setTimeout(r, 10));

    // Trigger close
    const closeHandlerCall = (ws.on as Mock).mock.calls.find(
      (args: unknown[]) => args[0] === "close"
    );
    await closeHandlerCall?.[1]?.();

    expect(fakeStopSession).toHaveBeenCalledWith("bb-session-456");
  });
});
