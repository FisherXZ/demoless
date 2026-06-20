import Anthropic from "@anthropic-ai/sdk";
import type { Command, Language } from "../../lib/voice/messages";
import { getProductFacts } from "../productFacts";
import type {
  Orchestrator,
  TurnContext,
  TurnInput,
} from "./types";

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
      return `Hola, soy ${agentName}, la representante de Demoless. Encantada de mostrarte el producto. Que te gustaria ver primero?`;
    }
    return `Hi, I'm ${agentName}, your Demoless product specialist. Happy to walk you through it. What would you like to see first?`;
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
- End most turns with a light question to keep the conversation moving.
- ${lang}

Ground every claim in these product facts. Do not invent pricing, security, or integration details that aren't here:

${blob}${memory}`;
}

/**
 * Buffers streamed text and emits speakable fragments as soon as they're ready,
 * so TTS can start before the full reply is generated.
 *
 * - Always flushes on sentence-ending punctuation.
 * - For the very first fragment, also flushes on an early clause boundary
 *   (comma/colon/semicolon) so the user hears audio sooner (lower latency).
 * - Safety-flushes very long run-ons at a word boundary.
 */
class SentenceChunker {
  private buffer = "";
  private emitted = 0;

  private static readonly FIRST_CLAUSE_MIN = 18;
  private static readonly MAX_LEN = 140;
  private static readonly SENTENCE_RE = /([.!?]+["')\]]?\s+|[\u3002\uFF01\uFF1F]\s*)/;
  private static readonly CLAUSE_RE = /([,;:]\s+)/;

  push(text: string): string[] {
    this.buffer += text;
    const out: string[] = [];

    for (;;) {
      const sentence = this.buffer.match(SentenceChunker.SENTENCE_RE);
      if (sentence && sentence.index !== undefined) {
        this.take(out, sentence.index + sentence[0].length);
        continue;
      }

      // First-audio: flush the opening clause early so a reply starts sooner.
      if (this.emitted === 0) {
        const clause = this.buffer.match(SentenceChunker.CLAUSE_RE);
        if (
          clause &&
          clause.index !== undefined &&
          clause.index >= SentenceChunker.FIRST_CLAUSE_MIN
        ) {
          this.take(out, clause.index + clause[0].length);
          continue;
        }
      }

      if (this.buffer.length > SentenceChunker.MAX_LEN) {
        const space = this.buffer.lastIndexOf(" ", SentenceChunker.MAX_LEN);
        this.take(out, space > 0 ? space + 1 : SentenceChunker.MAX_LEN);
        continue;
      }

      break;
    }
    return out;
  }

  private take(out: string[], end: number) {
    const fragment = this.buffer.slice(0, end).trim();
    if (fragment) {
      out.push(fragment);
      this.emitted++;
    }
    this.buffer = this.buffer.slice(end);
  }

  flush(): string {
    const rest = this.buffer.trim();
    this.buffer = "";
    if (rest) this.emitted++;
    return rest;
  }
}
