import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";

// Mock the modules VoiceSession loads at construction time (mirrors
// session.browser.test.ts) so the constructor has no real side effects.
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

// EventEmitter-backed ws so emitting "close" actually invokes dispose().
function fakeWs() {
  const ws = new EventEmitter() as any;
  ws.OPEN = 1;
  ws.readyState = 1;
  ws.send = vi.fn();
  return ws;
}

describe("VoiceSession learnings", () => {
  it("calls reflectAndStore once on socket close", () => {
    const ws = fakeWs();
    const reflectAndStore = vi.fn(
      async (_args: {
        company: string;
        turns: { role: "user" | "agent"; text: string }[];
        phaseReached?: string;
      }) => {}
    );
    new VoiceSession(ws, "dg-key", {
      startSession: vi.fn(),
      stopSession: vi.fn(async () => {}),
      createOrchestrator: vi.fn(),
      reflectAndStore,
    });
    ws.emit("close");
    expect(reflectAndStore).toHaveBeenCalledTimes(1);
    expect(reflectAndStore.mock.calls[0][0]).toHaveProperty("company");
    expect(reflectAndStore.mock.calls[0][0]).toHaveProperty("turns");
  });

  it("does not call reflectAndStore twice when error then close both fire", () => {
    const ws = fakeWs();
    const reflectAndStore = vi.fn(
      async (_args: {
        company: string;
        turns: { role: "user" | "agent"; text: string }[];
        phaseReached?: string;
      }) => {}
    );
    new VoiceSession(ws, "dg-key", {
      startSession: vi.fn(),
      stopSession: vi.fn(async () => {}),
      createOrchestrator: vi.fn(),
      reflectAndStore,
    });
    ws.emit("error", new Error("boom"));
    ws.emit("close");
    expect(reflectAndStore).toHaveBeenCalledTimes(1);
  });
});
