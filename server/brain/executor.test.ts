import { describe, it, expect, vi } from "vitest";
import { makeExecutor } from "./executor";

const fakes = () => ({
  sessionId: "s1", buyerId: "b1", company: "browserbase",
  browser: {
    // REAL shapes: navigate/clickText -> ScreenState (no links/text); pageContext -> PageContext
    navigate: vi.fn(async () => ({ sessionId: "s1", url: "/x", title: "" })),
    clickText: vi.fn(async () => ({ sessionId: "s1", url: "/x", title: "" })),
    typeText: vi.fn(async () => ({ sessionId: "s1", url: "/x", title: "" })),
    pressKey: vi.fn(async () => ({ sessionId: "s1", url: "/x", title: "" })),
    scroll: vi.fn(async () => ({ sessionId: "s1", url: "/x", title: "" })),
    waitFor: vi.fn(async () => ({ sessionId: "s1", url: "/x", title: "" })),
    pageContext: vi.fn(async () => ({ url: "/x", title: "X", elements: ['link "Home"'], text: "hello world" })),
    screenshot: vi.fn(async () => ({ base64: "AAAA", mediaType: "image/jpeg" as const })),
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
  it("click drives the browser THEN reads pageContext for text", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    const r = await ex.run("click", { text: "Pricing" });
    expect(f.browser.clickText).toHaveBeenCalledWith("s1", "Pricing");
    expect(f.browser.pageContext).toHaveBeenCalledWith("s1");
    expect(r.ok).toBe(true);
    expect(r.content).toContain('link "Home"');
    expect(r.content).toContain("Elements:");
  });
  it("type fills a field THEN reads pageContext for text", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    const r = await ex.run("type", { text: "tesla.com", into: "URL" });
    expect(f.browser.typeText).toHaveBeenCalledWith("s1", "tesla.com", "URL");
    expect(f.browser.pageContext).toHaveBeenCalledWith("s1");
    expect(r.ok).toBe(true);
    expect(r.content).toContain("hello world");
  });
  it("press sends a key THEN reads pageContext for text", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    const r = await ex.run("press", { key: "Enter" });
    expect(f.browser.pressKey).toHaveBeenCalledWith("s1", "Enter");
    expect(f.browser.pageContext).toHaveBeenCalledWith("s1");
    expect(r.ok).toBe(true);
  });
  it("scroll moves the page THEN reads pageContext for text", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    const r = await ex.run("scroll", { direction: "down" });
    expect(f.browser.scroll).toHaveBeenCalledWith("s1", "down");
    expect(f.browser.pageContext).toHaveBeenCalledWith("s1");
    expect(r.ok).toBe(true);
  });
  it("wait blocks for results THEN reads pageContext for the real output", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    const r = await ex.run("wait", { until: "Filing", seconds: 20 });
    expect(f.browser.waitFor).toHaveBeenCalledWith("s1", "Filing", 20);
    expect(f.browser.pageContext).toHaveBeenCalledWith("s1");
    expect(r.ok).toBe(true);
    expect(r.content).toContain("hello world");
  });
  it("look reads the current page without mutating browser state", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    const r = await ex.run("look", {});
    expect(f.browser.navigate).not.toHaveBeenCalled();
    expect(f.browser.clickText).not.toHaveBeenCalled();
    expect(f.browser.pageContext).toHaveBeenCalledWith("s1");
    expect(r.content).toContain("Title: X");
  });
  it("remember stores the note for the current buyer", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    const r = await ex.run("remember", { type: "interest", note: "security review" });
    expect(f.memory.remember).toHaveBeenCalledWith("b1", {
      type: "interest",
      text: "security review",
    });
    expect(r).toEqual({ ok: true, content: "noted" });
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
  it("search_knowledge reports when no facts match", async () => {
    const f = fakes();
    f.knowledge.searchKnowledge.mockResolvedValueOnce([]);
    const ex = makeExecutor(f as any);
    const r = await ex.run("search_knowledge", { query: "missing" });
    expect(r).toEqual({ ok: true, content: "No matching facts." });
    expect(f.knowledge.buildAnswerContext).not.toHaveBeenCalled();
  });
  it("does not run the tool if already aborted (REVIEW FIX, improvement 3)", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    const ac = new AbortController(); ac.abort();
    const r = await ex.run("navigate", { url: "/x" }, ac.signal);
    expect(f.browser.navigate).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
  });

  it("look(visual:true) attaches a screenshot as an image block", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    const r = await ex.run("look", { visual: true });
    expect(f.browser.screenshot).toHaveBeenCalledWith("s1");
    expect(Array.isArray(r.content)).toBe(true);
    const blocks = r.content as any[];
    expect(blocks[0]).toMatchObject({ type: "text" });
    expect(blocks[0].text).toContain("Title: X");
    expect(blocks[1]).toMatchObject({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: "AAAA" },
    });
  });

  it("look without visual stays text-only (no screenshot)", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    const r = await ex.run("look", {});
    expect(f.browser.screenshot).not.toHaveBeenCalled();
    expect(typeof r.content).toBe("string");
  });

  it("a failed click attaches the current screen so the model can self-correct", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    f.browser.clickText.mockRejectedValueOnce(new Error("element not found"));
    const r = await ex.run("click", { text: "Ghost button" });
    expect(r.ok).toBe(false);
    expect(Array.isArray(r.content)).toBe(true);
    const blocks = r.content as any[];
    expect(blocks[0].text).toContain("tool click failed");
    expect(blocks[1]).toMatchObject({ type: "image" });
  });

  it("a failed click degrades to text-only when the screenshot also fails", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    f.browser.clickText.mockRejectedValueOnce(new Error("element not found"));
    f.browser.screenshot.mockRejectedValueOnce(new Error("no session"));
    const r = await ex.run("click", { text: "Ghost button" });
    expect(r.ok).toBe(false);
    expect(typeof r.content).toBe("string");
    expect(r.content).toContain("tool click failed");
  });

  it("a click failed by barge-in (aborted) skips the screenshot latency", async () => {
    const f = fakes(); const ex = makeExecutor(f as any);
    const ac = new AbortController();
    // abort mid-flight, after the entry guard, so we reach the catch block aborted
    f.browser.clickText.mockImplementationOnce(async () => { ac.abort(); throw new Error("boom"); });
    const r = await ex.run("click", { text: "X" }, ac.signal);
    expect(r.ok).toBe(false);
    expect(f.browser.screenshot).not.toHaveBeenCalled();
    expect(typeof r.content).toBe("string");
  });
});
