import type { Buyer, Command } from "../shared/contract";

/** The five-element demo arc (Karumi). Soft state the LLM advances (Q7). */
export type Phase = "HOOK" | "DISCOVERY" | "WALKTHROUGH" | "CLOSE" | "DONE";

/** What woke the loop. Only "human" turns may move the product (Q5/Q5b). */
export type TurnType = "greet" | "human" | "screen";

export interface LoopState {
  sessionId: string;
  buyerId: string;
  history: { role: "user" | "assistant"; text: string }[];
  phase: Phase;
  tourIndex: number; // bookmark into `selected`
  selected: string[]; // catalog step ids chosen by discovery (Q7)
  screen?: { url: string; summary: string };
  buyer?: Buyer;
}

export type CommandHandler = (c: Command) => void;
