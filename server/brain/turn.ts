import type Anthropic from "@anthropic-ai/sdk";
import { streamWithTools as defaultStream, type ModelEvent } from "../model";
import { TOOLS } from "./tools";
import type { ToolName } from "./tools";
import type { ToolExecutor } from "./executor";
import { SentenceChunker } from "../util/sentenceChunker";   // REVIEW FIX improvement 2
import type { Command } from "../../lib/voice/messages";      // REVIEW FIX B1: the ONE shared union

export interface TurnArgs {
  system: string;
  messages: Anthropic.MessageParam[];
  executor: ToolExecutor;
  signal: AbortSignal;
  stream?: (req: any) => AsyncIterable<ModelEvent>;
}

const FILLER: Record<string, string> = {
  navigate: "Let me pull that up.", click: "One sec.", look: "Let me take a look.",
  search_knowledge: "Let me check that.", remember: "", set_phase: "",
};

export async function* runTurn(args: TurnArgs): AsyncIterable<Command> {
  const stream = args.stream ?? defaultStream;
  const messages = [...args.messages];
  for (let hop = 0; hop < 8; hop++) {
    if (args.signal.aborted) break;
    const chunker = new SentenceChunker();
    const toolCalls: { id: string; name: ToolName; input: any }[] = [];
    let textForHistory = "";
    for await (const ev of stream({ system: args.system, messages, tools: TOOLS })) {
      if (args.signal.aborted) { yield { type: "done" }; return; }
      if (ev.kind === "text") {
        textForHistory += ev.delta;
        for (const s of chunker.push(ev.delta)) yield { type: "say", text: s };
      } else if (ev.kind === "tool_use") {
        toolCalls.push({ id: ev.id, name: ev.name as ToolName, input: ev.input });
      }
    }
    const tail = chunker.flush();
    if (tail.trim()) yield { type: "say", text: tail.trim() };
    if (!toolCalls.length) { yield { type: "done" }; return; }

    // record assistant turn (text + tool_use) then execute and feed results back
    const assistant: any[] = [];
    if (textForHistory.trim()) assistant.push({ type: "text", text: textForHistory });
    for (const t of toolCalls) assistant.push({ type: "tool_use", id: t.id, name: t.name, input: t.input });
    messages.push({ role: "assistant", content: assistant });

    const results: any[] = [];
    for (const t of toolCalls) {
      if (FILLER[t.name]) yield { type: "say", text: FILLER[t.name] };
      const r = await args.executor.run(t.name, t.input, args.signal); // REVIEW FIX improvement 3: thread signal
      if (t.name === "navigate") yield { type: "navigate", url: t.input.url };
      if (t.name === "set_phase") yield { type: "set_phase", phase: t.input.phase };
      if (t.name === "remember") yield { type: "remember", note: t.input.note, noteType: t.input.type };
      if (t.name === "navigate" || t.name === "click" || t.name === "look")
        yield { type: "screen_is_on", page: r.content.slice(0, 200) };
      results.push({ type: "tool_result", tool_use_id: t.id, content: r.content, is_error: !r.ok });
    }
    messages.push({ role: "user", content: results });
  }
  yield { type: "done" };
}
