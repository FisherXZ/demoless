import type Anthropic from "@anthropic-ai/sdk";

/** Collapse a tool-result `content` to a plain string for label/regex use.
 *  Tool results are usually a string, but the vision path returns a
 *  [text, image] block array — this pulls the text out so the Title:/URL:
 *  extractors (turn.ts, playbookRunner.ts) keep working. NOT a general content
 *  serializer; it just recovers the text portion. */
export function toText(
  content: string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>
): string {
  if (typeof content === "string") return content;
  return content
    .filter((b): b is Anthropic.TextBlockParam => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
