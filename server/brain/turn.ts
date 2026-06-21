import type Anthropic from "@anthropic-ai/sdk";
import { streamWithTools as defaultStream, type ModelEvent } from "../model";
import { TOOLS } from "./tools";
import type { ToolName } from "./tools";
import type { ToolExecutor } from "./executor";
import { SentenceChunker } from "../util/sentenceChunker";   // REVIEW FIX improvement 2
import type { Command } from "../../lib/voice/messages";      // REVIEW FIX B1: the ONE shared union
import { sanitizeSpokenText } from "./spokenText";

function say(text: string): Command | null {
  const clean = sanitizeSpokenText(text);
  return clean ? { type: "say", text: clean } : null;
}

export interface TurnArgs {
  system: string;
  messages: Anthropic.MessageParam[];
  executor: ToolExecutor;
  signal: AbortSignal;
  stream?: (req: any) => AsyncIterable<ModelEvent>;
}

export async function* runTurn(args: TurnArgs): AsyncIterable<Command> {
  const stream = args.stream ?? defaultStream;
  const messages = [...args.messages];
  for (let hop = 0; hop < 8; hop++) {
    if (args.signal.aborted) break;
    const chunker = new SentenceChunker();
    const toolCalls: { id: string; name: ToolName; input: any }[] = [];
    let textForHistory = "";
    for await (const ev of stream({ system: args.system, messages, tools: TOOLS, signal: args.signal })) {
      if (args.signal.aborted) { yield { type: "done" }; return; }
      if (ev.kind === "text") {
        textForHistory += ev.delta;
        for (const s of chunker.push(ev.delta)) {
          const cmd = say(s);
          if (cmd) yield cmd;
        }
      } else if (ev.kind === "tool_use") {
        toolCalls.push({ id: ev.id, name: ev.name as ToolName, input: ev.input });
      }
    }
    const tail = chunker.flush();
    const tailCmd = tail.trim() ? say(tail.trim()) : null;
    if (tailCmd) yield tailCmd;
    if (!toolCalls.length) { yield { type: "done" }; return; }

    // record assistant turn (text + tool_use) then execute and feed results back
    const assistant: any[] = [];
    if (textForHistory.trim()) assistant.push({ type: "text", text: textForHistory });
    for (const t of toolCalls) assistant.push({ type: "tool_use", id: t.id, name: t.name, input: t.input });
    messages.push({ role: "assistant", content: assistant });

    const results: any[] = [];
    for (const t of toolCalls) {
      // No spoken filler while tools run — the agent must lead with real value,
      // not stage directions ("let me take a look", "one sec"). Silence during a
      // click is fine; a sharp rep narrates the payoff, not the mechanics.
      const r = await args.executor.run(t.name, t.input, args.signal); // REVIEW FIX improvement 3: thread signal
      if (t.name === "navigate") yield { type: "navigate", url: t.input.url };
      if (t.name === "set_phase") yield { type: "set_phase", phase: t.input.phase };
      if (t.name === "remember") yield { type: "remember", note: t.input.note, noteType: t.input.type };
      if (t.name === "navigate" || t.name === "click" || t.name === "look") {
        // Emit a concise page label (Title line from pageToText output), not a
        // raw 200-char text dump. Falls back to the navigate target URL.
        const titleMatch = r.content.match(/^Title: (.+)$/m);
        const urlMatch = r.content.match(/^URL: (.+)$/m);
        const page = titleMatch?.[1]?.trim() || urlMatch?.[1]?.trim() || t.input?.url || "";
        yield { type: "screen_is_on", page };
      }
      results.push({ type: "tool_result", tool_use_id: t.id, content: r.content, is_error: !r.ok });
    }
    messages.push({ role: "user", content: results });
  }
  yield { type: "done" };
}
