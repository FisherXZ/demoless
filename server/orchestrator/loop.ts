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

/** Instruction appended to the system prompt so the agent replies in the visitor's
 *  language (the persona prompt is English; without this she'd often reply in
 *  English even to Chinese/Spanish input). */
function languageDirective(language: Language): string {
  if (language === "en") return "";
  const name = LANGUAGE_NAMES[language];
  return `\n\nIMPORTANT: The visitor is speaking ${name}. Always reply in ${name}, naturally and conversationally.`;
}

/** First name to address the visitor by in the greeting; "" when unknown or
 *  when the form left only an email (we don't want to read an address aloud). */
function firstName(name?: string): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed || trimmed.includes("@")) return "";
  return trimmed.split(/\s+/)[0];
}

export class LoopOrchestrator implements Orchestrator {
  private _runTurn = runTurn; // seam for tests
  constructor(private deps: { executor: ToolExecutor; cfg: DemoConfig }) {}

  greeting(lang: Language, agentName: string, buyer?: BuyerMemory): string {
    const product = this.deps.cfg.productName;
    const first = firstName(buyer?.profile.name);
    const base =
      lang === "zh"
        ? `你好${first ? `，${first}` : ""}，我是${agentName}。你今天想了解${product}的哪件事？`
        : lang === "es"
          ? `Hola${first ? `, ${first}` : ""}, soy ${agentName}. ¿Qué estás tratando de entender sobre ${product} hoy?`
          : `Hi${first ? ` ${first}` : ""}, I'm ${agentName}. What are you trying to figure out about ${product} today?`;
    // The recall line is composed in English from stored notes. Speaking it in a
    // non-English session mixes scripts in one TTS utterance (the Mandarin voice
    // muffling English) and reads wrong, so only prepend it for English. The
    // buyer memory is still in the brain's system prompt, so the agent references
    // it naturally in the visitor's language on the first turn.
    if (lang === "en" && buyer?.isReturning && buyer.recall.line) {
      return `${buyer.recall.line} ${base}`;
    }
    return base;
  }

  async *runTurn(input: TurnInput, ctx: TurnContext, signal: AbortSignal): AsyncIterable<Command> {
    const buyerBlock = ctx.buyerNotes.length
      ? `Known buyer notes:\n- ${ctx.buyerNotes.join("\n- ")}`
      : "";
    const memoryContext = [buyerBlock, ctx.learningsContext]
      .filter(Boolean)
      .join("\n\n");
    const system =
      buildSystem(this.deps.cfg, memoryContext, ctx.role, ctx.agentName) +
      languageDirective(input.language);
    const messages = [...toMessages(ctx.history), { role: "user" as const, content: input.text }];
    for await (const c of this._runTurn({ system, messages, executor: this.deps.executor, signal })) {
      yield c as Command; // P2 acts on say, forwards navigate/screen_is_on/remember/set_phase
    }
  }
}
