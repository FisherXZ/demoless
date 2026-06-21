import type { Command, Language } from "../../lib/voice/messages";
import type { BuyerMemory } from "../../lib/memory/types";

/**
 * The orchestrator is the boundary with P1's LLM loop.
 *
 * P2 only depends on this interface, never on a concrete implementation. The
 * {@link StubOrchestrator} ships now so the voice loop is demoable end-to-end;
 * when P1's real loop is ready it implements the same interface and gets wired
 * in at {@link createOrchestrator} with no other P2 changes.
 */

/** One conversation turn from the prospect. */
export interface TurnInput {
  /** Final transcript of what the user said. */
  text: string;
  language: Language;
}

/** Context handed to the orchestrator for a turn. */
export interface TurnContext {
  /** Prior turns this session, oldest first. */
  history: ConversationTurn[];
  /** Buyer notes from P4 memory (empty until P4 lands). */
  buyerNotes: string[];
  /** The agent's display name, derived from the selected voice model. */
  agentName: string;
}

export interface ConversationTurn {
  role: "user" | "agent";
  text: string;
}

/**
 * Run one turn. Implementations should stream {@link Command}s as they are
 * produced (so TTS can start before the full answer is generated). `signal`
 * aborts in-flight work on barge-in.
 */
export interface Orchestrator {
  runTurn(
    input: TurnInput,
    context: TurnContext,
    signal: AbortSignal
  ): AsyncIterable<Command>;

  /** Optional opening line when a session starts (GREET phase). */
  greeting?(language: Language, agentName: string, buyer?: BuyerMemory): Promise<string> | string;
}
