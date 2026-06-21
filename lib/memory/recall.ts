import type { BuyerMemory, Note, Recall } from "./types";

/** Rank notes by importance, then most-recent. Returns a new array. */
function ranked(notes: Note[]): Note[] {
  return [...notes].sort((a, b) =>
    b.importance !== a.importance ? b.importance - a.importance : b.ts - a.ts
  );
}

function textsOfType(notes: Note[], ...types: Note["type"][]): string[] {
  return ranked(notes)
    .filter((n) => types.includes(n.type))
    .map((n) => n.text)
    .filter((text): text is string => typeof text === "string" && text.length > 0);
}

/** Join a short list into prose: ["a","b","c"] -> "a, b and c". */
function prose(items: string[]): string {
  /* v8 ignore next -- composeRecall only calls this with one or more strings. */
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Build structured recall + a "welcome back…" line from a buyer's notes (P4C).
 * `line` is empty for a buyer with no notes; callers decide whether to speak it.
 */
export function composeRecall(notes: Note[]): Recall {
  const topInterests = textsOfType(notes, "interest", "preference").slice(0, 3);
  const painPoints = textsOfType(notes, "pain_point").slice(0, 3);
  const objections = textsOfType(notes, "objection").slice(0, 3);
  const nextStep = textsOfType(notes, "next_step")[0];

  // What they "cared about": interests first, then pains, capped at 2 for a
  // natural-sounding greeting.
  const cared = [...topInterests, ...painPoints].slice(0, 2);
  const line = cared.length
    ? `Welcome back — last time you cared about ${prose(cared)}.`
    : "";

  return { line, topInterests, painPoints, objections, nextStep };
}

/**
 * Compact text block for P1C to drop into the prompt each turn (P4B).
 * Returns "" when there's nothing useful to inject.
 */
export function buildMemoryContext(memory: BuyerMemory): string {
  const { profile, recall, isReturning } = memory;

  const lines: string[] = [];
  const who = [profile.name, profile.role, profile.company]
    .filter(Boolean)
    .join(", ");
  if (who) lines.push(`Buyer: ${who}`);
  if (profile.useCase) lines.push(`Use case: ${profile.useCase}`);
  if (isReturning) lines.push(`Returning buyer (visit #${profile.visitCount}).`);

  if (recall.topInterests.length)
    lines.push(`Cares about: ${recall.topInterests.join("; ")}`);
  if (recall.painPoints.length)
    lines.push(`Pain points: ${recall.painPoints.join("; ")}`);
  if (recall.objections.length)
    lines.push(`Open objections: ${recall.objections.join("; ")}`);
  if (recall.nextStep) lines.push(`Suggested next step: ${recall.nextStep}`);

  if (!lines.length) return "";
  return `Known buyer memory:\n${lines.map((l) => `- ${l}`).join("\n")}`;
}
