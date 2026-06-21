import type { Orchestrator, TurnInput, TurnContext } from "./types";
import type { Command, Language } from "../../lib/voice/messages";
import type { ToolExecutor } from "../brain/executor";
import type { DemoConfig } from "../config/demoConfig";
import { runTurn } from "../brain/turn";
import { buildSystem, toMessages } from "../brain/messages";

export class LoopOrchestrator implements Orchestrator {
  private _runTurn = runTurn; // seam for tests
  constructor(private deps: { executor: ToolExecutor; cfg: DemoConfig }) {}

  greeting(_lang: Language, agentName: string): string {
    return `Hi, I'm ${agentName}. Want me to walk you through ${this.deps.cfg.productName}?`;
  }

  async *runTurn(input: TurnInput, ctx: TurnContext, signal: AbortSignal): AsyncIterable<Command> {
    const memoryContext = ctx.buyerNotes.length ? `Known buyer notes:\n- ${ctx.buyerNotes.join("\n- ")}` : "";
    const system = buildSystem(this.deps.cfg, memoryContext);
    const messages = [...toMessages(ctx.history), { role: "user" as const, content: input.text }];
    for await (const c of this._runTurn({ system, messages, executor: this.deps.executor, signal })) {
      yield c as Command; // P2 acts on say, forwards navigate/screen_is_on/remember/set_phase
    }
  }
}
