import type { SearchHit } from "./types";

const SNIPPET = 320;

/**
 * Format retrieved chunks into a compact grounding block for P1C's prompt — the
 * RAG counterpart to `buildMemoryContext` in the P4 memory layer. Returns "" when
 * there's nothing to ground on, so the caller can omit it.
 */
export function buildAnswerContext(hits: SearchHit[]): string {
  if (!hits.length) return "";

  const lines = hits.map((h) => {
    const label = h.title ? `[${h.title}] ` : "";
    const body = h.text.replace(/\s+/g, " ").trim();
    const text = body.length > SNIPPET ? `${body.slice(0, SNIPPET).trimEnd()}…` : body;
    return `- ${label}${text}`;
  });

  return `Product knowledge (answer from this; do not invent facts):\n${lines.join(
    "\n"
  )}`;
}
