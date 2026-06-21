import { describe, it, expect } from "vitest";
import { LoopOrchestrator } from "./loop";

const cfg = { company: "browserbase", productName: "Browserbase", persona: "Maya", browseTargetUrl: "https://x", corpusSeed: "" };
const executor = { phase: "HOOK", run: async () => ({ ok: true, content: "" }) };

describe("LoopOrchestrator", () => {
  it("yields say commands from a turn", async () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    (orch as any)._runTurn = async function* () { yield { type: "say", text: "Hello." }; yield { type: "done" }; };
    const out: any[] = [];
    for await (const c of orch.runTurn({ text: "hi", language: "en" }, { history: [], buyerNotes: [], agentName: "Maya" }, new AbortController().signal)) out.push(c);
    expect(out.some((c) => c.type === "say" && c.text === "Hello.")).toBe(true);
  });
  it("greeting uses persona + recall", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    expect(orch.greeting("en", "Maya")).toContain("Maya");
  });
});
