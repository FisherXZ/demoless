/**
 * Shared voice-agent wire contract (P2).
 *
 * This is the single source of truth for messages exchanged between the
 * browser client and the voice WebSocket gateway, plus the orchestrator
 * `Command` shape that forms the boundary with P1's LLM loop.
 *
 * It is intentionally isomorphic (pure types + plain constants, no Node or
 * browser APIs) so both the client (`@/lib/voice/messages`) and the server
 * (`../lib/voice/messages`) import the exact same definitions.
 *
 * Wire framing:
 *  - Control messages are JSON text frames (the unions below).
 *  - Microphone audio is sent client -> server as raw binary frames
 *    (linear16 PCM @ {@link AUDIO_SAMPLE_RATE}, mono).
 *  - Synthesized audio is sent server -> client as base64 inside
 *    {@link TtsChunkEvent} frames so it can be labeled with a turn + seq.
 */

/** Languages the voice loop can run in (P2D). Keep in sync with LANGUAGES. */
export type Language = "en" | "es";

export interface LanguageOption {
  code: Language;
  /** Human label for the toggle UI. */
  label: string;
  /** Deepgram STT language code. */
  sttLanguage: string;
  /** Deepgram Aura-2 TTS voice model for this language. */
  ttsModel: string;
}

/** Supported languages and their Deepgram STT/TTS settings. */
export const LANGUAGES: Record<Language, LanguageOption> = {
  en: {
    code: "en",
    label: "English",
    sttLanguage: "en-US",
    ttsModel: "aura-2-thalia-en",
  },
  es: {
    code: "es",
    label: "Espanol",
    sttLanguage: "es",
    ttsModel: "aura-2-celeste-es",
  },
};

export const DEFAULT_LANGUAGE: Language = "en";

/** Mic capture + TTS playback sample rate (Hz), mono linear16. */
export const AUDIO_SAMPLE_RATE = 24000;

/** High-level state of the agent, surfaced to the UI. */
export type AgentState = "idle" | "listening" | "thinking" | "speaking";

/* ----------------------------------------------------------------------- *
 * Orchestrator output (the P1 boundary)
 * ----------------------------------------------------------------------- */

/**
 * A command emitted by the orchestrator. `say` is the only one P2 acts on;
 * the rest are part of the shared team contract and are tolerated as no-ops
 * here so P3 (browser) / P4 (memory) can fill them in later.
 */
export type Command =
  | { type: "say"; text: string }
  /** Spoken aloud like `say` but excluded from conversation history. */
  | { type: "filler"; text: string }
  | { type: "navigate"; url: string }
  | { type: "click_or_type"; instruction: string }
  | { type: "screen_is_on"; page: string }
  | { type: "remember"; note: string; noteType?: string }
  | { type: "buyer_loaded"; buyerId: string; notes?: string[] }
  | { type: "set_phase"; phase: string }
  | { type: "done" };

/* ----------------------------------------------------------------------- *
 * Client -> Server
 * ----------------------------------------------------------------------- */

export interface AudioStartMessage {
  t: "audio_start";
  /** Sample rate of the PCM frames that will follow. */
  sampleRate: number;
  language: Language;
  /**
   * The visitor's self-reported role from the pre-call form. Used server-side
   * to pick an audience persona (technical vs non-technical) for the prompt.
   */
  role?: string;
}

export interface AudioStopMessage {
  t: "audio_stop";
}

export interface SetLanguageMessage {
  t: "set_language";
  language: Language;
}

/** Client detected a local interruption; ask the server to cancel the turn. */
export interface BargeInMessage {
  t: "barge_in";
}

/** Optional text injection (e.g. typed question) without using the mic. */
export interface TextInputMessage {
  t: "text_input";
  text: string;
  /** Visitor role for persona selection (see {@link AudioStartMessage.role}). */
  role?: string;
}

export type ClientMessage =
  | AudioStartMessage
  | AudioStopMessage
  | SetLanguageMessage
  | BargeInMessage
  | TextInputMessage;

/* ----------------------------------------------------------------------- *
 * Server -> Client
 * ----------------------------------------------------------------------- */

/** Gateway is connected and a Deepgram session is warming up / ready. */
export interface ReadyEvent {
  t: "ready";
  language: Language;
  /** Display name of the agent, derived from the selected voice model. */
  agentName: string;
}

/** A transcript of what the prospect said (P2A.2). `final` flips true on endpoint. */
export interface UserSaidEvent {
  t: "user_said";
  text: string;
  final: boolean;
}

/** The agent's spoken text for this fragment (drives captions). */
export interface SayEvent {
  t: "say";
  text: string;
  /** Monotonic turn id; lets the client group fragments + ignore stale ones. */
  turn: number;
}

/** A chunk of synthesized speech audio (base64 linear16 @ sampleRate). */
export interface TtsChunkEvent {
  t: "tts_chunk";
  b64: string;
  sampleRate: number;
  turn: number;
  seq: number;
}

/** All audio for a turn has been sent. */
export interface TtsEndEvent {
  t: "tts_end";
  turn: number;
}

export interface AgentStateEvent {
  t: "agent_state";
  state: AgentState;
}

/** Server instructs the client to stop playback immediately (barge-in). */
export interface ServerBargeInEvent {
  t: "barge_in";
  turn: number;
}

/** Tolerated team-contract events (P3/P4); forwarded for the UI to consume. */
export interface ScreenIsOnEvent {
  t: "screen_is_on";
  page: string;
}

export interface BuyerLoadedEvent {
  t: "buyer_loaded";
  buyerId: string;
  notes?: string[];
}

export interface RememberEvent {
  t: "remember";
  note: string;
  noteType?: string;
}

export interface SetPhaseEvent {
  t: "set_phase";
  phase: string;
}

export interface LiveViewEvent {
  t: "live_view";
  url: string;
}

export interface ErrorEvent {
  t: "error";
  message: string;
}

export type ServerEvent =
  | ReadyEvent
  | UserSaidEvent
  | SayEvent
  | TtsChunkEvent
  | TtsEndEvent
  | AgentStateEvent
  | ServerBargeInEvent
  | ScreenIsOnEvent
  | BuyerLoadedEvent
  | RememberEvent
  | SetPhaseEvent
  | LiveViewEvent
  | ErrorEvent;

/* ----------------------------------------------------------------------- *
 * Helpers
 * ----------------------------------------------------------------------- */

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj.t === "string") return obj as ClientMessage;
  } catch {
    /* not JSON */
  }
  return null;
}

export function parseServerEvent(raw: string): ServerEvent | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj.t === "string") return obj as ServerEvent;
  } catch {
    /* not JSON */
  }
  return null;
}
