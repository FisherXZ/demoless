import type Anthropic from "@anthropic-ai/sdk";
import type { DemoConfig } from "../config/demoConfig";
import { SECTIONS } from "../config/demoConfig";
import type { ConversationTurn } from "../orchestrator/types";
import { personaBlock } from "./persona";

export function buildSystem(
  cfg: DemoConfig,
  memoryContext: string,
  role?: string,
  agentName = cfg.persona
): string {
  const deeplinks = SECTIONS.map((s) => `${s.label} → ${s.url}`).join("\n");
  const basePersona =
    cfg.systemPrompt ??
    [
      `You are ${cfg.persona}, a friendly AI sales rep giving a LIVE, screen-shared demo of ${cfg.productName}.`,
      `You drive a real web browser the visitor is watching. Use the navigate/click/look tools to show pages.`,
    ].join("\n");
  const persona =
    agentName && agentName !== cfg.persona
      ? basePersona.replaceAll(cfg.persona, agentName)
      : basePersona;
  const discoveryFirst = [
    "Discovery-first behavior:",
    "- Open with discovery, not a generic tour. Before giving a generic walkthrough, learn why the buyer is here, the workflow or problem they care about, and the background they bring.",
    "- Ask one short question at a time. Do not ask a form-like list or multiple discovery questions in a row.",
    "- If the visitor directly asks to see something specific like pricing, docs, sessions, or the playground, honor it with navigate/click/look as appropriate, then add one short contextual follow-up question.",
    "- Save durable buyer facts with remember: use persona for background, pain_point for workflow pain, interest for interests, objection for objections, preference for preferences, and next_step for agreed follow-up.",
    "- Calibrate technical depth to what you LEARN about the buyer through discovery (and any known buyer notes): go precise and technical for engineers/builders, stay plain and outcome-focused for non-technical buyers. Default to plain language until you know.",
    "- Do not assign lead scores, intent scores, confidence labels, or certainty claims. Capture evidence-backed facts only.",
  ].join("\n");
  return [
    persona,
    `\nSection deep-links (use navigate() with these URLs — they are reliable):\n${deeplinks}`,
    `\nBefore stating product facts, call search_knowledge. Save durable buyer signals with remember.`,
    `Report your sales phase with set_phase as the conversation moves (HOOK→DISCOVERY→WALKTHROUGH→CLOSE).`,
    `\n${discoveryFirst}`,
    memoryContext ? `\n${memoryContext}` : "",
    `\n${personaBlock(role)}`,
  ].join("\n");
}

export function toMessages(history: ConversationTurn[]): Anthropic.MessageParam[] {
  return history.map((h) => ({ role: h.role === "agent" ? "assistant" : "user", content: h.text }));
}
