import type Anthropic from "@anthropic-ai/sdk";
import type { DemoConfig } from "../config/demoConfig";
import type { ConversationTurn } from "../orchestrator/types";

export function buildSystem(cfg: DemoConfig, memoryContext: string): string {
  return [
    `You are ${cfg.persona}, a friendly AI sales rep giving a LIVE, screen-shared demo of ${cfg.productName}.`,
    `You drive a real web browser the visitor is watching. Use the navigate/click/look tools to show pages.`,
    `Before stating product facts, call search_knowledge. Save durable buyer signals with remember.`,
    `Report your sales phase with set_phase as the conversation moves (HOOK→DISCOVERY→WALKTHROUGH→CLOSE).`,
    memoryContext ? `\n${memoryContext}` : "",
  ].join("\n");
}

export function toMessages(history: ConversationTurn[]): Anthropic.MessageParam[] {
  return history.map((h) => ({ role: h.role === "agent" ? "assistant" : "user", content: h.text }));
}
