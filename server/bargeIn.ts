/**
 * Barge-in (letting the user interrupt the agent) configuration + helpers.
 *
 * Modes (env `BARGE_IN`):
 *  - "off"    : half-duplex. Never interrupt; we stop listening while the agent
 *               speaks so it can't hear itself. Most reliable on speakers.
 *  - "vad"    : interrupt on any voice-activity onset. Snappiest, but the most
 *               sensitive to background noise / the agent's own echo.
 *  - "speech" : interrupt only when real speech is transcribed - a minimum number
 *               of (non-echo) words at a minimum confidence. Filters out noise;
 *               tune sensitivity with BARGE_IN_MIN_WORDS / BARGE_IN_MIN_CONFIDENCE.
 */
export type BargeMode = "off" | "vad" | "speech";

export interface BargeConfig {
  mode: BargeMode;
  /** Min real (non-echo) words to count a transcript as an interruption. */
  minWords: number;
  /** Min STT confidence (0-1) for a transcript to count as an interruption. */
  minConfidence: number;
}

export function readBargeConfig(): BargeConfig {
  const raw = (process.env.BARGE_IN ?? "off").trim().toLowerCase();
  let mode: BargeMode;
  if (raw === "vad" || raw === "instant") {
    mode = "vad";
  } else if (
    raw === "on" ||
    raw === "true" ||
    raw === "speech" ||
    raw === "yes" ||
    raw === "1"
  ) {
    mode = "speech";
  } else {
    mode = "off";
  }
  return {
    mode,
    minWords: clampInt(process.env.BARGE_IN_MIN_WORDS, 3, 1, 30),
    minConfidence: clampFloat(process.env.BARGE_IN_MIN_CONFIDENCE, 0.6, 0, 1),
  };
}

/** Split text into lowercased word tokens (Unicode-aware, for EN + ES). */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
}

/**
 * Count words in `text` that are NOT part of the agent's own recent speech.
 * The agent's voice leaking into the mic transcribes to its own words, so those
 * don't count - only genuinely new words (the user actually talking) do.
 */
export function novelWordCount(text: string, agentWords: Set<string>): number {
  let count = 0;
  for (const word of tokenize(text)) {
    if (!agentWords.has(word)) count++;
  }
  return count;
}

function clampInt(raw: string | undefined, def: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampFloat(raw: string | undefined, def: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}
