import type { WebSocket } from "ws";
import {
  DEFAULT_LANGUAGE,
  type Language,
  type ServerEvent,
  parseClientMessage,
} from "../lib/voice/messages";
import { DeepgramStt } from "./deepgram/stt";
import { createOrchestrator, type Orchestrator } from "./orchestrator";
import type { ConversationTurn } from "./orchestrator/types";
import { createTts, type TtsProvider } from "./tts";

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
  private buyerNotes: string[] = [];

  /** Finalized transcript segments for the in-progress user utterance. */
  private finals: string[] = [];

  private turnCounter = 0;
  /** The currently streaming agent turn, if any. */
  private active: { turn: number; abort: AbortController } | null = null;
  private agentSpeaking = false;

  constructor(
    private ws: WebSocket,
    private deepgramKey: string
  ) {
    this.tts = createTts();
    this.orchestrator = createOrchestrator();

    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        // Raw PCM from the mic -> Deepgram.
        this.stt?.sendAudio(data as Buffer);
      } else {
        this.onControl(data.toString());
      }
    });
    ws.on("close", () => this.dispose());
    ws.on("error", () => this.dispose());
  }

  private onControl(raw: string) {
    const msg = parseClientMessage(raw);
    if (!msg) return;
    switch (msg.t) {
      case "audio_start":
        void this.startListening(msg.language);
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
      case "text_input":
        this.send({ t: "user_said", text: msg.text, final: true });
        void this.runTurn(msg.text);
        break;
    }
  }

  private async startListening(language: Language) {
    this.language = language ?? DEFAULT_LANGUAGE;
    await this.openStt();
    this.send({ t: "ready", language: this.language });
    this.setState("listening");
    // GREET: Maya opens the conversation so the user hears the loop working.
    const greeting = await this.orchestrator.greeting?.(this.language);
    if (greeting) {
      await this.speakTurn(greeting, /* recordAsUser */ null);
    }
  }

  private async openStt() {
    await this.stopStt();
    const stt = new DeepgramStt(this.deepgramKey);

    stt.on("transcript", (t) => {
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

    // VAD onset while Maya is talking => the prospect is interrupting (P2C).
    stt.on("speechStarted", () => {
      if (this.agentSpeaking) this.bargeIn();
    });

    // Backstop: if we got finals but no speech_final, end on utterance end.
    stt.on("utteranceEnd", () => {
      if (this.finals.length > 0) this.endUtterance();
    });

    stt.on("error", (err) =>
      this.send({ t: "error", message: `STT: ${err.message}` })
    );

    await stt.start(this.language);
    this.stt = stt;
  }

  private endUtterance() {
    const text = this.finals.join(" ").trim();
    this.finals = [];
    if (!text) return;
    this.send({ t: "user_said", text, final: true });
    void this.runTurn(text);
  }

  /** Run a full agent turn for the given user input. */
  private async runTurn(userText: string) {
    // A new utterance supersedes any in-progress response.
    this.cancelActive();

    const turn = ++this.turnCounter;
    const abort = new AbortController();
    this.active = { turn, abort };

    this.history.push({ role: "user", text: userText });
    this.setState("thinking");

    const agentChunks: string[] = [];
    try {
      for await (const cmd of this.orchestrator.runTurn(
        { text: userText, language: this.language },
        { history: this.history.slice(0, -1), buyerNotes: this.buyerNotes },
        abort.signal
      )) {
        if (abort.signal.aborted) break;
        switch (cmd.type) {
          case "say":
            agentChunks.push(cmd.text);
            await this.speakFragment(cmd.text, turn, abort.signal);
            break;
          // Tolerated team-contract commands (P3/P4) - forward for the UI.
          case "screen_is_on":
            this.send({ t: "screen_is_on", page: cmd.page });
            break;
          case "remember":
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
          default:
            break;
        }
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        this.send({
          t: "error",
          message: `Orchestrator: ${(err as Error).message}`,
        });
      }
    }

    if (!abort.signal.aborted) {
      if (agentChunks.length > 0) {
        this.history.push({ role: "agent", text: agentChunks.join(" ") });
      }
      this.send({ t: "tts_end", turn });
      this.agentSpeaking = false;
      this.setState("listening");
      this.active = null;
    }
  }

  /** Speak a one-off line (greeting) that may or may not be recorded in history. */
  private async speakTurn(text: string, recordAsUser: string | null) {
    this.cancelActive();
    const turn = ++this.turnCounter;
    const abort = new AbortController();
    this.active = { turn, abort };
    if (recordAsUser) this.history.push({ role: "user", text: recordAsUser });

    await this.speakFragment(text, turn, abort.signal);

    if (!abort.signal.aborted) {
      this.history.push({ role: "agent", text });
      this.send({ t: "tts_end", turn });
      this.agentSpeaking = false;
      this.setState("listening");
      this.active = null;
    }
  }

  /** Send caption + synthesize one spoken fragment, streaming PCM to the client. */
  private async speakFragment(text: string, turn: number, signal: AbortSignal) {
    if (signal.aborted) return;
    this.send({ t: "say", text, turn });
    this.agentSpeaking = true;
    this.setState("speaking");

    let seq = 0;
    try {
      for await (const chunk of this.tts.synthesize(text, this.language, signal)) {
        if (signal.aborted) return;
        this.send({
          t: "tts_chunk",
          b64: chunk.toString("base64"),
          sampleRate: 24000,
          turn,
          seq: seq++,
        });
      }
    } catch (err) {
      if (!signal.aborted) {
        this.send({ t: "error", message: `TTS: ${(err as Error).message}` });
      }
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
    if (language === this.language) return;
    this.language = language;
    this.finals = [];
    this.cancelActive();
    if (this.stt) await this.openStt();
    this.send({ t: "ready", language: this.language });
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
    this.cancelActive();
    void this.stopStt();
  }
}
