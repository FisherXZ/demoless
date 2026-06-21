// LAYER 2 — Model Layer. Pure function: prompt in, validated Reply out.
// Real call uses claude-opus-4-8 structured outputs; falls back to the stub
// when USE_STUB=1 or no API key (so the frontend works offline).

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Reply } from "../shared/contract";
import type { LoopState, TurnType } from "./state";

export interface CompleteRequest {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  turn: TurnType;
  state: LoopState;
}

const useStub = () => process.env.USE_STUB === "1" || !process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const GRACEFUL: Reply = { commands: [{ kind: "say", text: "Sorry — give me one second." }] };

/** Pure: the exact params we send. Extracted so it's testable without a network call. */
export function buildParams(req: CompleteRequest) {
  return {
    model: "claude-opus-4-8" as const,
    // Thinking is OFF for this loop: a live demo agent needs snappy turns, and
    // adaptive thinking competed for the token budget and truncated the JSON
    // mid-string. 2048 leaves ample room for the commands + a long `say`.
    max_tokens: 2048,
    output_config: { effort: "low" as const, format: zodOutputFormat(Reply) },
    system: [{ type: "text" as const, text: req.system, cache_control: { type: "ephemeral" as const } }],
    messages: req.messages,
  };
}

const VALID_KIND = new Set(["say", "navigate", "click_or_type", "remember"]);
const VALID_NOTE = new Set(["objection", "interest", "role", "question"]);
const VALID_PHASE = new Set(["HOOK", "DISCOVERY", "WALKTHROUGH", "CLOSE", "DONE"]);
const VALID_TOUR = new Set(["advance", "stay", "resume"]);

/**
 * Coerce the model's JSON into a valid Reply instead of rejecting the whole turn.
 * Structured outputs GUIDES generation but doesn't hard-enforce our enums, so the
 * model occasionally emits e.g. note.type:"pain". Rather than 400 the turn, we
 * keep the valid commands and snap stray enums to safe defaults.
 */
export function coerceReply(raw: unknown): Reply {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: Reply = { commands: [] };
  for (const c of Array.isArray(r.commands) ? (r.commands as Record<string, unknown>[]) : []) {
    if (!c || !VALID_KIND.has(c.kind as string)) continue;
    if (c.kind === "say" && typeof c.text === "string") out.commands.push({ kind: "say", text: c.text });
    else if (c.kind === "navigate" && typeof c.target === "string") out.commands.push({ kind: "navigate", target: c.target });
    else if (c.kind === "click_or_type" && typeof c.instruction === "string") out.commands.push({ kind: "click_or_type", instruction: c.instruction });
    else if (c.kind === "remember") {
      const note = c.note as Record<string, unknown> | undefined;
      if (note && typeof note.value === "string") {
        const type = VALID_NOTE.has(note.type as string) ? (note.type as "objection" | "interest" | "role" | "question") : "interest";
        out.commands.push({ kind: "remember", note: { type, value: note.value } });
      }
    }
  }
  if (typeof r.phase === "string" && VALID_PHASE.has(r.phase)) out.phase = r.phase as Reply["phase"];
  if (typeof r.tour === "string" && VALID_TOUR.has(r.tour)) out.tour = r.tour as Reply["tour"];
  else if (r.tour && typeof r.tour === "object" && typeof (r.tour as Record<string, unknown>).jump === "number") {
    out.tour = { jump: (r.tour as { jump: number }).jump };
  }
  if (Array.isArray(r.select)) out.select = (r.select as unknown[]).filter((s): s is string => typeof s === "string");
  return out;
}

export interface StreamRequest { system: string; messages: Anthropic.MessageParam[]; tools: Anthropic.Tool[]; signal?: AbortSignal }
export type ModelEvent =
  | { kind: "text"; delta: string }
  | { kind: "tool_use"; id: string; name: string; input: any }
  | { kind: "end" };

const MODEL = () => process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export async function* streamWithTools(req: StreamRequest): AsyncIterable<ModelEvent> {
  const stream = getClient().messages.stream({
    model: MODEL(), max_tokens: 2048, system: req.system, messages: req.messages, tools: req.tools,
    // 2048: matches main (e167048), avoids mid-output truncation
  }, { signal: req.signal });
  const toolBuf: Record<string, { name: string; json: string }> = {};
  for await (const ev of stream as any) {
    if (ev.type === "content_block_start" && ev.content_block?.type === "tool_use")
      toolBuf[ev.index] = { name: ev.content_block.name, json: "" };
    else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta")
      yield { kind: "text", delta: ev.delta.text };
    else if (ev.type === "content_block_delta" && ev.delta?.type === "input_json_delta")
      toolBuf[ev.index].json += ev.delta.partial_json;
    else if (ev.type === "content_block_stop" && toolBuf[ev.index]) {
      const b = toolBuf[ev.index];
      yield { kind: "tool_use", id: String(ev.index), name: b.name, input: b.json ? JSON.parse(b.json) : {} };
    }
  }
  yield { kind: "end" };
}

export async function complete(req: CompleteRequest): Promise<Reply> {
  if (useStub()) return Reply.parse(stub(req));
  try {
    // messages.create (not .parse): structured output still guides generation,
    // but we parse leniently + coerce so a single stray enum doesn't kill the turn.
    const res = await getClient().messages.create(buildParams(req));
    const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
    const reply = coerceReply(JSON.parse(text));
    return reply.commands.length > 0 ? reply : GRACEFUL;
  } catch (err) {
    console.error("[model] complete failed:", err);
    return GRACEFUL;
  }
}

function stub(req: CompleteRequest): Reply {
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (req.turn === "greet") {
    const b = req.state.buyer;
    const text =
      b && b.notes.length > 0
        ? `Welcome back${b.name ? ", " + b.name : ""}! Last time you were curious about "${b.notes[b.notes.length - 1].value}". Want to pick up there?`
        : `Hi — I'm your demo guide. Before I show you anything: what brought you here today?`;
    return { commands: [{ kind: "say", text }] };
  }
  if (req.turn === "screen") {
    return { commands: [{ kind: "say", text: `(stub) Here's ${req.state.screen?.summary ?? "the page"}.` }] };
  }
  return {
    commands: [
      { kind: "say", text: `(stub) You said: "${lastUser}". Let me pull that up.` },
      { kind: "navigate", target: "dashboard" },
      { kind: "remember", note: { type: "interest", value: lastUser.slice(0, 60) } },
    ],
    tour: "stay",
  };
}
