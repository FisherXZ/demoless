import type Anthropic from "@anthropic-ai/sdk";

export type ToolName =
  | "navigate" | "click" | "look" | "remember" | "search_knowledge" | "set_phase";

export interface ToolResult { ok: boolean; content: string }

export const TOOLS: Anthropic.Tool[] = [
  { name: "navigate", description: "Drive the live browser to a full URL on the demo site.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "click", description: "Click an element on the current page by its visible text.",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
  { name: "look", description: "Read the current page (title, links, text) without navigating.",
    input_schema: { type: "object", properties: {}, required: [] } },
  { name: "remember", description: "Save a durable note about the buyer.",
    input_schema: { type: "object", properties: {
      note: { type: "string" },
      type: { type: "string", enum: ["preference","pain_point","objection","interest","persona","next_step"] }
    }, required: ["note","type"] } },
  { name: "search_knowledge", description: "Look up grounded product facts before answering.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "set_phase", description: "Report the current sales phase (observed, not enforced).",
    input_schema: { type: "object", properties: {
      phase: { type: "string", enum: ["HOOK","DISCOVERY","WALKTHROUGH","CLOSE","DONE"] }
    }, required: ["phase"] } },
];
