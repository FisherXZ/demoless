import { EventEmitter } from "node:events";
import { DeepgramClient } from "@deepgram/sdk";
import { AUDIO_SAMPLE_RATE, type Language, LANGUAGES } from "../../lib/voice/messages";

/** Silence (ms) before a turn ends. Lower = snappier; default 250. */
function endpointingMs(): number {
  const raw = Number(process.env.STT_ENDPOINTING_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 250;
}

/**
 * Streaming speech-to-text over Deepgram Listen v1 (nova-3).
 *
 * Emits:
 *  - "transcript" { text, isFinal, speechFinal } - interim + final results (P2A.2)
 *  - "speechStarted"   - VAD onset; used to trigger barge-in (P2C)
 *  - "utteranceEnd"    - endpoint reached, the user has stopped speaking
 *  - "open" / "close" / "error"
 */
export interface SttTranscript {
  text: string;
  isFinal: boolean;
  speechFinal: boolean;
  /** Deepgram's confidence for this result (0-1); 1 if unavailable. */
  confidence: number;
}

export interface SttEvents {
  transcript: (t: SttTranscript) => void;
  speechStarted: () => void;
  utteranceEnd: () => void;
  open: () => void;
  close: () => void;
  error: (err: Error) => void;
}

export declare interface DeepgramStt {
  on<E extends keyof SttEvents>(event: E, listener: SttEvents[E]): this;
  emit<E extends keyof SttEvents>(
    event: E,
    ...args: Parameters<SttEvents[E]>
  ): boolean;
}

export class DeepgramStt extends EventEmitter {
  private client: DeepgramClient;
  private socket: Awaited<ReturnType<DeepgramClient["listen"]["v1"]["connect"]>> | null = null;
  private keepAlive: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(private apiKey: string) {
    super();
    this.client = new DeepgramClient({ apiKey });
  }

  async start(language: Language): Promise<void> {
    const lang = LANGUAGES[language] ?? LANGUAGES.en;

    const socket = await this.client.listen.v1.connect({
      model: "nova-3",
      language: lang.sttLanguage,
      encoding: "linear16",
      sample_rate: AUDIO_SAMPLE_RATE,
      channels: 1,
      interim_results: "true",
      smart_format: "true",
      punctuate: "true",
      // Endpointing = silence (ms) before the user's turn is considered done.
      // Lower = snappier replies, but too low can cut people off mid-pause.
      // Tune with STT_ENDPOINTING_MS.
      endpointing: endpointingMs(),
      utterance_end_ms: 1000,
      vad_events: "true",
      Authorization: `Token ${this.apiKey}`,
    });

    this.socket = socket;

    socket.on("open", () => {
      this.emit("open");
      // Keep the socket warm during silence so reconnects don't add latency.
      this.keepAlive = setInterval(() => {
        try {
          socket.sendKeepAlive({ type: "KeepAlive" });
        } catch {
          /* socket gone */
        }
      }, 8000);
    });

    socket.on("message", (msg) => {
      if (msg.type === "Results") {
        const alt = msg.channel?.alternatives?.[0];
        const text = alt?.transcript ?? "";
        if (text.trim().length === 0) return;
        this.emit("transcript", {
          text,
          isFinal: Boolean(msg.is_final),
          speechFinal: Boolean(msg.speech_final),
          confidence:
            typeof alt?.confidence === "number" ? alt.confidence : 1,
        });
      } else if (msg.type === "SpeechStarted") {
        this.emit("speechStarted");
      } else if (msg.type === "UtteranceEnd") {
        this.emit("utteranceEnd");
      }
    });

    socket.on("error", (err) => this.emit("error", err));
    socket.on("close", () => {
      this.clearKeepAlive();
      this.emit("close");
    });

    socket.connect();
    await socket.waitForOpen();
  }

  /** Forward a chunk of raw PCM (linear16) audio to Deepgram. */
  sendAudio(chunk: Buffer | ArrayBuffer | Uint8Array): void {
    if (this.closed || !this.socket) return;
    try {
      this.socket.sendMedia(chunk as ArrayBufferView);
    } catch {
      /* socket not open yet */
    }
  }

  async stop(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.clearKeepAlive();
    if (this.socket) {
      try {
        this.socket.sendCloseStream({ type: "CloseStream" });
      } catch {
        /* ignore */
      }
      try {
        this.socket.close();
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
  }

  private clearKeepAlive() {
    if (this.keepAlive) {
      clearInterval(this.keepAlive);
      this.keepAlive = null;
    }
  }
}
