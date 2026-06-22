import type Anthropic from "@anthropic-ai/sdk";
import type { ToolName, ToolResult } from "./tools";

export interface ScreenState { sessionId: string; url: string; title: string }
export interface PageContext { url: string; title: string; elements: string[]; text: string }
export interface Shot { base64: string; mediaType: "image/jpeg" }
export interface BrowserLane {
  navigate(sessionId: string, url: string): Promise<ScreenState>;
  clickText(sessionId: string, text: string): Promise<ScreenState>;
  typeText(sessionId: string, text: string, into?: string): Promise<ScreenState>;
  pressKey(sessionId: string, key: string): Promise<ScreenState>;
  scroll(sessionId: string, direction: "down" | "up"): Promise<ScreenState>;
  waitFor(sessionId: string, until?: string, seconds?: number): Promise<ScreenState>;
  pageContext(sessionId: string): Promise<PageContext>;
  screenshot(sessionId: string): Promise<Shot>;
}
export interface MemoryLane { remember(buyerId: string, n: { text: string; type: string }): Promise<unknown> }
export interface KnowledgeLane {
  searchKnowledge(company: string, query: string): Promise<Array<{ title?: string; text: string; score: number }>>;
  buildAnswerContext(hits: Array<{ title?: string; text: string }>): string;
}
export interface ExecutorDeps {
  sessionId: string; buyerId: string; company: string;
  browser: BrowserLane; memory: MemoryLane; knowledge: KnowledgeLane;
}
export interface ToolExecutor { run(name: ToolName, input: any, signal?: AbortSignal): Promise<ToolResult>; phase: string }

const pageToText = (p: PageContext) =>
  `URL: ${p.url}\nTitle: ${p.title}\nElements:\n${p.elements.join("\n")}\n\n${p.text}`.slice(0, 4000);

/** Bundle a text label with a screenshot into the [text, image] block array
 *  Anthropic accepts inside a tool_result — the shared shape for look(visual)
 *  and the click/type failure-recovery path. */
const withShot = (
  text: string,
  shot: Shot
): Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> => [
  { type: "text", text },
  { type: "image", source: { type: "base64", media_type: shot.mediaType, data: shot.base64 } },
];

export function makeExecutor(d: ExecutorDeps): ToolExecutor {
  let phase = "HOOK";
  return {
    get phase() { return phase; },
    async run(name, input, signal): Promise<ToolResult> {
      if (signal?.aborted) return { ok: false, content: "aborted" }; // REVIEW FIX improvement 3
      try {
        switch (name) {
          case "navigate":
            await d.browser.navigate(d.sessionId, input.url);             // ScreenState (no text)
            return { ok: true, content: pageToText(await d.browser.pageContext(d.sessionId)) };
          case "click":
            await d.browser.clickText(d.sessionId, input.text);           // ScreenState (no text)
            return { ok: true, content: pageToText(await d.browser.pageContext(d.sessionId)) };
          case "type":
            await d.browser.typeText(d.sessionId, input.text, input.into);
            return { ok: true, content: pageToText(await d.browser.pageContext(d.sessionId)) };
          case "press":
            await d.browser.pressKey(d.sessionId, input.key);
            return { ok: true, content: pageToText(await d.browser.pageContext(d.sessionId)) };
          case "scroll":
            await d.browser.scroll(d.sessionId, input.direction);
            return { ok: true, content: pageToText(await d.browser.pageContext(d.sessionId)) };
          case "wait":
            await d.browser.waitFor(d.sessionId, input.until, input.seconds);
            return { ok: true, content: pageToText(await d.browser.pageContext(d.sessionId)) };
          case "look": {
            const text = pageToText(await d.browser.pageContext(d.sessionId));
            if (input?.visual) {
              const shot = await d.browser.screenshot(d.sessionId).catch(() => null);
              if (shot) return { ok: true, content: withShot(text, shot) };
            }
            return { ok: true, content: text };
          }
          case "remember":
            await d.memory.remember(d.buyerId, { text: input.note, type: input.type });
            return { ok: true, content: "noted" };
          case "search_knowledge": {
            try {
              const hits = await d.knowledge.searchKnowledge(d.company, input.query);
              return { ok: true, content: hits.length ? d.knowledge.buildAnswerContext(hits) : "No matching facts." };
            } catch (ragErr) {
              if (/Redis Stack/i.test((ragErr as Error).message)) {
                return { ok: true, content: "Knowledge base unavailable; answer from general product facts." };
              }
              throw ragErr;
            }
          }
          case "set_phase": phase = input.phase; return { ok: true, content: `phase=${phase}` };
        }
      } catch (e) {
        const msg = `tool ${name} failed: ${(e as Error).message}`;
        // Vision recovery: when a click/type couldn't find its target, attach the
        // current screen so the model can self-correct. Skip on barge-in (aborted)
        // — no point paying screenshot latency for a turn that's being cut off.
        if ((name === "click" || name === "type") && !signal?.aborted) {
          const shot = await d.browser.screenshot(d.sessionId).catch(() => null);
          if (shot) return { ok: false, content: withShot(`${msg} — current screen attached`, shot) };
        }
        return { ok: false, content: msg };
      }
    },
  };
}
