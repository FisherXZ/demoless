import Anthropic from "@anthropic-ai/sdk";
import type { PageContext } from "@/lib/browser/session";
import { SECTIONS, SYSTEM_PROMPT } from "@/lib/demoConfig";

// Fast tier for the live chat->action loop (low latency, simple intent routing).
// Bump to "claude-sonnet-4-6" or "claude-opus-4-8" for deeper reasoning.
const MODEL = "claude-haiku-4-5";

const client = new Anthropic();

export type BrowserAction =
  | { type: "navigate"; url: string }
  | { type: "click"; text: string }
  | null;

export interface AgentDecision {
  reply: string;
  action: BrowserAction;
}

export function hasLLM(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const SYSTEM = SYSTEM_PROMPT;

const tools: Anthropic.Tool[] = [
  {
    name: "click",
    description:
      "Click an element on the current page by its visible text (e.g. a nav tab like 'Sessions').",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Visible text of the element to click" },
      },
      required: ["text"],
    },
  },
  {
    name: "navigate",
    description: "Navigate the browser to a full URL on the same site.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to open" },
      },
      required: ["url"],
    },
  },
];

export async function decide(
  message: string,
  ctx: PageContext
): Promise<AgentDecision> {
  const deeplinks = SECTIONS.map((s) => `${s.label} -> ${s.url}`).join(", ");

  const grounding = `Current page: ${ctx.title || "(untitled)"} (${ctx.url})
Section deep-links (navigate() to one of these to switch sections): ${deeplinks}
Other clickable items on this page: ${ctx.links.join(", ") || "(none detected)"}

Visible content of the current page:
"""
${ctx.text || "(empty)"}
"""`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM,
    tools,
    messages: [
      { role: "user", content: `${grounding}\n\nVisitor said: "${message}"` },
    ],
  });

  let reply = "";
  let action: BrowserAction = null;
  for (const block of msg.content) {
    if (block.type === "text") {
      reply += block.text;
    } else if (block.type === "tool_use") {
      const input = block.input as Record<string, unknown>;
      if (block.name === "click" && typeof input.text === "string") {
        action = { type: "click", text: input.text };
      } else if (block.name === "navigate" && typeof input.url === "string") {
        action = { type: "navigate", url: input.url };
      }
    }
  }

  // Strip any markdown Haiku slips in (renders as literal asterisks in chat).
  reply = reply.replace(/\*+/g, "").replace(/^#+\s*/gm, "").trim();
  if (!reply) {
    if (action?.type === "click") reply = `Sure, here's ${action.text}.`;
    else if (action?.type === "navigate") reply = "Opening that now.";
    else reply = "Could you rephrase that?";
  }
  return { reply, action };
}
