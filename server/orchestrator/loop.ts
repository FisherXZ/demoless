import type { Orchestrator, TurnInput, TurnContext } from "./types";
import type { Command, Language } from "../../lib/voice/messages";
import type { ToolExecutor } from "../brain/executor";
import type { DemoConfig } from "../config/demoConfig";
import type { BuyerMemory } from "../../lib/memory/types";
import { runTurn } from "../brain/turn";
import { buildSystem, toMessages } from "../brain/messages";

const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  es: "Spanish",
  zh: "Mandarin Chinese",
};

/** Instruction appended to the system prompt so Maya replies in the visitor's
 *  language (the persona prompt is English; without this she'd often reply in
 *  English even to Chinese/Spanish input). */
function languageDirective(language: Language): string {
  if (language === "en") return "";
  const name = LANGUAGE_NAMES[language];
  return `\n\nIMPORTANT: The visitor is speaking ${name}. Always reply in ${name}, naturally and conversationally.`;
}

export class LoopOrchestrator implements Orchestrator {
  private _runTurn = runTurn; // seam for tests
  constructor(private deps: { executor: ToolExecutor; cfg: DemoConfig }) {}

  greeting(lang: Language, agentName: string, buyer?: BuyerMemory): string {
    const product = this.deps.cfg.productName;
    const base =
      lang === "zh"
        ? `你好，我是${agentName}。要我带你快速了解一下${product}吗？`
        : lang === "es"
          ? `Hola, soy ${agentName}. ¿Quieres que te muestre ${product}?`
          : `Hi, I'm ${agentName}. Want me to walk you through ${product}?`;
    if (buyer?.isReturning && buyer.recall.line) {
      return `${buyer.recall.line} ${base}`;
    }
    return base;
  }

  async *runTurn(input: TurnInput, ctx: TurnContext, signal: AbortSignal): AsyncIterable<Command> {
    const memoryContext = ctx.buyerNotes.length ? `Known buyer notes:\n- ${ctx.buyerNotes.join("\n- ")}` : "";
    const system =
      buildSystem(this.deps.cfg, memoryContext, ctx.role) +
      languageDirective(input.language);
    const messages = [...toMessages(ctx.history), { role: "user" as const, content: input.text }];
    for await (const c of this._runTurn({ system, messages, executor: this.deps.executor, signal })) {
      yield c as Command; // P2 acts on say, forwards navigate/screen_is_on/remember/set_phase
    }
  }
}
