// Cross-session "demo learnings" store: one append-only Redis stream per
// company. Write path appends model-distilled rules-of-thumb; read path ranks
// them (confidence, then recency — same shape as lib/memory's composeRecall)
// and formats the top-K into a prompt block. No vector search by design:
// hackathon volume ranks fine without it.
import { getRedis } from "../memory/redis";
import { learningsKey } from "./keys";
import type { Learning, LearningInput } from "./types";

/** Hard cap on stream length (approximate trim) to bound memory growth. */
export const MAX_LEARNINGS = 200;
/** How many learnings to inject into a session's prompt. */
export const TOP_K = 5;
/**
 * Minimum confidence to ever inject a learning. The cheapest guard against the
 * literature's #1 failure mode (a low-confidence bad reflection poisoning every
 * future demo): below this floor, a learning is stored for audit but never read
 * into a prompt.
 */
export const MIN_CONFIDENCE = 0.3;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

/** Append distilled learnings to the company stream, then cap its length. */
export async function writeLearnings(
  company: string,
  inputs: LearningInput[]
): Promise<void> {
  if (!inputs.length) return;
  const redis = getRedis();
  const key = learningsKey(company);
  const ts = Date.now();
  for (const input of inputs) {
    await redis.xadd(
      key,
      "*",
      "text", input.text,
      "confidence", String(clamp01(input.confidence)),
      "ts", String(ts)
    );
  }
  // Approximate trim keeps the newest ~MAX_LEARNINGS entries (O(1)-ish).
  await redis.xtrim(key, "MAXLEN", "~", MAX_LEARNINGS);
}

function parseLearning(id: string, flat: string[]): Learning {
  const f: Record<string, string> = {};
  for (let i = 0; i < flat.length; i += 2) f[flat[i]] = flat[i + 1];
  return { id, text: f.text, confidence: Number(f.confidence), ts: Number(f.ts) };
}

/** Read all learnings for a company (chronological). */
export async function getLearnings(company: string): Promise<Learning[]> {
  const redis = getRedis();
  const entries = await redis.xrange(learningsKey(company), "-", "+");
  return entries.map(([id, flat]) => parseLearning(id, flat));
}

/** Rank by confidence desc, then most-recent. Returns a new array. */
export function rankLearnings(learnings: Learning[]): Learning[] {
  return [...learnings].sort((a, b) =>
    b.confidence !== a.confidence ? b.confidence - a.confidence : b.ts - a.ts
  );
}

/** Top-K formatted prompt block for injection; "" when there is nothing. */
export function buildLearningsContext(
  learnings: Learning[],
  k = TOP_K
): string {
  const top = rankLearnings(learnings)
    .filter((l) => l.confidence >= MIN_CONFIDENCE)
    .slice(0, k);
  if (!top.length) return "";
  return `Past demo learnings (apply what's relevant, ignore what isn't):\n${top
    .map((l) => `- ${l.text}`)
    .join("\n")}`;
}
