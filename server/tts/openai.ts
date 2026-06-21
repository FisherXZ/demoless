import { type Language, LANGUAGES } from "../../lib/voice/messages";
import { getTtsSpeed, readStream, type TtsProvider } from "./provider";

/**
 * OpenAI text-to-speech (the /audio/speech endpoint).
 *
 * Used for languages Deepgram Aura-2 can't speak — currently Mandarin. We ask
 * for `response_format: "pcm"`, which OpenAI returns as raw linear16 @ 24 kHz
 * mono — exactly the pipeline's format ({@link AUDIO_SAMPLE_RATE}), so no
 * transcoding. We stream the response body straight through.
 */
export class OpenAiTts implements TtsProvider {
  private apiKey(): string {
    return process.env.OPENAI_API_KEY ?? "";
  }

  private model(): string {
    return process.env.OPENAI_TTS_MODEL ?? "tts-1";
  }

  private voiceFor(language: Language): string {
    // For openai-routed languages, ttsModel holds the OpenAI voice id.
    return LANGUAGES[language]?.ttsModel ?? "nova";
  }

  voiceName(language: Language): string {
    const v = this.voiceFor(language);
    return v.charAt(0).toUpperCase() + v.slice(1);
  }

  async *synthesize(
    text: string,
    language: Language,
    signal: AbortSignal
  ): AsyncIterable<Buffer> {
    if (!text.trim() || signal.aborted) return;

    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey()}`,
      },
      body: JSON.stringify({
        model: this.model(),
        voice: this.voiceFor(language),
        input: text,
        response_format: "pcm", // raw linear16 @ 24 kHz mono
        speed: getTtsSpeed(0.25, 4.0),
      }),
      signal,
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new Error(`OpenAI TTS ${res.status}: ${detail.slice(0, 200)}`);
    }

    for await (const chunk of readStream(res.body)) {
      if (signal.aborted) return;
      yield chunk;
    }
  }
}
