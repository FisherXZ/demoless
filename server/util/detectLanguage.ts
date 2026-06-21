import { type Language, LANGUAGES } from "../../lib/voice/messages";

/**
 * First-utterance language detection via OpenAI Whisper.
 *
 * Deepgram's auto-detect (language=multi) doesn't cover Mandarin, so we run the
 * buffered first utterance through Whisper — which detects ~100 languages — and
 * lock the session to whatever it returns. Whisper also gives us an accurate
 * transcript of that first turn (Deepgram, fixed to a default language, may have
 * mis-heard it), so we return both.
 */

export interface DetectResult {
  /** One of our supported languages, or null if unrecognized/unsupported. */
  language: Language | null;
  /** Whisper's transcript of the utterance (accurate for the detected language). */
  text: string;
}

// Whisper reports the language as a full English name ("chinese") on most
// responses; accept ISO codes too, just in case.
const WHISPER_LANG_MAP: Record<string, Language> = {
  english: "en",
  en: "en",
  spanish: "es",
  es: "es",
  chinese: "zh",
  mandarin: "zh",
  zh: "zh",
};

/** Wrap raw linear16 mono PCM in a WAV container so Whisper can decode it. */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // audio format = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function detectLanguage(
  pcm: Buffer,
  sampleRate: number,
  signal?: AbortSignal
): Promise<DetectResult> {
  if (pcm.length === 0) return { language: null, text: "" };

  const wav = pcmToWav(pcm, sampleRate);
  const form = new FormData();
  // Wrap in a fresh Uint8Array so it's a clean ArrayBuffer-backed BlobPart.
  form.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "utterance.wav");
  form.append("model", process.env.WHISPER_MODEL ?? "whisper-1");
  form.append("response_format", "verbose_json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}` },
    body: form,
    signal,
  });
  if (!res.ok) {
    throw new Error(`Whisper ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }

  const data = (await res.json()) as { language?: string; text?: string };
  const key = (data.language ?? "").trim().toLowerCase();
  const mapped = WHISPER_LANG_MAP[key] ?? null;
  // Only accept languages the demo is actually configured for.
  const language = mapped && mapped in LANGUAGES ? mapped : null;
  return { language, text: (data.text ?? "").trim() };
}
