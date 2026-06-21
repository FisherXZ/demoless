import { describe, it, expect, vi } from "vitest";
import { makeExecutor } from "./executor";

const fakes = () => ({
  sessionId: "s1", buyerId: "b1", company: "browserbase",
  browser: {
    // REAL shapes: navigate/clickText -> ScreenState (no links/text); pageContext -> PageContext
    navigate: vi.fn(async () => ({ sessionId: "s1", url: "/x", title: "" })),
    clickText: vi.fn(async () => ({ sessionId: "s1", url: "/x", title: "" })),
    pageContext: vi.fn(async () => ({ url: "/x", title: "X", links: ["/a"], text: "hello world" })),
  },
  memory: { remember: vi.fn(async () => ({ id: "n1" })) },
  knowledge: { searchKnowledge: vi.fn(async () => [{ title: "Pricing", text: "$$", score: 0.9 }]),
               buildAnswerContext: vi.fn((_h: any[]) => "Product knowledge:\n- Pricing") },
});

describe("ToolExecutor", () => {
  it("navigate drives the browser THEN reads pageContext for text", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    const r = await ex.run("navigate", { url: "/x" });
    expect(f.browser.navigate).toHaveBeenCalledWith("s1", "/x");
    expect(f.browser.pageContext).toHaveBeenCalledWith("s1"); // REVIEW FIX B3
    expect(r.ok).toBe(true);
    expect(r.content).toContain("hello world");
  });
  it("set_phase updates observed phase without touching lanes", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    await ex.run("set_phase", { phase: "DISCOVERY" });
    expect(ex.phase).toBe("DISCOVERY");
    expect(f.browser.pageContext).not.toHaveBeenCalled();
  });
  it("search_knowledge returns built answer context", async () => {
    const ex = makeExecutor(fakes() as any);
    const r = await ex.run("search_knowledge", { query: "price" });
    expect(r.content).toContain("Pricing");
  });
  it("does not run the tool if already aborted (REVIEW FIX, improvement 3)", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    const ac = new AbortController(); ac.abort();
    const r = await ex.run("navigate", { url: "/x" }, ac.signal);
    expect(f.browser.navigate).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
  });
});
