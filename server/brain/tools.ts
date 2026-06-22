import type Anthropic from "@anthropic-ai/sdk";

export type ToolName =
  | "navigate" | "click" | "type" | "press" | "scroll" | "wait"
  | "look" | "remember" | "search_knowledge" | "set_phase";

// content is usually text; the vision path (explicit look(visual) or a failed
// click/type) returns a [text, image] block array — the exact subset Anthropic
// allows inside a tool_result.
export interface ToolResult {
  ok: boolean;
  content: string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>;
}

export const TOOLS: Anthropic.Tool[] = [
  { name: "navigate", description: "Drive the live browser to a full URL on the demo site.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "click", description: "Click an element on the current page by its visible text.",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
  { name: "type", description: "Type text into a field (search box, form input). `into` names the field by its placeholder or label; omit it to type into the first field on the page.",
    input_schema: { type: "object", properties: {
      text: { type: "string" }, into: { type: "string" }
    }, required: ["text"] } },
  { name: "press", description: "Press a single key, e.g. \"Enter\" to submit a search or form.",
    input_schema: { type: "object", properties: { key: { type: "string" } }, required: ["key"] } },
  { name: "scroll", description: "Scroll the page up or down by about one screen to reveal content below the fold.",
    input_schema: { type: "object", properties: {
      direction: { type: "string", enum: ["down", "up"] }
    }, required: ["direction"] } },
  { name: "wait", description: "Wait for a long-running action (an extraction, scrape, or page load) to finish before reading the result. Optionally give text you expect to appear (`until`); otherwise it waits for the page to settle. Returns the updated page so you can report real output.",
    input_schema: { type: "object", properties: {
      until: { type: "string" }, seconds: { type: "number" }
    }, required: [] } },
  { name: "look", description: "Read the current page (title, elements, text) without navigating. Pass visual:true to ALSO attach a screenshot when text isn't enough (a chart, an icon-only control, an ambiguous layout) — use sparingly.",
    input_schema: { type: "object", properties: { visual: { type: "boolean" } }, required: [] } },
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
