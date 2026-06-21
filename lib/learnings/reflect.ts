// Write path for cross-session learnings: distill a finished demo transcript
// into <=3 generalizable rules-of-thumb via one LLM call, then persist them.
// Called fire-and-forget from VoiceSession.dispose() on socket close.
import Anthropic from "@anthropic-ai/sdk";
import { writeLearnings } from "./store";
import type { LearningInput } from "./types";

/** Minimal transcript turn shape (decoupled from server types). */
export type ReflectTurn = { role: "user" | "agent"; text: string };

/** Injectable model call so the writer is testable without a network call. */
export type ChatFn = (system: string, user: string) => Promise<string>;

const SYSTEM = `You are reviewing a finished product-demo conversation to extract durable lessons that will help FUTURE demos of the SAME product go better.
Output ONLY general, reusable rules-of-thumb about how to RUN the demo — what to show, in what order, how to handle objections, what resonates. Do NOT output facts about this one visitor, and do NOT output product facts.
Return ONLY a JSON array (max 3 items), each: {"text": string, "confidence": number between 0 and 1}. If nothing generalizes, return [].`;

function buildUserPrompt(turns: ReflectTurn[], phaseReached?: string): string {
  const transcript = turns
    .map((t) => `${t.role === "agent" ? "Rep" : "Visitor"}: ${t.text}`)
    .join("\n");
  return `Demo reached phase: ${phaseReached ?? "unknown"}.\n\nTranscript:\n${transcript}`;
}

/** Lenient extraction: pull the first [...] array out of model output. */
export function parseLearnings(raw: string): LearningInput[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  try {
    const arr = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.text === "string" && x.text.trim())
      .map((x) => ({
        text: String(x.text).trim(),
        confidence: typeof x.confidence === "number" ? x.confidence : 0.5,
      }))
      .slice(0, 3);
  } catch {
    return [];
  }
}

const defaultChat: ChatFn = async (system, user) => {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
  const res = await client.messages.create({
    model,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: user }],
  });
  return (
    res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ??
    ""
  );
};

/** Distill a transcript into learnings (no persistence). */
export async function reflectOnSession(
  turns: ReflectTurn[],
  phaseReached?: string,
  chat: ChatFn = defaultChat
): Promise<LearningInput[]> {
  const raw = await chat(SYSTEM, buildUserPrompt(turns, phaseReached));
  return parseLearnings(raw);
}

/** Fire-and-forget entry from session teardown: reflect, then persist. Never throws. */
export async function reflectAndStore(args: {
  company: string;
  turns: ReflectTurn[];
  phaseReached?: string;
  chat?: ChatFn;
}): Promise<void> {
  try {
    // Nothing to learn unless the visitor actually spoke. A greeting-only
    // session pushes one agent turn to history, so gate on a real user turn
    // (not just non-empty history) to avoid spending an LLM call on it.
    if (!args.turns.some((t) => t.role === "user")) return;
    const learnings = await reflectOnSession(
      args.turns,
      args.phaseReached,
      args.chat
    );
    await writeLearnings(args.company, learnings);
    console.log(
      `[learnings] reflection wrote ${learnings.length} learning(s) for ${args.company}`
    );
  } catch (err) {
    console.error("[learnings] reflectAndStore failed:", err);
  }
}
