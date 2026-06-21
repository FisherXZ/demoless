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
    voiceName: vi.fn().mockReturnValue("Messi"),
  }),
}));
vi.mock("./bargeIn", () => ({
  readBargeConfig: vi.fn().mockReturnValue({ mode: "off" }),
  novelWordCount: vi.fn().mockReturnValue(0),
  tokenize: vi.fn().mockReturnValue([]),
}));
// Keep startup off any live Redis so the turn isn't blocked.
vi.mock("../lib/memory/store", () => ({
  loadBuyer: vi.fn().mockResolvedValue({
    profile: { email: "buyer@example.com" }, notes: [], isReturning: false, recall: null,
  }),
}));
vi.mock("../lib/memory/pubsub", () => ({ publishPhase: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../lib/learnings", () => ({
  getLearnings: vi.fn().mockResolvedValue([]),
  buildLearningsContext: vi.fn().mockReturnValue(""),
  reflectAndStore: vi.fn().mockResolvedValue(undefined),
}));

import { VoiceSession } from "./session";

function fakeWs() {
  const ws = new EventEmitter() as any;
  ws.OPEN = 1; ws.readyState = 1; ws.send = vi.fn();
  return ws;
}

const BUYER = { demoSessionId: "demo-1", buyerEmail: "buyer@example.com", buyerName: "Bea" };

/** Build a session that has identified itself + started a (fake) browser, so
 *  dispose has a real demo session to persist. Returns the spies. */
async function startedSession() {
  const ws = fakeWs();
  const saveSession = vi.fn(async () => {});
  const analyzeAndStore = vi.fn(async () => {});
  const extractAndStorePacket = vi.fn(async () => {});
  new VoiceSession(ws, "dg-key", {
    startSession: vi.fn().mockResolvedValue({
      liveViewUrl: "https://live.example.com", sessionId: "bb-1",
      url: "https://www.browserbase.com", title: "",
    }),
    stopSession: vi.fn(async () => {}),
    createOrchestrator: vi.fn().mockReturnValue({
      runTurn: vi.fn(async function* () {}), greeting: vi.fn().mockReturnValue(null),
    }),
    reflectAndStore: vi.fn(async () => {}),
    saveSession,
    loadSession: vi.fn().mockResolvedValue(null),
    analyzeAndStore,
    extractAndStorePacket,
  });
  ws.emit("message", JSON.stringify({ t: "audio_start", language: "en", buyer: BUYER }), false);
  await new Promise((r) => setTimeout(r, 10)); // let startListening settle
  return { ws, saveSession, analyzeAndStore, extractAndStorePacket };
}

describe("VoiceSession analysis", () => {
  it("persists and analyzes the identified session once on socket close", async () => {
    const { ws, saveSession, analyzeAndStore, extractAndStorePacket } = await startedSession();
    saveSession.mockClear(); // ignore the live snapshots taken while running

    ws.emit("close");

    // analyze + packet extraction each run exactly once, at teardown; the final
    // save is the ended record.
    expect(analyzeAndStore).toHaveBeenCalledTimes(1);
    expect(extractAndStorePacket).toHaveBeenCalledTimes(1);
    expect(saveSession).toHaveBeenCalledTimes(1);
    const ended = (saveSession.mock.calls as unknown[][])[0][0] as Record<string, unknown>;
    expect(ended).toMatchObject({ id: "demo-1", status: "ended", buyerEmail: "buyer@example.com" });
    expect(ended).toHaveProperty("transcript");
    const analyzed = (analyzeAndStore.mock.calls as unknown[][])[0][0] as Record<string, unknown>;
    expect(analyzed).toHaveProperty("events");
    // The packet extractor receives the same ended record.
    const packeted = (extractAndStorePacket.mock.calls as unknown[][])[0][0] as Record<string, unknown>;
    expect(packeted).toMatchObject({ id: "demo-1", status: "ended" });
  });

  it("does not analyze twice when error then close both fire", async () => {
    const { ws, analyzeAndStore } = await startedSession();

    ws.emit("error", new Error("boom"));
    ws.emit("close");

    expect(analyzeAndStore).toHaveBeenCalledTimes(1);
  });

  it("never persists a session that never identified itself", () => {
    const ws = fakeWs();
    const saveSession = vi.fn(async () => {});
    const analyzeAndStore = vi.fn(async () => {});
    new VoiceSession(ws, "dg-key", {
      startSession: vi.fn(), stopSession: vi.fn(async () => {}),
      createOrchestrator: vi.fn(), reflectAndStore: vi.fn(async () => {}),
      saveSession, loadSession: vi.fn(async () => null), analyzeAndStore,
    });
    ws.emit("close"); // closed before any audio_start/buyer identity

    expect(saveSession).not.toHaveBeenCalled();
    expect(analyzeAndStore).not.toHaveBeenCalled();
  });

  it("swallows synchronous finalizer failures during teardown", () => {
    const ws = fakeWs();
    const finalizer = {
      finalize: vi.fn(() => {
        throw new Error("recorder unavailable");
      }),
    };
    new VoiceSession(ws, "dg-key", {
      finalizer,
      startSession: vi.fn(),
      stopSession: vi.fn(async () => {}),
      createOrchestrator: vi.fn(),
      reflectAndStore: vi.fn(async () => {}),
      saveSession: vi.fn(async () => {}),
      analyzeAndStore: vi.fn(async () => {}),
    });

    expect(() => ws.emit("close")).not.toThrow();
    expect(finalizer.finalize).toHaveBeenCalledTimes(1);
  });
});
