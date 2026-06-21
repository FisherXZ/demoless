import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

const fakes = vi.hoisted(() => ({
  sttInstances: [] as Array<{
    key: string;
    handlers: Record<string, Array<(...args: any[]) => void>>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    sendAudio: ReturnType<typeof vi.fn>;
    emit: (event: string, ...args: any[]) => void;
  }>,
  bargeConfig: { mode: "off" } as any,
  novelWordCount: vi.fn(() => 0),
  tokenize: vi.fn((text: string) => text.toLowerCase().split(/\s+/).filter(Boolean)),
  synthesize: vi.fn(async function* () {
    yield Buffer.from("audio");
  }),
  voiceName: vi.fn((language: string) => `voice-${language}`),
  detectLanguage: vi.fn(),
  publishPhase: vi.fn(),
}));

vi.mock("./deepgram/stt", () => ({
  DeepgramStt: vi.fn().mockImplementation((key: string) => {
    const instance = {
      key,
      handlers: {} as Record<string, Array<(...args: any[]) => void>>,
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      sendAudio: vi.fn(),
      on: vi.fn((event: string, listener: (...args: any[]) => void) => {
        instance.handlers[event] ??= [];
        instance.handlers[event].push(listener);
        return instance;
      }),
      emit: (event: string, ...args: any[]) => {
        for (const listener of instance.handlers[event] ?? []) listener(...args);
      },
    };
    fakes.sttInstances.push(instance);
    return instance;
  }),
}));

vi.mock("./tts", () => ({
  createTts: vi.fn().mockReturnValue({
    synthesize: fakes.synthesize,
    voiceName: fakes.voiceName,
  }),
}));

vi.mock("./bargeIn", () => ({
  readBargeConfig: vi.fn(() => fakes.bargeConfig),
  novelWordCount: fakes.novelWordCount,
  tokenize: fakes.tokenize,
}));

vi.mock("./util/detectLanguage", () => ({
  detectLanguage: fakes.detectLanguage,
}));

vi.mock("../lib/memory/pubsub", () => ({
  publishPhase: fakes.publishPhase,
}));

import { VoiceSession } from "./session";

type Sent = { t: string; [key: string]: unknown };

function makeWs(readyState = 1) {
  const ws = new EventEmitter() as EventEmitter & {
    OPEN: number;
    readyState: number;
    send: ReturnType<typeof vi.fn>;
    sent: Sent[];
  };
  ws.OPEN = 1;
  ws.readyState = readyState;
  ws.sent = [];
  ws.send = vi.fn((data: string) => {
    ws.sent.push(JSON.parse(data) as Sent);
  });
  return ws;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function orchestrator(commands: any[] = [], greeting: string | null = null) {
  return {
    greeting: vi.fn().mockReturnValue(greeting),
    runTurn: vi.fn(async function* (_input, _ctx, signal: AbortSignal) {
      for (const command of commands) {
        if (signal.aborted) return;
        yield command;
      }
    }),
  };
}

function blockingOrchestrator(text = "Still talking.") {
  const gate = deferred();
  const fake = {
    greeting: vi.fn().mockReturnValue(null),
    runTurn: vi.fn(async function* (_input, _ctx, signal: AbortSignal) {
      yield { type: "say", text };
      await gate.promise;
      if (signal.aborted) return;
      yield { type: "say", text: "Too late." };
    }),
  };
  return { fake, release: gate.resolve };
}

function startupFor(fakeOrchestrator: ReturnType<typeof orchestrator>) {
  return {
    prewarm: vi.fn().mockResolvedValue(undefined),
    prepare: vi.fn().mockResolvedValue({
      sessionId: "bb-session",
      liveViewUrl: "https://live.example.com",
      orchestrator: fakeOrchestrator,
      buyerNotes: ["prior note"],
      learningsContext: "known lesson",
      company: "browserbase",
      buyer: { profile: { email: "buyer@example.com" } },
    }),
  };
}

function mount(options: {
  ws?: ReturnType<typeof makeWs>;
  fakeOrchestrator?: ReturnType<typeof orchestrator>;
  startup?: ReturnType<typeof startupFor>;
  stopSession?: ReturnType<typeof vi.fn>;
} = {}) {
  const ws = options.ws ?? makeWs();
  const fakeOrchestrator = options.fakeOrchestrator ?? orchestrator();
  const startup = options.startup ?? startupFor(fakeOrchestrator);
  const stopSession = options.stopSession ?? vi.fn().mockResolvedValue(undefined);
  const finalizer = { finalize: vi.fn() };
  const session = new VoiceSession(ws as any, "dg-key", {
    startup: startup as any,
    finalizer,
    stopSession,
  });
  return { session, ws, startup, fakeOrchestrator, stopSession, finalizer };
}

function control(ws: ReturnType<typeof makeWs>, message: Record<string, unknown> | string) {
  ws.emit(
    "message",
    typeof message === "string" ? message : JSON.stringify(message),
    false
  );
}

function audio(ws: ReturnType<typeof makeWs>, chunk = Buffer.from("pcm")) {
  ws.emit("message", chunk, true);
}

function sent(ws: ReturnType<typeof makeWs>, type?: string) {
  return type ? ws.sent.filter((event) => event.t === type) : ws.sent;
}

async function waitForSent(ws: ReturnType<typeof makeWs>, type: string) {
  await vi.waitFor(() => {
    expect(sent(ws, type).length).toBeGreaterThan(0);
  });
}

beforeEach(() => {
  fakes.sttInstances.length = 0;
  fakes.bargeConfig = { mode: "off" };
  fakes.novelWordCount.mockReset().mockReturnValue(0);
  fakes.tokenize.mockClear();
  fakes.synthesize.mockReset().mockImplementation(async function* () {
    yield Buffer.from("audio");
  });
  fakes.voiceName.mockClear();
  fakes.detectLanguage.mockReset();
  fakes.publishPhase.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("VoiceSession STT and control paths", () => {
  it("prewarms, starts once, and speaks the orchestrator greeting", async () => {
    vi.stubEnv("AGENT_NAME", "Ava");
    const fakeOrchestrator = orchestrator([], "Welcome aboard.");
    const startup = startupFor(fakeOrchestrator);
    const { ws } = mount({ fakeOrchestrator, startup });

    control(ws, "{not-json");
    control(ws, { t: "prewarm" });
    control(ws, { t: "audio_start", role: "engineer" });
    control(ws, { t: "audio_start", role: "engineer" });

    await waitForSent(ws, "tts_end");

    expect(startup.prewarm).toHaveBeenCalledTimes(1);
    expect(startup.prepare).toHaveBeenCalledTimes(1);
    expect(fakeOrchestrator.greeting).toHaveBeenCalledWith(
      "en",
      "Ava",
      { profile: { email: "buyer@example.com" } }
    );
    expect(sent(ws, "ready")).toContainEqual({
      t: "ready",
      language: "en",
      agentName: "Ava",
    });
    expect(sent(ws, "say")).toContainEqual({
      t: "say",
      text: "Welcome aboard.",
      turn: 1,
    });
    expect(sent(ws, "tts_chunk")[0]).toMatchObject({
      t: "tts_chunk",
      sampleRate: 24000,
      turn: 1,
      seq: 0,
    });
  });

  it("forwards orchestrator command events and excludes filler from history", async () => {
    const fakeOrchestrator = orchestrator([
      { type: "filler", text: "One sec." },
      { type: "navigate", url: "https://example.com/dashboard" },
      { type: "screen_is_on", page: "Dashboard" },
      { type: "remember", note: "cares about evals", noteType: "interest" },
      { type: "buyer_loaded", buyerId: "buyer-1" },
      { type: "buyer_loaded", buyerId: "buyer-1", notes: ["new note"] },
      { type: "set_phase", phase: "demo" },
      { type: "done" },
      { type: "say", text: "Here is the dashboard." },
    ]);
    const { session, ws } = mount({ fakeOrchestrator });

    control(ws, { t: "text_input", text: "show dashboard", role: "founder" });
    await waitForSent(ws, "tts_end");

    expect(sent(ws, "screen_is_on")).toContainEqual({
      t: "screen_is_on",
      page: "Dashboard",
    });
    expect(sent(ws, "remember")).toContainEqual({
      t: "remember",
      note: "cares about evals",
      noteType: "interest",
    });
    expect(sent(ws, "buyer_loaded")).toHaveLength(2);
    expect(sent(ws, "set_phase")).toContainEqual({ t: "set_phase", phase: "demo" });
    expect(fakes.publishPhase).toHaveBeenCalledWith("anonymous", "demo");
    expect((session as any).history).toEqual([
      { role: "user", text: "show dashboard" },
      { role: "agent", text: "Here is the dashboard." },
    ]);
    expect(fakeOrchestrator.runTurn).toHaveBeenCalledWith(
      { text: "show dashboard", language: "en" },
      expect.objectContaining({
        role: "founder",
        buyerNotes: ["prior note"],
        learningsContext: "known lesson",
      }),
      expect.any(AbortSignal)
    );
  });

  it("reports orchestrator and TTS errors to the socket", async () => {
    const brokenBrain = {
      greeting: vi.fn().mockReturnValue(null),
      runTurn: vi.fn(async function* () {
        throw new Error("brain offline");
      }),
    };
    const { ws } = mount({ fakeOrchestrator: brokenBrain as any });

    control(ws, { t: "text_input", text: "hello" });
    await vi.waitFor(() => {
      expect(sent(ws, "error")).toContainEqual({
        t: "error",
        message: "Orchestrator: brain offline",
      });
    });

    fakes.synthesize.mockImplementationOnce(async function* () {
      throw new Error("speaker offline");
    });
    const ttsFailure = orchestrator([{ type: "say", text: "This will fail." }]);
    const second = mount({ fakeOrchestrator: ttsFailure });
    control(second.ws, { t: "text_input", text: "speak" });
    await vi.waitFor(() => {
      expect(sent(second.ws, "error")).toContainEqual({
        t: "error",
        message: "TTS: speaker offline",
      });
    });
  });

  it("turns Deepgram transcripts and utterance-end events into user turns", async () => {
    vi.stubEnv("VOICE_AUTODETECT", "0");
    const fakeOrchestrator = orchestrator();
    const { ws } = mount({ fakeOrchestrator });
    control(ws, { t: "audio_start", language: "en" });
    await waitForSent(ws, "ready");
    const stt = fakes.sttInstances[0];

    stt.emit("transcript", {
      text: "hello",
      isFinal: false,
      speechFinal: false,
      confidence: 1,
    });
    stt.emit("transcript", {
      text: "hello there",
      isFinal: true,
      speechFinal: false,
      confidence: 1,
    });
    stt.emit("utteranceEnd");
    stt.emit("error", new Error("stt offline"));

    await vi.waitFor(() => {
      expect(fakeOrchestrator.runTurn).toHaveBeenCalledWith(
        { text: "hello there", language: "en" },
        expect.anything(),
        expect.any(AbortSignal)
      );
    });
    expect(sent(ws, "user_said")).toContainEqual({
      t: "user_said",
      text: "hello",
      final: false,
    });
    expect(sent(ws, "user_said")).toContainEqual({
      t: "user_said",
      text: "hello there",
      final: true,
    });
    expect(sent(ws, "error")).toContainEqual({
      t: "error",
      message: "STT: stt offline",
    });
  });

  it("drops transcripts during the post-speech echo guard", async () => {
    vi.stubEnv("VOICE_AUTODETECT", "0");
    const fakeOrchestrator = orchestrator();
    const { session, ws } = mount({ fakeOrchestrator });
    control(ws, { t: "audio_start", language: "en" });
    await waitForSent(ws, "ready");
    (session as any).suppressInputUntil = Date.now() + 10_000;

    fakes.sttInstances[0].emit("transcript", {
      text: "echo tail",
      isFinal: true,
      speechFinal: true,
      confidence: 1,
    });

    await Promise.resolve();
    expect(fakeOrchestrator.runTurn).not.toHaveBeenCalled();
    expect(sent(ws, "user_said")).toHaveLength(0);
  });

  it("ignores empty final utterances when auto-detect is disabled", async () => {
    vi.stubEnv("VOICE_AUTODETECT", "0");
    const fakeOrchestrator = orchestrator();
    const { ws } = mount({ fakeOrchestrator });
    control(ws, { t: "audio_start", language: "en" });
    await waitForSent(ws, "ready");

    fakes.sttInstances[0].emit("transcript", {
      text: "",
      isFinal: true,
      speechFinal: true,
      confidence: 1,
    });

    await Promise.resolve();
    expect(fakeOrchestrator.runTurn).not.toHaveBeenCalled();
  });

  it("buffers opening audio, detects language, and restarts STT in the detected language", async () => {
    vi.stubEnv("OPENAI_API_KEY", "openai-key");
    fakes.detectLanguage.mockResolvedValue({
      text: "hola mundo",
      language: "es",
    });
    const fakeOrchestrator = orchestrator();
    const { ws } = mount({ fakeOrchestrator });
    control(ws, { t: "audio_start", language: "en" });
    await waitForSent(ws, "ready");

    audio(ws, Buffer.from("first audio"));
    fakes.sttInstances[0].emit("transcript", {
      text: "fallback",
      isFinal: true,
      speechFinal: true,
      confidence: 1,
    });

    await vi.waitFor(() => {
      expect(fakeOrchestrator.runTurn).toHaveBeenCalledWith(
        { text: "hola mundo", language: "es" },
        expect.anything(),
        expect.any(AbortSignal)
      );
    });
    expect(fakes.detectLanguage).toHaveBeenCalledWith(expect.any(Buffer), 24000);
    expect(fakes.sttInstances[0].sendAudio).toHaveBeenCalledWith(
      Buffer.from("first audio")
    );
    expect(fakes.sttInstances[0].stop).toHaveBeenCalled();
    expect(fakes.sttInstances[1].start).toHaveBeenCalledWith("es");
    expect(sent(ws, "ready")).toContainEqual({
      t: "ready",
      language: "es",
      agentName: "voice-es",
    });
    expect(sent(ws, "user_said")).toContainEqual({
      t: "user_said",
      text: "hola mundo",
      final: true,
    });
  });

  it("reports language detection failures and skips empty detected utterances", async () => {
    vi.stubEnv("OPENAI_API_KEY", "openai-key");
    fakes.detectLanguage.mockRejectedValueOnce(new Error("language offline"));
    const fallbackBrain = orchestrator();
    const fallback = mount({ fakeOrchestrator: fallbackBrain });
    control(fallback.ws, { t: "audio_start", language: "en" });
    await waitForSent(fallback.ws, "ready");
    audio(fallback.ws);
    fakes.sttInstances[0].emit("transcript", {
      text: "fallback text",
      isFinal: true,
      speechFinal: true,
      confidence: 1,
    });

    await vi.waitFor(() => {
      expect(fallbackBrain.runTurn).toHaveBeenCalledWith(
        { text: "fallback text", language: "en" },
        expect.anything(),
        expect.any(AbortSignal)
      );
    });
    expect(sent(fallback.ws, "error")).toContainEqual({
      t: "error",
      message: "Language detect: language offline",
    });

    fakes.sttInstances.length = 0;
    fakes.detectLanguage.mockResolvedValueOnce({ text: "", language: "en" });
    const emptyBrain = orchestrator();
    const empty = mount({ fakeOrchestrator: emptyBrain });
    control(empty.ws, { t: "audio_start", language: "en" });
    await waitForSent(empty.ws, "ready");
    audio(empty.ws);
    fakes.sttInstances[0].emit("transcript", {
      text: "",
      isFinal: true,
      speechFinal: true,
      confidence: 1,
    });

    await vi.waitFor(() => {
      expect(fakes.detectLanguage).toHaveBeenCalledTimes(2);
    });
    expect(emptyBrain.runTurn).not.toHaveBeenCalled();
  });

  it("switches language, stops listening, and suppresses sends to closed sockets", async () => {
    const { ws } = mount();
    control(ws, { t: "audio_start", language: "en" });
    await waitForSent(ws, "ready");

    control(ws, { t: "set_language", language: "en" });
    expect(fakes.sttInstances).toHaveLength(1);

    control(ws, { t: "set_language", language: "es" });
    await vi.waitFor(() => {
      expect(fakes.sttInstances[1].start).toHaveBeenCalledWith("es");
    });
    expect(fakes.sttInstances[0].stop).toHaveBeenCalled();
    expect(sent(ws, "ready")).toContainEqual({
      t: "ready",
      language: "es",
      agentName: "voice-es",
    });

    control(ws, { t: "audio_stop" });
    await vi.waitFor(() => {
      expect(sent(ws, "agent_state")).toContainEqual({
        t: "agent_state",
        state: "idle",
      });
    });

    const closed = makeWs(3);
    mount({ ws: closed });
    control(closed, { t: "text_input", text: "silent" });
    await Promise.resolve();
    expect(closed.send).not.toHaveBeenCalled();
  });

  it("forwards binary audio only while the half-duplex session is listening", async () => {
    const { ws } = mount();
    control(ws, { t: "audio_start", language: "en" });
    await waitForSent(ws, "ready");
    audio(ws, Buffer.from("audible"));
    expect(fakes.sttInstances[0].sendAudio).toHaveBeenCalledWith(Buffer.from("audible"));

    const blocked = blockingOrchestrator();
    const speaking = mount({ fakeOrchestrator: blocked.fake as any });
    control(speaking.ws, { t: "text_input", text: "keep talking" });
    await waitForSent(speaking.ws, "say");
    const speakingStt = fakes.sttInstances.at(-1)!;
    speakingStt.sendAudio.mockClear();
    audio(speaking.ws, Buffer.from("echo"));
    expect(speakingStt.sendAudio).not.toHaveBeenCalled();
    blocked.release();

    fakes.bargeConfig = { mode: "vad" };
    const vad = mount();
    control(vad.ws, { t: "audio_start", language: "en" });
    await waitForSent(vad.ws, "ready");
    audio(vad.ws, Buffer.from("vad audio"));
    expect(fakes.sttInstances.at(-1)!.sendAudio).toHaveBeenCalledWith(
      Buffer.from("vad audio")
    );
  });

  it("allows speech and VAD barge-in policies to interrupt active turns", async () => {
    fakes.bargeConfig = { mode: "speech", minConfidence: 0.7, minWords: 2 };
    fakes.novelWordCount.mockReturnValue(2);
    const speechBlocked = blockingOrchestrator();
    const speech = mount({ fakeOrchestrator: speechBlocked.fake as any });
    control(speech.ws, { t: "text_input", text: "explain this" });
    await waitForSent(speech.ws, "say");
    const speechStt = fakes.sttInstances[0];

    speechStt.emit("transcript", {
      text: "wait",
      isFinal: false,
      speechFinal: false,
      confidence: 0.2,
    });
    expect(sent(speech.ws, "barge_in")).toHaveLength(0);

    speechStt.emit("transcript", {
      text: "wait please",
      isFinal: false,
      speechFinal: false,
      confidence: 0.9,
    });
    expect(sent(speech.ws, "barge_in")).toHaveLength(1);
    speechBlocked.release();

    fakes.bargeConfig = { mode: "vad" };
    const vadBlocked = blockingOrchestrator();
    const vad = mount({ fakeOrchestrator: vadBlocked.fake as any });
    control(vad.ws, { t: "text_input", text: "continue" });
    await waitForSent(vad.ws, "say");
    fakes.sttInstances.at(-1)!.emit("transcript", {
      text: "noise",
      isFinal: false,
      speechFinal: false,
      confidence: 1,
    });
    expect(sent(vad.ws, "barge_in")).toHaveLength(0);
    fakes.sttInstances.at(-1)!.emit("speechStarted");
    expect(sent(vad.ws, "barge_in")).toHaveLength(1);
    vadBlocked.release();
  });

  it("covers constructor fallback wiring and inactive barge-in no-ops", () => {
    new VoiceSession(makeWs() as any, "dg-key");
    new VoiceSession(makeWs() as any, "dg-key", {
      saveSession: vi.fn().mockResolvedValue(undefined),
      stopSession: vi.fn().mockResolvedValue(undefined),
    });
    new VoiceSession(makeWs() as any, "dg-key", {
      analyzeAndStore: vi.fn().mockResolvedValue(undefined),
      stopSession: vi.fn().mockResolvedValue(undefined),
    });
    const { ws } = mount();

    control(ws, { t: "barge_in" });

    expect(sent(ws, "barge_in")).toHaveLength(0);
  });

  it("records synthetic speak turns with an optional user prompt", async () => {
    const { session, ws } = mount();

    await (session as any).speakTurn("Here is the answer.", "What is this?");

    expect((session as any).history).toEqual([
      { role: "user", text: "What is this?" },
      { role: "agent", text: "Here is the answer." },
    ]);
    expect(sent(ws, "tts_end")).toContainEqual({ t: "tts_end", turn: 1 });
  });

  it("ignores orchestrator commands yielded after a barge-in abort", async () => {
    const gate = deferred();
    const lateCommandBrain = {
      greeting: vi.fn().mockReturnValue(null),
      runTurn: vi.fn(async function* () {
        yield { type: "say", text: "First answer." };
        await gate.promise;
        yield { type: "screen_is_on", page: "Late screen" };
      }),
    };
    const { ws } = mount({ fakeOrchestrator: lateCommandBrain as any });

    control(ws, { t: "text_input", text: "start" });
    await waitForSent(ws, "say");
    control(ws, { t: "barge_in" });
    gate.resolve();
    await vi.waitFor(() => {
      expect(sent(ws, "barge_in")).toHaveLength(1);
    });

    expect(sent(ws, "screen_is_on")).toHaveLength(0);
  });
});
