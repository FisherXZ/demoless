import type { WebSocket } from "ws";
import {
  AUDIO_SAMPLE_RATE,
  DEFAULT_LANGUAGE,
  type BuyerIdentity,
  type Language,
  type ServerEvent,
  parseClientMessage,
} from "../lib/voice/messages";
import {
  type BargeConfig,
  novelWordCount,
  readBargeConfig,
  tokenize,
} from "./bargeIn";
import { DeepgramStt, type SttTranscript } from "./deepgram/stt";
import {
  createOrchestrator as defaultCreateOrchestrator,
  type Orchestrator,
} from "./orchestrator";
import type { ConversationTurn } from "./orchestrator/types";
import { createTts, type TtsProvider } from "./tts";
import {
  startSession as defaultStartSession,
  stopSession as defaultStopSession,
} from "../lib/browser/session";
import { publishPhase } from "../lib/memory/pubsub";
import { reflectAndStore as defaultReflectAndStore } from "../lib/learnings";
import { detectLanguage } from "./util/detectLanguage";
import {
  SessionRecorder,
  saveSession as defaultSaveSession,
  loadSession as defaultLoadSession,
  analyzeAndStore as defaultAnalyzeAndStore,
  replayUrl,
  type SessionRecord,
  type SessionStatus,
} from "../lib/sessions";
import {
  createDemoSessionStartup,
  defaultDemoSessionStartup,
  type CreateOrchestrator,
  type DemoSessionStartup,
  type StartBrowserSession,
} from "./demoSession/startup";
import {
  createDemoSessionFinalizer,
  defaultDemoSessionFinalizer,
  type DemoSessionFinalizer,
} from "./demoSession/finalize";
import { streamSpeechTurn } from "./demoSession/speech";
import { speechGateway } from "./util/speechGateway";

/** Injectable dependencies — real impls used in production; fakes in tests. */
export interface VoiceSessionDeps {
  startup: DemoSessionStartup;
  finalizer: DemoSessionFinalizer;
  startSession: StartBrowserSession;
  stopSession: (sessionId: string) => Promise<void>;
  createOrchestrator: CreateOrchestrator;
  reflectAndStore: (args: {
    company: string;
    turns: { role: "user" | "agent"; text: string }[];
    phaseReached?: string;
  }) => Promise<void>;
  saveSession: (record: SessionRecord) => Promise<void>;
  loadSession: (id: string) => Promise<SessionRecord | null>;
  analyzeAndStore: (record: SessionRecord) => Promise<void>;
  extractAndStorePacket: (record: SessionRecord) => Promise<void>;
}

interface VoiceSessionRuntimeDeps {
  startup: DemoSessionStartup;
  finalizer: DemoSessionFinalizer;
  stopSession: (sessionId: string) => Promise<void>;
  saveSession: (record: SessionRecord) => Promise<void>;
  loadSession: (id: string) => Promise<SessionRecord | null>;
}

/**
 * One live voice conversation: bridges the browser <-> Deepgram STT <->
 * orchestrator <-> TTS, and owns turn-taking + barge-in.
 */
export class VoiceSession {
  private stt: DeepgramStt | null = null;
  private tts: TtsProvider;
  private orchestrator: Orchestrator;
  private language: Language = DEFAULT_LANGUAGE;

  private history: ConversationTurn[] = [];
  private recorder = new SessionRecorder();
  private buyerNotes: string[] = [];
  private learningsContext = "";

  /** Visitor's self-reported role from the pre-call form; picks the persona. */
  private role: string | undefined;
  private company = ""; // set in startListening; "" means a session that never started
  private lastPhase: string | undefined;
  private disposed = false; // dispose() is bound to both ws "close" and "error"

  /** Verified buyer identity for this session (demo id + email/name). */
  private buyer: BuyerIdentity | null = null;
  /** createdAt of the up-front session record, cached so live snapshots
   *  (which don't know it) never clobber it. 0 = unknown. */
  private sessionCreatedAt = 0;
  private liveViewUrl: string | undefined;

  /** Finalized transcript segments for the in-progress user utterance. */
  private finals: string[] = [];

  /**
   * First-utterance language auto-detection (Whisper). We buffer the opening
   * utterance's raw PCM, detect its language, then lock the session to it.
   * A manual toggle (set_language) sets `detected = true` to opt out.
   */
  private detected = false;
  private detectBuf: Buffer[] = [];
  private detectBytes = 0;
  /** Cap the opening-utterance buffer (~12s of linear16 @ sample rate). */
  private static readonly MAX_DETECT_BYTES = AUDIO_SAMPLE_RATE * 2 * 12;
  /** Auto-detect needs an OpenAI key; opt out with VOICE_AUTODETECT=0. */
  private get autoDetectEnabled(): boolean {
    return process.env.VOICE_AUTODETECT !== "0" && !!process.env.OPENAI_API_KEY;
  }

  private turnCounter = 0;
  /** The currently streaming agent turn, if any. */
  private active: { turn: number; abort: AbortController } | null = null;
  private agentSpeaking = false;

  /** How many recent turns to send to the orchestrator (bounds prompt size). */
  private static readonly MAX_HISTORY_TURNS = 12;

  /** Drop stray echo for this long after the agent stops talking (ms). */
  private static readonly POST_SPEECH_GUARD_MS = 600;

  /**
   * How (and how readily) the user can interrupt the agent. See {@link readBargeConfig}.
   * "off" = half-duplex (ignore mic while the agent speaks; reliable on speakers);
   * "vad" = interrupt on any sound; "speech" = interrupt only on real, confident
   * speech (noise-filtered + sensitivity-tunable).
   */
  private barge: BargeConfig = readBargeConfig();

  /** Lowercased words the agent is currently speaking, to discount mic echo. */
  private recentAgentWords = new Set<string>();

  /** Until this time we ignore mic input to avoid transcribing the agent's tail. */
  private suppressInputUntil = 0;

  /**
   * Whether mic audio should reach Deepgram right now. In half-duplex mode we
   * stop listening while the agent speaks (and briefly after) so its own voice
   * can't trigger a false interruption. With barge-in on we always listen so we
   * can detect a genuine interruption.
   */
  private get listening(): boolean {
    if (this.barge.mode === "off") {
      return !this.agentSpeaking && Date.now() >= this.suppressInputUntil;
    }
    return true;
  }

  /** Mark the agent as done speaking and arm the post-speech echo guard. */
  private endSpeaking() {
    this.agentSpeaking = false;
    this.finals = [];
    this.suppressInputUntil = Date.now() + VoiceSession.POST_SPEECH_GUARD_MS;
  }

  /** Remember the agent's words so mic echo of them won't count as interruption. */
  private noteAgentWords(text: string) {
    for (const word of tokenize(text)) this.recentAgentWords.add(word);
  }

  /**
   * Decide whether a transcript heard while the agent is speaking is a real
   * interruption. In "speech" mode it must clear the configured word + confidence
   * bar (after discounting the agent's own echoed words); in "vad" mode the VAD
   * onset already handled it; in "off" mode we never interrupt.
   */
  private evaluateInterruption(t: SttTranscript) {
    if (this.barge.mode !== "speech") return;
    if (t.confidence < this.barge.minConfidence) return;
    if (novelWordCount(t.text, this.recentAgentWords) >= this.barge.minWords) {
      this.bargeIn();
    }
  }

  /**
   * The agent's display name for the active voice. An explicit AGENT_NAME env
   * wins; otherwise it's derived from the selected voice model, so switching
   * models switches the name (e.g. aura-2-orion-en -> "Orion").
   */
  private get agentName(): string {
    const override = process.env.AGENT_NAME?.trim();
    return override || this.tts.voiceName(this.language);
  }

  /** Browserbase session id, set once startSession resolves. */
  private browserSessionId: string | null = null;

  /** Memoized one-time startup (browser + orchestrator), shared by the
   *  audio_start (mic) and text_input (typed) entry points so it runs once. */
  private startPromise: Promise<void> | null = null;
  private readonly deps: VoiceSessionRuntimeDeps;

  constructor(
    private ws: WebSocket,
    private deepgramKey: string,
    deps?: Partial<VoiceSessionDeps>
  ) {
    this.tts = createTts();
    // Orchestrator is created lazily in startListening once we have a sessionId.
    // Set a placeholder so the field is never uninitialized.
    this.orchestrator = null as unknown as Orchestrator;

    const startSession = deps?.startSession ?? defaultStartSession;
    const createOrchestrator =
      deps?.createOrchestrator ?? defaultCreateOrchestrator;
    const startup =
      deps?.startup ??
      (deps?.startSession || deps?.createOrchestrator
        ? createDemoSessionStartup({ startSession, createOrchestrator })
        : defaultDemoSessionStartup);
    const finalizer =
      deps?.finalizer ??
      (deps?.reflectAndStore || deps?.saveSession || deps?.analyzeAndStore || deps?.extractAndStorePacket
        ? createDemoSessionFinalizer({
            reflectAndStore: deps?.reflectAndStore ?? defaultReflectAndStore,
            saveSession: deps?.saveSession ?? defaultSaveSession,
            analyzeAndStore: deps?.analyzeAndStore ?? defaultAnalyzeAndStore,
            extractAndStorePacket: deps?.extractAndStorePacket,
          })
        : defaultDemoSessionFinalizer);

    this.deps = {
      startup,
      finalizer,
      stopSession: deps?.stopSession ?? defaultStopSession,
      saveSession: deps?.saveSession ?? defaultSaveSession,
      loadSession: deps?.loadSession ?? defaultLoadSession,
    };

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        // Raw PCM from the mic -> Deepgram. In half-duplex mode we don't forward
        // mic audio while the agent is speaking, so it can't hear itself and
        // barge in on its own voice.
        if (this.listening) {
          const buf = data as Buffer;
          // Until the language is detected, also buffer the audio so Whisper can
          // identify it (Deepgram is running only to endpoint the utterance).
          if (
            this.autoDetectEnabled &&
            !this.detected &&
            this.detectBytes < VoiceSession.MAX_DETECT_BYTES
          ) {
            this.detectBuf.push(buf);
            this.detectBytes += buf.length;
          }
          this.stt?.sendAudio(buf);
        }
      } else {
        this.onControl(data.toString());
      }
    });
    ws.on("close", (code, reason) => {
      console.log(
        `[voice] client close code=${code} reason=${reason?.toString() || "(none)"}`
      );
      this.dispose();
    });
    ws.on("error", (err) => {
      console.error("[voice] client ws error:", err);
      this.dispose();
    });
  }

  private onControl(raw: string) {
    const msg = parseClientMessage(raw);
    if (!msg) return;
    switch (msg.t) {
      case "audio_start":
        if (!this.acceptBuyer(msg.buyer)) return;
        if (msg.role) this.role = msg.role;
        void this.ensureStarted(msg.language);
        break;
      case "audio_stop":
        void this.stopListening();
        break;
      case "set_language":
        void this.setLanguage(msg.language);
        break;
      case "barge_in":
        this.bargeIn();
        break;
      case "prewarm":
        void this.prewarm();
        break;
      case "text_input":
        // A text-only visitor may type before enabling the mic; make sure the
        // browser session + orchestrator are started before running a turn
        // (otherwise this.orchestrator is null and runTurn crashes).
        if (!this.acceptBuyer(msg.buyer)) return;
        if (msg.role) this.role = msg.role;
        this.send({ t: "user_said", text: msg.text, final: true });
        void this.ensureStarted(this.language).then(() => this.runTurn(msg.text));
        break;
    }
  }

  /** Adopt the buyer identity from a client message (once), normalizing the
   *  email. Returns false (and tells the client) if we still have no identity —
   *  a live session must be recorded under a real buyer, never "anonymous". */
  private acceptBuyer(buyer?: BuyerIdentity): boolean {
    if (buyer?.demoSessionId && buyer.buyerEmail) {
      this.buyer = {
        demoSessionId: buyer.demoSessionId,
        buyerEmail: buyer.buyerEmail.trim().toLowerCase(),
        buyerName: buyer.buyerName,
      };
    }
    if (!this.buyer) {
      this.send({ t: "error", message: "Missing buyer identity for live demo session." });
      return false;
    }
    return true;
  }

  private get buyerEmail(): string {
    return this.buyer?.buyerEmail ?? "";
  }

  private get demoSessionId(): string | null {
    return this.buyer?.demoSessionId ?? null;
  }

  /** Snapshot the current session (identity + lifecycle + the recorder's event
   *  log) to Redis, keyed by the app-owned demo session id. Fire-and-forget at
   *  the call sites; this never throws. */
  private async snapshot(
    status: SessionStatus,
    extra?: { endedAt?: number; durationSec?: number },
  ): Promise<void> {
    const id = this.demoSessionId;
    if (!id) return;
    const bb = this.browserSessionId ?? undefined;
    const record = this.recorder.build({
      id,
      company: this.company,
      status,
      buyerEmail: this.buyerEmail || undefined,
      buyerName: this.buyer?.buyerName,
      createdAt: this.sessionCreatedAt,
      endedAt: extra?.endedAt,
      durationSec: extra?.durationSec,
      phaseReached: this.lastPhase,
      browserbaseSessionId: bb,
      liveViewUrl: this.liveViewUrl,
      language: this.language,
      replayStatus: bb ? "pending" : "unavailable",
      replayUrl: bb ? replayUrl(bb) : undefined,
    });
    try {
      await this.deps.saveSession(record);
    } catch (err) {
      console.warn("[sessions] snapshot failed (continuing):", err);
    }
  }

  /** Start the browser session + orchestrator exactly once, regardless of
   *  whether the first client message is audio_start or text_input. */
  private ensureStarted(language: Language): Promise<void> {
    if (!this.startPromise) this.startPromise = this.startListening(language);
    return this.startPromise;
  }

  private async prewarm() {
    await this.deps.startup.prewarm();
  }

  private async startListening(language: Language) {
    if (!this.demoSessionId) {
      this.send({ t: "error", message: "Missing buyer identity for live demo session." });
      return;
    }
    this.language = language ?? DEFAULT_LANGUAGE;

    // Recover createdAt from the up-front record so live snapshots don't clobber
    // it; if the record is missing (Redis was down at enterDemo) we leave it 0.
    try {
      const existing = await this.deps.loadSession(this.demoSessionId);
      this.sessionCreatedAt = existing?.createdAt ?? 0;
    } catch {
      this.sessionCreatedAt = 0;
    }

    const prepared = await this.deps.startup.prepare({
      buyerId: this.buyerEmail,
      onLiveView: (url, sessionId) => {
        this.browserSessionId = sessionId;
        this.send({ t: "live_view", url });
      },
    });
    this.browserSessionId = prepared.sessionId;
    this.liveViewUrl = prepared.liveViewUrl;
    this.send({ t: "live_view", url: prepared.liveViewUrl });
    this.orchestrator = prepared.orchestrator;
    this.buyerNotes = prepared.buyerNotes;
    this.learningsContext = prepared.learningsContext;
    this.company = prepared.company;
    // The session is now live with a real cloud browser — mark it so the
    // dashboard Live mode can show it in progress (with replay pending).
    void this.snapshot("live");

    await this.openStt();
    this.send({ t: "ready", language: this.language, agentName: this.agentName });
    this.setState("listening");
    // GREET: the agent opens the conversation so the user hears the loop working.
    const greeting = await this.orchestrator.greeting?.(
      this.language,
      this.agentName,
      prepared.buyer
    );
    if (greeting) {
      await this.speakTurn(greeting, /* recordAsUser */ null);
    }
  }

  private async openStt() {
    await this.stopStt();
    const stt = new DeepgramStt(this.deepgramKey);

    stt.on("transcript", (t) => {
      // While the agent is speaking, a transcript is a candidate interruption -
      // judged by the barge-in policy (which filters noise + the agent's echo).
      if (this.agentSpeaking) {
        this.evaluateInterruption(t);
        return;
      }
      // Post-speech guard: drop the agent's echo tail right after it stops.
      if (Date.now() < this.suppressInputUntil) return;

      if (t.isFinal) {
        this.finals.push(t.text);
        const full = this.finals.join(" ").trim();
        this.send({ t: "user_said", text: full, final: false });
        if (t.speechFinal) this.endUtterance();
      } else {
        const preview = [...this.finals, t.text].join(" ").trim();
        if (preview) this.send({ t: "user_said", text: preview, final: false });
      }
    });

    // VAD onset while the agent is talking => barge-in, but only in "vad" mode.
    // "speech" mode waits for transcribed words; "off" never interrupts.
    stt.on("speechStarted", () => {
      if (this.agentSpeaking && this.barge.mode === "vad") this.bargeIn();
    });

    // Backstop: if we got finals but no speech_final, end on utterance end.
    stt.on("utteranceEnd", () => {
      if (
        !this.agentSpeaking &&
        Date.now() >= this.suppressInputUntil &&
        this.finals.length > 0
      ) {
        this.endUtterance();
      }
    });

    stt.on("error", (err) => {
      console.error("[voice] STT error:", err.message);
      this.send({ t: "error", message: `STT: ${err.message}` });
    });

    await stt.start(this.language);
    this.stt = stt;
  }

  private endUtterance() {
    const text = this.finals.join(" ").trim();
    this.finals = [];
    // First utterance with auto-detect on: figure out the language (and get an
    // accurate transcript) from the buffered audio before running the turn.
    if (this.autoDetectEnabled && !this.detected) {
      void this.detectThenRun(text);
      return;
    }
    if (!text) return;
    this.send({ t: "user_said", text, final: true });
    void this.runTurn(text);
  }

  /**
   * Detect the visitor's language from the opening utterance, lock the session
   * to it (restart STT in that language; TTS + brain follow via this.language),
   * then run the turn using Whisper's transcript. Falls back to the current
   * language and Deepgram's transcript if detection fails.
   */
  private async detectThenRun(fallbackText: string) {
    this.detected = true; // only ever detect once
    const audio = Buffer.concat(this.detectBuf);
    this.detectBuf = [];
    this.detectBytes = 0;

    let text = fallbackText;
    try {
      const result = await detectLanguage(audio, AUDIO_SAMPLE_RATE);
      if (result.text) text = result.text;
      if (result.language && result.language !== this.language) {
        this.language = result.language;
        if (this.stt) await this.openStt(); // STT for the rest of the session
        this.send({ t: "ready", language: this.language, agentName: this.agentName });
      }
    } catch (err) {
      this.send({ t: "error", message: `Language detect: ${(err as Error).message}` });
    }

    if (!text) return;
    this.send({ t: "user_said", text, final: true });
    void this.runTurn(text);
  }

  /** Run a full agent turn for the given user input. */
  private async runTurn(userText: string) {
    // A new utterance supersedes any in-progress response.
    this.cancelActive();
    this.recentAgentWords.clear();

    const turn = ++this.turnCounter;
    const abort = new AbortController();
    this.active = { turn, abort };

    this.history.push({ role: "user", text: userText });
    this.recorder.recordUser(userText, turn);
    this.setState("thinking");

    let spoken: string[] = [];
    try {
      spoken = await this.pipelineSpeak(
        this.orchestratorSay(userText, abort.signal),
        turn,
        abort.signal
      );
    } catch (err) {
      if (!abort.signal.aborted) {
        this.send({
          t: "error",
          message: `Orchestrator: ${(err as Error).message}`,
        });
      }
    }

    // Record whatever sentences were actually spoken, even on barge-in abort.
    // Never record unspoken / intended text.
    if (spoken.length > 0) {
      this.history.push({ role: "agent", text: spoken.join(" ") });
      this.recorder.recordAgent(spoken.join(" "), turn);
    }

    // Snapshot the in-progress session so the dashboard Live view reflects the
    // latest transcript/events. Fire-and-forget; never blocks the turn.
    void this.snapshot("live");

    if (!abort.signal.aborted) {
      this.send({ t: "tts_end", turn });
      this.endSpeaking();
      this.setState("listening");
      this.active = null;
    }
  }

  /**
   * Drive the orchestrator and yield spoken fragments with a filler flag.
   * `filler` fragments are synthesized and spoken but NOT pushed to `spoken[]`,
   * so scripted bridge phrases never appear in conversation history.
   */
  private async *orchestratorSay(
    userText: string,
    signal: AbortSignal
  ): AsyncIterable<{ text: string; filler: boolean }> {
    // Send only the most recent turns (excluding the just-pushed user turn) to
    // keep the prompt small so time-to-first-token stays low as the demo runs.
    const priorHistory = this.history.slice(0, -1);
    const recentHistory = priorHistory.slice(
      -VoiceSession.MAX_HISTORY_TURNS
    );

    for await (const cmd of this.orchestrator.runTurn(
      { text: userText, language: this.language },
      {
        history: recentHistory,
        buyerNotes: this.buyerNotes,
        agentName: this.agentName,
        learningsContext: this.learningsContext,
        role: this.role,
      },
      signal
    )) {
      if (signal.aborted) return;
      switch (cmd.type) {
        case "say": {
          // Gate out stage directions / filler so the agent's internal "I'll
          // click into this" narration never reaches the voice. See speechGateway.
          const clean = speechGateway(cmd.text);
          if (clean) yield { text: clean, filler: false };
          break;
        }
        case "filler": {
          const clean = speechGateway(cmd.text);
          if (clean) yield { text: clean, filler: true };
          break;
        }
        case "navigate":
          this.recorder.recordAction("navigate", cmd.url, this.turnCounter);
          break;
        case "screen_is_on":
          this.recorder.recordPage(cmd.page, this.turnCounter);
          this.send({ t: "screen_is_on", page: cmd.page });
          break;
        case "remember":
          this.recorder.recordRemember(cmd.note, cmd.noteType);
          this.send({ t: "remember", note: cmd.note, noteType: cmd.noteType });
          break;
        case "buyer_loaded":
          this.buyerNotes = cmd.notes ?? this.buyerNotes;
          this.send({
            t: "buyer_loaded",
            buyerId: cmd.buyerId,
            notes: cmd.notes,
          });
          break;
        case "set_phase":
          this.lastPhase = cmd.phase;
          this.recorder.recordPhase(cmd.phase);
          this.send({ t: "set_phase", phase: cmd.phase });
          // Also publish to the dashboard SSE channel so the live dashboard
          // panel receives phase transitions (spec §4.2 / §6).
          void publishPhase(this.buyerEmail, cmd.phase);
          break;
        default:
          break;
      }
    }
  }

  /**
   * Speak a stream of sentences with pipelined synthesis.
   *
   * Each sentence is synthesized into its own channel as soon as its text
   * arrives, so the *next* sentence's TTS request is already in flight while the
   * current one is still streaming to the client. A single consumer drains the
   * channels in order, so audio reaches the browser sequentially with no gaps
   * between sentences. Returns the sentences actually spoken (for history);
   * filler fragments are spoken aloud but excluded from the returned list.
   */
  private async pipelineSpeak(
    texts: AsyncIterable<{ text: string; filler: boolean }>,
    turn: number,
    signal: AbortSignal
  ): Promise<string[]> {
    const spoken: string[] = [];
    for await (const event of streamSpeechTurn({
      texts,
      tts: this.tts,
      language: this.language,
      turn,
      signal,
    })) {
      if (event.type === "say") {
        this.send({ t: "say", text: event.text, turn: event.turn });
        this.noteAgentWords(event.text);
        this.agentSpeaking = true;
        this.setState("speaking");
        if (!event.filler) spoken.push(event.text);
        continue;
      }
      if (event.type === "audio") {
        this.send({
          t: "tts_chunk",
          b64: event.chunk.toString("base64"),
          sampleRate: AUDIO_SAMPLE_RATE,
          turn: event.turn,
          seq: event.seq,
        });
        continue;
      }
      this.send({ t: "error", message: event.message });
    }

    return spoken;
  }

  /** Speak a one-off line (greeting) that may or may not be recorded in history. */
  private async speakTurn(text: string, recordAsUser: string | null) {
    this.cancelActive();
    this.recentAgentWords.clear();
    const turn = ++this.turnCounter;
    const abort = new AbortController();
    this.active = { turn, abort };
    if (recordAsUser) this.history.push({ role: "user", text: recordAsUser });

    const spoken = await this.pipelineSpeak(
      (async function* () {
        yield { text, filler: false };
      })(),
      turn,
      abort.signal
    );

    if (!abort.signal.aborted && spoken.length > 0) {
      this.history.push({ role: "agent", text: spoken.join(" ") });
      this.send({ t: "tts_end", turn });
      this.endSpeaking();
      this.setState("listening");
      this.active = null;
    }
  }

  /** Stop the agent mid-sentence and abandon the current response (barge-in). */
  private bargeIn() {
    if (!this.active) return;
    const turn = this.active.turn;
    this.cancelActive();
    this.agentSpeaking = false;
    this.send({ t: "barge_in", turn });
    this.setState("listening");
  }

  private cancelActive() {
    if (this.active) {
      this.active.abort.abort();
      this.active = null;
    }
  }

  private async setLanguage(language: Language) {
    this.detected = true; // an explicit choice opts out of auto-detect
    if (language === this.language) return;
    this.language = language;
    this.finals = [];
    this.cancelActive();
    if (this.stt) await this.openStt();
    this.send({ t: "ready", language: this.language, agentName: this.agentName });
  }

  private async stopListening() {
    this.cancelActive();
    await this.stopStt();
    this.setState("idle");
  }

  private async stopStt() {
    if (this.stt) {
      const stt = this.stt;
      this.stt = null;
      await stt.stop();
    }
  }

  private setState(state: "idle" | "listening" | "thinking" | "speaking") {
    this.send({ t: "agent_state", state });
  }

  private send(event: ServerEvent) {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    try {
      const bb = this.browserSessionId ?? undefined;
      const endedAt = Date.now();
      const durationSec = this.sessionCreatedAt
        ? Math.max(0, Math.round((endedAt - this.sessionCreatedAt) / 1000))
        : undefined;
      this.deps.finalizer.finalize({
        id: this.demoSessionId,
        browserSessionId: this.browserSessionId,
        company: this.company,
        status: "ended",
        buyerEmail: this.buyerEmail || undefined,
        buyerName: this.buyer?.buyerName,
        createdAt: this.sessionCreatedAt,
        endedAt,
        durationSec,
        phaseReached: this.lastPhase,
        liveViewUrl: this.liveViewUrl,
        language: this.language,
        replayStatus: bb ? "pending" : "unavailable",
        recorder: this.recorder,
        turns: this.history,
      });
    } catch {
      // Teardown must never throw out through ws close/error handlers.
    }
    this.cancelActive();
    void this.stopStt();
    if (this.browserSessionId) {
      void this.deps.stopSession(this.browserSessionId);
    }
  }
}
