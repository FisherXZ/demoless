import { AUDIO_SAMPLE_RATE, type Language } from "../../lib/voice/messages";
import { readStream, type TtsProvider } from "./index";

/**
 * Optional ElevenLabs TTS provider (set TTS_PROVIDER=elevenlabs).
 *
 * Streams raw linear16 PCM at AUDIO_SAMPLE_RATE so it is interchangeable with
 * the Deepgram provider. Requires ELEVENLABS_API_KEY; voice/model are
 * configurable via env.
 */
export class ElevenLabsTts implements TtsProvider {
  private apiKey: string;
  private voiceId: string;
  private modelId: string;

  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY ?? "";
    // Default to "Rachel"; override with ELEVENLABS_VOICE_ID.
    this.voiceId = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
    this.modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_turbo_v2_5";
  }

  async *synthesize(
    text: string,
    _language: Language,
    signal: AbortSignal
  ): AsyncIterable<Buffer> {
    if (!text.trim() || signal.aborted) return;
    if (!this.apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not set");
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream?output_format=pcm_${AUDIO_SAMPLE_RATE}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ text, model_id: this.modelId }),
      signal,
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new Error(`ElevenLabs TTS failed (${res.status}): ${detail}`);
    }

    for await (const chunk of readStream(res.body as ReadableStream<Uint8Array>)) {
      if (signal.aborted) return;
      yield chunk;
    }
  }
}
