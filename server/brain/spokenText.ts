/** Banned spoken meta-narration — the agent always has the screen; never say it aloud. */
const BANNED_SENTENCE = [
  /\blet me (take a )?look\b/i,
  /\blet me see\b/i,
  /\bwhat'?s on the screen\b/i,
  /\bon the screen right now\b/i,
  /\bi'?ll look (it )?up\b/i,
  /\bi will look (it )?up\b/i,
  /\blet me look (it )?up\b/i,
  /\blet me check\b/i,
  /\blet me pull that up\b/i,
  /\blet me show you\b/i,
  /\blet me navigate\b/i,
  /\bi'?ll click\b/i,
  /\blet me click\b/i,
  /\bone sec(ond)?\b/i,
  /\bgive me a (second|moment)\b/i,
  /\bnow let me\b/i,
  /\bi'?m (going to |gonna )?(look|check|see|read)\b/i,
  /\bi need to (look|check|see)\b/i,
  /\blooking at (the )?(screen|page)\b/i,
  /\breading (the )?(screen|page)\b/i,
  /\bhere'?s how browserbase handles\b/i,
];

function isBannedSentence(sentence: string): boolean {
  const s = sentence.trim();
  if (!s) return true;
  return BANNED_SENTENCE.some((p) => p.test(s));
}

/** Drop meta-narration sentences; return "" when nothing speakable remains. */
export function sanitizeSpokenText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => !isBannedSentence(s));
  return kept.join(" ").trim();
}
