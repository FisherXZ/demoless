import { DeepgramClient } from "@deepgram/sdk";
import { AUDIO_SAMPLE_RATE, type Language, LANGUAGES } from "../../lib/voice/messages";
import { getTtsSpeed, readStream, type TtsProvider } from "./index";

/**
 * Deepgram Aura-2 TTS via the REST streaming endpoint.
 *
 * We render one short sentence per request (the orchestrator streams sentences
 * to us) and stream the resulting raw linear16 PCM straight through. Short
 * requests keep first-audio latency low and sidestep the WS-TTS frame decoding
 * quirks in the SDK.
 */
export class DeepgramTts implements TtsProvider {
  private client: DeepgramClient;

  constructor() {
    this.client = new DeepgramClient({
      apiKey: process.env.DEEPGRAM_API_KEY ?? "",
    });
  }

  private modelFor(language: Language): string {
    if (language === "en") {
      return process.env.DEEPGRAM_TTS_MODEL ?? LANGUAGES.en.ttsModel;
    }
    return LANGUAGES[language]?.ttsModel ?? LANGUAGES.en.ttsModel;
  }

  async *synthesize(
    text: string,
    language: Language,
    signal: AbortSignal
  ): AsyncIterable<Buffer> {
    if (!text.trim() || signal.aborted) return;

    const res = await this.client.speak.v1.audio.generate(
      {
        text,
        model: this.modelFor(language),
        encoding: "linear16",
        sample_rate: AUDIO_SAMPLE_RATE,
        container: "none",
        // Aura-2 speaking-rate multiplier; 1.0 normal, >1 faster.
        speed: getTtsSpeed(),
      },
      { abortSignal: signal }
    );

    for await (const chunk of readStream(res.stream())) {
      if (signal.aborted) return;
      yield chunk;
    }
  }
}
