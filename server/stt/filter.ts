/** Common phrases from video/audio bleed — not something the visitor said. */
const PHANTOM_PATTERNS = [
  /thank you (so much )?for watching/i,
  /thanks for watching/i,
  /please subscribe/i,
  /like and subscribe/i,
  /smash that like button/i,
  /see you (in the )?next (one|video)/i,
  /don't forget to subscribe/i,
];

export function isPhantomTranscript(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return PHANTOM_PATTERNS.some((p) => p.test(trimmed));
}

/** Minimum Deepgram confidence before we treat speech as the visitor (0–1). */
export function minUserSttConfidence(): number {
  const raw = Number(process.env.STT_MIN_CONFIDENCE);
  if (!Number.isFinite(raw)) return 0.55;
  return Math.min(1, Math.max(0, raw));
}

export function shouldDropUserTranscript(
  text: string,
  confidence: number,
  isFinal: boolean
): boolean {
  if (isPhantomTranscript(text)) return true;
  // Interim results are noisy — only enforce confidence on finalized segments.
  if (isFinal && confidence < minUserSttConfidence()) return true;
  return false;
}
