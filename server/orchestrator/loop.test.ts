import { describe, it, expect } from "vitest";
import { LoopOrchestrator } from "./loop";

const cfg = { company: "browserbase", productName: "Browserbase", persona: "Maya", browseTargetUrl: "https://x", corpusSeed: "" };
const executor = { phase: "HOOK", run: async () => ({ ok: true, content: "" }) };

describe("LoopOrchestrator", () => {
  it("yields say commands from a turn", async () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    (orch as any)._runTurn = async function* () { yield { type: "say", text: "Hello." }; yield { type: "done" }; };
    const out: any[] = [];
    for await (const c of orch.runTurn({ text: "hi", language: "en" }, { history: [], buyerNotes: [], agentName: "Maya", learningsContext: "" }, new AbortController().signal)) out.push(c);
    expect(out.some((c) => c.type === "say" && c.text === "Hello.")).toBe(true);
  });
  it("greeting uses persona + recall", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    expect(orch.greeting("en", "Maya")).toContain("Maya");
  });

  it("localizes the greeting for Spanish and Mandarin visitors", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });

    expect(orch.greeting("es", "Maya")).toContain("Hola, soy Maya");
    expect(orch.greeting("zh", "Maya")).toContain("你好，我是Maya");
  });

  it("adds the requested language directive to non-English turns", async () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    const systems: string[] = [];
    (orch as any)._runTurn = async function* ({ system }: any) {
      systems.push(system);
      yield { type: "done" };
    };

    for await (const _ of orch.runTurn(
      { text: "hola", language: "es" },
      { history: [], buyerNotes: [], agentName: "Maya", learningsContext: "" },
      new AbortController().signal
    )) {
      // drain
    }

    for await (const _ of orch.runTurn(
      { text: "ni hao", language: "zh" },
      { history: [], buyerNotes: [], agentName: "Maya", learningsContext: "" },
      new AbortController().signal
    )) {
      // drain
    }

    expect(systems[0]).toContain("visitor is speaking Spanish");
    expect(systems[1]).toContain("visitor is speaking Mandarin Chinese");
  });
});
