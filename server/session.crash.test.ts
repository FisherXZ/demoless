import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";

// Mirror session.learnings.test.ts: stub the modules VoiceSession loads at
// construction so the constructor has no real side effects.
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
    voiceName: vi.fn().mockReturnValue("Messi"),
  }),
}));
vi.mock("./bargeIn", () => ({
  readBargeConfig: vi.fn().mockReturnValue({ mode: "off" }),
  novelWordCount: vi.fn().mockReturnValue(0),
  tokenize: vi.fn().mockReturnValue([]),
}));

import { VoiceSession } from "./session";

function fakeWs() {
  const ws = new EventEmitter() as any;
  ws.OPEN = 1;
  ws.readyState = 1;
  ws.send = vi.fn();
  return ws;
}

describe("VoiceSession startup crash safety", () => {
  // Repro of the live "Messi keeps dropping" crash: a client connects, browser
  // startup begins, the client disconnects (dispose tears down the browser),
  // then the in-flight startSession rejects. That rejection must NOT escape as
  // an unhandled rejection (which crashes the whole gateway process).
  it("does not leak an unhandled rejection when the client disconnects mid-startup", async () => {
    const ws = fakeWs();
    let rejectPrepare!: (e: Error) => void;
    const prepare = vi.fn(
      () => new Promise((_res, rej) => { rejectPrepare = rej; })
    );

    new VoiceSession(ws, "dg-key", {
      startup: { prewarm: vi.fn(async () => {}), prepare } as never,
      stopSession: vi.fn(async () => {}),
      loadSession: vi.fn(async () => null),
      createOrchestrator: vi.fn(),
      reflectAndStore: vi.fn(async () => {}),
    });

    const onUnhandled = vi.fn();
    process.on("unhandledRejection", onUnhandled);
    try {
      ws.emit(
        "message",
        JSON.stringify({
          t: "audio_start",
          sampleRate: 24000,
          language: "en",
          buyer: { demoSessionId: "d1", buyerEmail: "b@x.com" },
        }),
        false
      );
      // Let startListening reach the awaited prepare().
      await new Promise((r) => setImmediate(r));
      // Client leaves mid-startup -> dispose() runs.
      ws.emit("close");
      // The in-flight startSession now rejects (browser torn down).
      rejectPrepare(new Error("Target page, context or browser has been closed"));
      // Flush microtasks + the next tick where Node would fire unhandledRejection.
      await new Promise((r) => setTimeout(r, 20));

      expect(onUnhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});
