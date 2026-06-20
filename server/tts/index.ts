import type { Language } from "../../lib/voice/messages";
import { DeepgramTts } from "./deepgram";
import { ElevenLabsTts } from "./elevenlabs";

/**
 * Provider-agnostic streaming text-to-speech.
 *
 * `synthesize` yields raw linear16 PCM chunks (mono @ AUDIO_SAMPLE_RATE) as
 * they arrive, so the session can forward audio to the browser before the
 * whole sentence is rendered. `signal` aborts synthesis on barge-in.
 */
export interface TtsProvider {
  synthesize(
    text: string,
    language: Language,
    signal: AbortSignal
  ): AsyncIterable<Buffer>;
}

/**
 * Speech-rate multiplier from env (TTS_SPEED). 1.0 = normal, >1 = faster.
 * `min`/`max` clamp to each provider's supported range.
 */
export function getTtsSpeed(min = 0.5, max = 2.0): number {
  const raw = Number(process.env.TTS_SPEED);
  if (!Number.isFinite(raw) || raw <= 0) return 1.0;
  return Math.min(max, Math.max(min, raw));
}

/** Pick the TTS provider from env (default: Deepgram Aura-2). */
export function createTts(): TtsProvider {
  const provider = (process.env.TTS_PROVIDER ?? "deepgram").toLowerCase();
  if (provider === "elevenlabs") {
    return new ElevenLabsTts();
  }
  return new DeepgramTts();
}

/** Iterate a WHATWG ReadableStream as Buffers (Node 18+). */
export async function* readStream(
  stream: ReadableStream<Uint8Array> | null
): AsyncIterable<Buffer> {
  if (!stream) return;
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) yield Buffer.from(value);
    }
  } finally {
    reader.releaseLock();
  }
}
