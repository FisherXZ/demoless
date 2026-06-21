import { describe, it, expect } from "vitest";
import { LoopOrchestrator } from "./loop";

const cfg = { company: "browserbase", productName: "Browserbase", persona: "Messi", browseTargetUrl: "https://x", corpusSeed: "" };
const executor = { phase: "HOOK", run: async () => ({ ok: true, content: "" }) };

describe("LoopOrchestrator", () => {
  it("yields say commands from a turn", async () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    (orch as any)._runTurn = async function* () { yield { type: "say", text: "Hello." }; yield { type: "done" }; };
    const out: any[] = [];
    for await (const c of orch.runTurn({ text: "hi", language: "en" }, { history: [], buyerNotes: [], agentName: "Messi", learningsContext: "" }, new AbortController().signal)) out.push(c);
    expect(out.some((c) => c.type === "say" && c.text === "Hello.")).toBe(true);
  });
  it("greeting uses persona + recall", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    expect(orch.greeting("en", "Messi")).toContain("Messi");
  });

  it("default greeting asks one discovery question before offering a walkthrough", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    const text = orch.greeting("en", "Messi");

    expect(text).toContain("Messi");
    expect(text).toMatch(/what .*trying to figure out/i);
    expect(text).not.toMatch(/walk you through|show you/i);
    expect((text.match(/\?/g) ?? []).length).toBe(1);
  });
});
