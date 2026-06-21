import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";

vi.mock("./deepgram/stt", () => ({
  DeepgramStt: vi.fn().mockImplementation(() => ({
    on: vi.fn(), start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined), sendAudio: vi.fn(),
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

function fakeWs() {
  const ws = new EventEmitter() as any;
  ws.OPEN = 1; ws.readyState = 1; ws.send = vi.fn();
  return ws;
}

describe("VoiceSession analysis", () => {
  it("persists and analyzes the session once on socket close", () => {
    const ws = fakeWs();
    const saveSession = vi.fn(async () => {});
    const analyzeAndStore = vi.fn(async () => {});
    new VoiceSession(ws, "dg-key", {
      startSession: vi.fn(),
      stopSession: vi.fn(async () => {}),
      createOrchestrator: vi.fn(),
      reflectAndStore: vi.fn(async () => {}),
      saveSession,
      analyzeAndStore,
    });
    ws.emit("close");
    expect(saveSession).toHaveBeenCalledTimes(1);
    expect(analyzeAndStore).toHaveBeenCalledTimes(1);
    // both receive the same SessionRecord shape
    expect((saveSession.mock.calls as unknown[][])[0][0]).toHaveProperty("transcript");
    expect((analyzeAndStore.mock.calls as unknown[][])[0][0]).toHaveProperty("events");
  });

  it("does not persist twice when error then close both fire", () => {
    const ws = fakeWs();
    const saveSession = vi.fn(async () => {});
    const analyzeAndStore = vi.fn(async () => {});
    new VoiceSession(ws, "dg-key", {
      startSession: vi.fn(), stopSession: vi.fn(async () => {}),
      createOrchestrator: vi.fn(), reflectAndStore: vi.fn(async () => {}),
      saveSession, analyzeAndStore,
    });
    ws.emit("error", new Error("boom"));
    ws.emit("close");
    expect(saveSession).toHaveBeenCalledTimes(1);
    expect(analyzeAndStore).toHaveBeenCalledTimes(1);
  });
});
