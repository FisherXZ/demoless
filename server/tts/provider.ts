import type { Language } from "../../lib/voice/messages";

/**
 * Provider-agnostic streaming text-to-speech contract + shared helpers.
 *
 * Kept separate from `index.ts` (the factory) so the concrete providers can
 * import these without creating an import cycle with the factory.
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

  /** Display name of the current voice (drives the agent's name in the UI). */
  voiceName(language: Language): string;
}

/**
 * Derive a human name from a Deepgram Aura voice model id.
 * e.g. "aura-2-thalia-en" -> "Thalia", "aura-asteria-en" -> "Asteria".
 */
export function nameFromAuraModel(model: string): string {
  const match = model.match(/^aura-(?:\d+-)?([a-z]+)-[a-z]{2}/i);
  const raw = match?.[1];
  if (!raw) return "Assistant";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
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
