import Anthropic from "@anthropic-ai/sdk";
import type { Command, Language } from "../../lib/voice/messages";
import { getProductFacts } from "../productFacts";
import type {
  Orchestrator,
  TurnContext,
  TurnInput,
} from "./types";
import { SentenceChunker } from "../util/sentenceChunker";
import { personaBlock } from "../brain/persona";

/**
 * Swappable stand-in for P1's LLM loop: a thin streaming Claude call grounded
 * in the product-facts blob. It plays Demoless's AI sales rep (named after the
 * selected voice) and streams short spoken sentences so TTS starts immediately.
 *
 * Replace with P1's real orchestrator by implementing {@link Orchestrator}.
 */
export class StubOrchestrator implements Orchestrator {
  private client: Anthropic;
  private model: string;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    });
    this.model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest";
  }

  greeting(language: Language, agentName: string): string {
    if (language === "es") {
      return `Hola, soy ${agentName}, la representante de Demoless. ¿Qué estás tratando de entender hoy?`;
    }
    return `Hi, I'm ${agentName}, your Demoless product specialist. What are you trying to figure out today?`;
  }

  async *runTurn(
    input: TurnInput,
    context: TurnContext,
    signal: AbortSignal
  ): AsyncIterable<Command> {
    const facts = getProductFacts();

    const messages: Anthropic.MessageParam[] = [];
    for (const turn of context.history) {
      messages.push({
        role: turn.role === "user" ? "user" : "assistant",
        content: turn.text,
      });
    }
    messages.push({ role: "user", content: input.text });

    const stream = this.client.messages.stream(
      {
        model: this.model,
        max_tokens: 400,
        system: buildSystemPrompt(facts.product, facts.blob, input.language, context),
        messages,
      },
      { signal }
    );

    const chunker = new SentenceChunker();
    try {
      for await (const event of stream) {
        if (signal.aborted) break;
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          for (const sentence of chunker.push(event.delta.text)) {
            yield { type: "say", text: sentence };
          }
        }
      }
    } catch (err) {
      // An aborted request (barge-in) surfaces as an AbortError; swallow it.
      if (!signal.aborted) throw err;
    }

    if (!signal.aborted) {
      const tail = chunker.flush();
      if (tail) yield { type: "say", text: tail };
    }
  }
}

function buildSystemPrompt(
  product: string,
  blob: string,
  language: Language,
  context: TurnContext
): string {
  const lang =
    language === "es"
      ? "Respond ONLY in natural, conversational Spanish."
      : "Respond ONLY in natural, conversational English.";

  const memory =
    context.buyerNotes.length > 0
      ? `\n\nWhat you already know about this buyer:\n- ${context.buyerNotes.join(
          "\n- "
        )}`
      : "";

  return `You are ${context.agentName}, a friendly, sharp AI sales specialist running a live voice demo of ${product}.

You are speaking out loud, so your replies must sound like natural speech:
- Keep answers short: 1-3 sentences. This is a conversation, not a monologue.
- No markdown, no bullet points, no lists, no emoji. Plain spoken sentences only.
- Be warm and concrete. Use specific facts. If you don't know, say so briefly and offer to follow up.
- Run discovery before any generic walkthrough: learn why the buyer is here, the workflow or problem they care about, and the background they bring.
- Ask one short question at a time. Do not ask a form-like list or multiple discovery questions in a row.
- If the visitor directly asks for a specific area, answer or show that area first, then ask one short contextual follow-up.
- Do not assign lead scores, intent scores, confidence labels, or certainty claims.
- End most turns with at most one light question to keep the conversation moving.
- ${lang}

Ground every claim in these product facts. Do not invent pricing, security, or integration details that aren't here:

${blob}${memory}

${personaBlock(context.role)}`;
}
