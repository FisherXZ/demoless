import { DeepgramTts } from "./deepgram";
import { ElevenLabsTts } from "./elevenlabs";
import { OpenAiTts } from "./openai";
import { LANGUAGES, type Language, type TtsProviderName } from "../../lib/voice/messages";
import type { TtsProvider } from "./provider";

function makeProvider(name: TtsProviderName): TtsProvider {
  if (name === "elevenlabs") return new ElevenLabsTts();
  if (name === "openai") return new OpenAiTts();
  return new DeepgramTts();
}

/**
 * Routes TTS per language: a language can pin its own backend (e.g. Mandarin →
 * OpenAI, since Deepgram Aura-2 can't speak Chinese); everything else uses the
 * env default. Providers are created lazily and cached.
 */
class RoutingTts implements TtsProvider {
  private cache = new Map<TtsProviderName, TtsProvider>();
  constructor(private base: TtsProviderName) {}

  private providerFor(language: Language): TtsProvider {
    const name = LANGUAGES[language]?.ttsProvider ?? this.base;
    let p = this.cache.get(name);
    if (!p) {
      p = makeProvider(name);
      this.cache.set(name, p);
    }
    return p;
  }

  synthesize(text: string, language: Language, signal: AbortSignal) {
    return this.providerFor(language).synthesize(text, language, signal);
  }

  voiceName(language: Language): string {
    return this.providerFor(language).voiceName(language);
  }
}

/** Pick the default TTS provider from env (Deepgram Aura-2), with per-language
 *  overrides applied via {@link RoutingTts}. */
export function createTts(): TtsProvider {
  const base = (process.env.TTS_PROVIDER ?? "deepgram").toLowerCase();
  const baseName: TtsProviderName =
    base === "elevenlabs" || base === "openai" ? base : "deepgram";
  return new RoutingTts(baseName);
}

export type { TtsProvider } from "./provider";
export { getTtsSpeed, nameFromAuraModel, readStream } from "./provider";
