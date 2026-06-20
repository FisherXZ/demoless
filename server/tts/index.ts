import { DeepgramTts } from "./deepgram";
import { ElevenLabsTts } from "./elevenlabs";
import type { TtsProvider } from "./provider";

/** Pick the TTS provider from env (default: Deepgram Aura-2). */
export function createTts(): TtsProvider {
  const provider = (process.env.TTS_PROVIDER ?? "deepgram").toLowerCase();
  if (provider === "elevenlabs") {
    return new ElevenLabsTts();
  }
  return new DeepgramTts();
}

export type { TtsProvider } from "./provider";
export { getTtsSpeed, nameFromAuraModel, readStream } from "./provider";
