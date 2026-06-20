// LAYER 2 — Model Layer. A pure function: prompt in, validated Reply out. It
// knows nothing about sessions, ws, or state — which is why it's a clean swap
// point (model/effort/caching live here).
//
// THIS IS A STUB. Step 1 of the implementation plan replaces the body with
// `client.messages.parse({ model: "claude-opus-4-8", output_config: { format:
// zodOutputFormat(Reply) }, ... })`. The signature stays the same.

import { Reply } from "../shared/contract";
import type { LoopState, TurnType } from "./state";

export interface CompleteRequest {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  turn: TurnType;
  state: LoopState;
}

export async function complete(req: CompleteRequest): Promise<Reply> {
  const canned = stub(req);
  // Validate the stub against the same schema the real model output will use,
  // so the Layer 1↔2 contract is exercised from day one.
  return Reply.parse(canned);
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
    return {
      commands: [
        { kind: "say", text: `(stub) Here's ${req.state.screen?.summary ?? "the page"}.` },
      ],
    };
  }

  // human turn — exercise say + navigate + remember + a tour directive
  return {
    commands: [
      { kind: "say", text: `(stub) You said: "${lastUser}". Let me pull that up.` },
      { kind: "navigate", target: "dashboard" },
      { kind: "remember", note: { type: "interest", value: lastUser.slice(0, 60) } },
    ],
    tour: "stay",
  };
}
