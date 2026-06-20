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

/** Pure: the exact params we send. Extracted so it's testable without a network call. */
export function buildParams(req: CompleteRequest) {
  return {
    model: "claude-opus-4-8" as const,
    max_tokens: 1024,
    thinking: { type: "adaptive" as const },
    output_config: { effort: "low" as const, format: zodOutputFormat(Reply) },
    system: [{ type: "text" as const, text: req.system, cache_control: { type: "ephemeral" as const } }],
    messages: req.messages,
  };
}

export async function complete(req: CompleteRequest): Promise<Reply> {
  if (useStub()) return Reply.parse(stub(req));
  const res = await getClient().messages.parse(buildParams(req));
  if (!res.parsed_output) {
    // Refusal / max_tokens / parse miss — degrade gracefully, never crash the loop.
    return { commands: [{ kind: "say", text: "Sorry — give me one second." }] };
  }
  return res.parsed_output;
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
