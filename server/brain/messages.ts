import type Anthropic from "@anthropic-ai/sdk";
import type { DemoConfig } from "../config/demoConfig";
import { SECTIONS } from "../config/demoConfig";
import type { ConversationTurn } from "../orchestrator/types";
import { personaBlock } from "./persona";

export function buildSystem(
  cfg: DemoConfig,
  memoryContext: string,
  role?: string
): string {
  const deeplinks = SECTIONS.map((s) => `${s.label} → ${s.url}`).join("\n");
  const persona =
    cfg.systemPrompt ??
    [
      `You are ${cfg.persona}, a friendly AI sales rep giving a LIVE, screen-shared demo of ${cfg.productName}.`,
      `You drive a real web browser the visitor is watching. Use the navigate/click/look tools to show pages.`,
    ].join("\n");
  return [
    persona,
    `\nSection deep-links (use navigate() with these URLs — they are reliable):\n${deeplinks}`,
    `\nBefore stating product facts, call search_knowledge. Save durable buyer signals with remember.`,
    `Report your sales phase with set_phase as the conversation moves (HOOK→DISCOVERY→WALKTHROUGH→CLOSE).`,
    memoryContext ? `\n${memoryContext}` : "",
    `\n${personaBlock(role)}`,
  ].join("\n");
}

export function toMessages(history: ConversationTurn[]): Anthropic.MessageParam[] {
  return history.map((h) => ({ role: h.role === "agent" ? "assistant" : "user", content: h.text }));
}
