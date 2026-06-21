import { describe, it, expect, vi, type Mock } from "vitest";

vi.mock("./deepgram/stt", () => ({
  DeepgramStt: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    sendAudio: vi.fn(),
  })),
}));
vi.mock("./tts", () => {
  // Simulates TTS that yields one chunk per sentence (fast, synchronous-ish).
  const synthesize = vi.fn().mockImplementation(async function* () {
    yield Buffer.from("audio");
  });
  return {
    createTts: vi.fn().mockReturnValue({
      synthesize,
      voiceName: vi.fn().mockReturnValue("Maya"),
    }),
  };
});
vi.mock("./bargeIn", () => ({
  readBargeConfig: vi.fn().mockReturnValue({ mode: "off" }),
  novelWordCount: vi.fn().mockReturnValue(0),
  tokenize: vi.fn().mockReturnValue([]),
}));
// The session loads buyer memory at startup; stub it so the turn isn't blocked
// behind a (missing) live Redis connection.
vi.mock("../lib/memory/store", () => ({
  loadBuyer: vi.fn().mockResolvedValue({
    profile: { email: "anonymous" },
    notes: [],
    isReturning: false,
    recall: null,
  }),
}));
vi.mock("../lib/memory/pubsub", () => ({
  publishPhase: vi.fn().mockResolvedValue(undefined),
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

/**
 * Build a fake orchestrator that streams `sentences` one by one, but after
 * the first sentence is yielded it waits `holdMs` so the test can barge-in
 * before the rest are yielded.
 */
function makeSlowOrchestrator(sentences: string[], holdMs = 50) {
  return {
    greeting: vi.fn().mockReturnValue(null),
    runTurn: vi.fn(async function* (_input: unknown, _ctx: unknown, signal: AbortSignal) {
      for (const s of sentences) {
        if (signal.aborted) return;
        yield { type: "say", text: s };
        // Pause between sentences so caller can abort
        await new Promise<void>((res) => setTimeout(res, holdMs));
        if (signal.aborted) return;
      }
    }),
  };
}

describe("VoiceSession — barge-in history recording", () => {
  it("records only spoken sentences when turn is aborted mid-stream", async () => {
    const ws = makeWs();
    const sentences = ["Sentence one.", "Sentence two.", "Sentence three."];
    const fakeOrchestrator = makeSlowOrchestrator(sentences, 80);

    const session = new VoiceSession(
      ws as unknown as import("ws").WebSocket,
      "dg-key",
      {
        startSession: vi.fn().mockResolvedValue({
          liveViewUrl: "https://live.example.com",
          sessionId: "s1",
          url: "https://www.browserbase.com",
          title: "",
        }),
        stopSession: vi.fn().mockResolvedValue(undefined),
        createOrchestrator: vi.fn().mockReturnValue(fakeOrchestrator),
        saveSession: vi.fn().mockResolvedValue(undefined),
        loadSession: vi.fn().mockResolvedValue(null),
        analyzeAndStore: vi.fn().mockResolvedValue(undefined),
      }
    );

    // Trigger audio_start
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
    await new Promise((r) => setTimeout(r, 10)); // let startSession resolve

    // Send text input — starts a turn
    await msgHandler(
      JSON.stringify({ t: "text_input", text: "tell me about pricing" }),
      false
    );

    // Wait for first sentence to be spoken (it takes ~80ms hold time), then barge-in
    // before the second sentence is yielded.
    await new Promise((r) => setTimeout(r, 40));
    await msgHandler(JSON.stringify({ t: "barge_in" }), false);

    // Wait for the turn to fully settle
    await new Promise((r) => setTimeout(r, 200));

    // Check the agent_state events and the say events sent — at least one "say"
    const events = ws.sent.map((s) => JSON.parse(s) as { t: string; text?: string });
    const saySentences = events.filter((e) => e.t === "say").map((e) => e.text);

    // We expect exactly 1 "say" sentence was emitted before the barge-in
    expect(saySentences).toContain("Sentence one.");
    expect(saySentences).not.toContain("Sentence two.");

    // The next turn (text_input after barge-in) should see previous agent turn in history.
    // Drive a second turn and check the orchestrator received the spoken-only history.
    await msgHandler(
      JSON.stringify({ t: "text_input", text: "what about integrations?" }),
      false
    );
    await new Promise((r) => setTimeout(r, 200));

    const lastCall = (fakeOrchestrator.runTurn as Mock).mock.calls.at(-1);
    const history = lastCall?.[1]?.history as Array<{ role: string; text: string }>;
    const agentTurns = history?.filter((h) => h.role === "agent");

    // The agent turn in history should contain only the spoken sentence.
    expect(agentTurns?.length).toBeGreaterThan(0);
    expect(agentTurns?.[0]?.text).toBe("Sentence one.");
    expect(agentTurns?.[0]?.text).not.toContain("Sentence two.");
  });

  it("records nothing when no sentences were spoken before barge-in", async () => {
    const ws = makeWs();
    // Orchestrator holds immediately (never yields before abort)
    const fakeOrchestrator = makeSlowOrchestrator(["Only sentence."], 500);

    new VoiceSession(
      ws as unknown as import("ws").WebSocket,
      "dg-key",
      {
        startSession: vi.fn().mockResolvedValue({
          liveViewUrl: "https://live.example.com",
          sessionId: "s2",
          url: "https://www.browserbase.com",
          title: "",
        }),
        stopSession: vi.fn().mockResolvedValue(undefined),
        createOrchestrator: vi.fn().mockReturnValue(fakeOrchestrator),
        saveSession: vi.fn().mockResolvedValue(undefined),
        loadSession: vi.fn().mockResolvedValue(null),
        analyzeAndStore: vi.fn().mockResolvedValue(undefined),
      }
    );

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
    await new Promise((r) => setTimeout(r, 10));

    await msgHandler(
      JSON.stringify({ t: "text_input", text: "tell me about pricing" }),
      false
    );

    // Barge-in immediately before TTS for first sentence could play
    await msgHandler(JSON.stringify({ t: "barge_in" }), false);
    await new Promise((r) => setTimeout(r, 600));

    // Follow-up turn — history should have NO agent turn (nothing was spoken)
    await msgHandler(
      JSON.stringify({ t: "text_input", text: "integrations?" }),
      false
    );
    await new Promise((r) => setTimeout(r, 600));

    const lastCall = (fakeOrchestrator.runTurn as Mock).mock.calls.at(-1);
    const history = lastCall?.[1]?.history as Array<{ role: string; text: string }>;
    const agentTurns = history?.filter((h) => h.role === "agent") ?? [];
    expect(agentTurns.length).toBe(0);
  });
});
