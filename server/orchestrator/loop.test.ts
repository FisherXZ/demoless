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

  it("localizes the greeting for Spanish and Mandarin visitors", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });

    expect(orch.greeting("es", "Messi")).toContain("Hola, soy Messi");
    expect(orch.greeting("zh", "Messi")).toContain("你好，我是Messi");
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
      { history: [], buyerNotes: [], agentName: "Messi", learningsContext: "" },
      new AbortController().signal
    )) {
      // drain
    }

    for await (const _ of orch.runTurn(
      { text: "ni hao", language: "zh" },
      { history: [], buyerNotes: [], agentName: "Messi", learningsContext: "" },
      new AbortController().signal
    )) {
      // drain
    }

    expect(systems[0]).toContain("visitor is speaking Spanish");
    expect(systems[1]).toContain("visitor is speaking Mandarin Chinese");
  });

  it("default greeting asks one discovery question before offering a walkthrough", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    const text = orch.greeting("en", "Messi");

    expect(text).toContain("Messi");
    expect(text).toMatch(/what brought you|what are you working on/i);
    expect(text).not.toMatch(/walk you through|show you/i);
    expect((text.match(/\?/g) ?? []).length).toBe(1);
  });

  it("pre-navigates to Overview when the visitor asks about features", async () => {
    const calls: string[] = [];
    const exec = {
      phase: "HOOK",
      run: async (name: string, input: any) => {
        calls.push(name);
        if (name === "navigate") {
          return { ok: true, content: "URL: https://x/overview\nTitle: Overview" };
        }
        return { ok: true, content: "" };
      },
    };
    const orch = new LoopOrchestrator({ executor: exec as any, cfg: cfg as any });
    (orch as any)._runTurn = async function* () {
      yield { type: "say", text: "Cloud browsers your agents drive." };
      yield { type: "done" };
    };

    const out: any[] = [];
    for await (const c of orch.runTurn(
      { text: "what features u guys have", language: "en" },
      { history: [], buyerNotes: [], agentName: "Messi", learningsContext: "" },
      new AbortController().signal
    )) {
      out.push(c);
    }

    expect(calls[0]).toBe("navigate");
    expect(out.some((c) => c.type === "say" && c.text.includes("dashboard"))).toBe(true);
    expect(out.some((c) => c.type === "navigate")).toBe(true);
    expect(out.some((c) => c.type === "set_phase" && c.phase === "WALKTHROUGH")).toBe(true);
  });

  it("speaks an opening line before SEC filing playbook steps", async () => {
    const calls: Array<{ name: string; input?: any }> = [];
    const exec = {
      phase: "HOOK",
      run: async (name: string, input: any) => {
        calls.push({ name, input });
        if (name === "navigate") {
          return { ok: true, content: "URL: https://x/playground\nTitle: Playground" };
        }
        if (name === "click") {
          return { ok: true, content: `URL: https://x/playground\nTitle: ${input.text}` };
        }
        return { ok: true, content: "URL: https://x/playground\nTitle: Playground" };
      },
    };
    const orch = new LoopOrchestrator({ executor: exec as any, cfg: cfg as any });
    (orch as any)._runTurn = async function* () {
      yield { type: "say", text: "EDGAR filings pull automatically." };
      yield { type: "done" };
    };

    const out: any[] = [];
    for await (const c of orch.runTurn(
      { text: "can you extract sec filing", language: "en" },
      { history: [], buyerNotes: [], agentName: "Messi", learningsContext: "" },
      new AbortController().signal
    )) {
      out.push(c);
    }

    expect(calls.map((c) => c.name)).toEqual([
      "navigate",
      "click",
      "look",
      "click",
      "set_phase",
    ]);
    expect(out[0]).toEqual({
      type: "say",
      text: "EDGAR filings by ticker or CIK — running in the cloud.",
    });
    expect(out.some((c) => c.type === "say" && c.text.includes("replay"))).toBe(true);
    expect(calls[1].input).toEqual({ text: "Extract SEC filing data" });
    expect(calls[3].input).toEqual({ text: "Run script" });
    expect(out.some((c) => c.type === "navigate")).toBe(true);
  });
});
