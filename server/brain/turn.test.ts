import { describe, it, expect, vi } from "vitest";
import { runTurn } from "./turn";

describe("runTurn", () => {
  it("streams say sentences, runs a tool with the signal, then continues", async () => {
    const stream = (() => {
      let i = 0;
      const scripts = [
        [{ kind: "text", delta: "Let me check. " }, { kind: "tool_use", id: "0", name: "navigate", input: { url: "/p" } }, { kind: "end" }],
        [{ kind: "text", delta: "Here is pricing." }, { kind: "end" }],
      ];
      return async function* () { yield* scripts[i++]; } as any;
    })();
    const executor = { phase: "HOOK", run: vi.fn(async () => ({ ok: true, content: "PAGE TEXT" })) };
    const out: any[] = [];
    for await (const c of runTurn({ system: "s", messages: [{ role: "user", content: "price?" }],
      executor: executor as any, signal: new AbortController().signal, stream })) out.push(c);
    const says = out.filter((c) => c.type === "say").map((c) => c.text);
    expect(says.join(" ")).toContain("Let me check.");
    expect(says.join(" ")).toContain("Here is pricing.");
    expect(executor.run).toHaveBeenCalledWith("navigate", { url: "/p" }, expect.anything()); // signal threaded
    expect(out.at(-1)).toEqual({ type: "done" });
  });

  it("filler commands are yielded as type=filler, not type=say, so they are excluded from history", async () => {
    // Regression for principal review finding #4: filler lines ("Let me pull that up.")
    // must not contaminate conversation history. They are yielded as {type:"filler"}
    // so session.ts speaks them but does not push them to spoken[].
    const stream = (() => {
      let i = 0;
      const scripts = [
        [{ kind: "tool_use", id: "0", name: "navigate", input: { url: "/pricing" } }, { kind: "end" }],
        [{ kind: "text", delta: "Here is pricing." }, { kind: "end" }],
      ];
      return async function* () { yield* scripts[i++]; } as any;
    })();
    const executor = { phase: "HOOK", run: vi.fn(async () => ({ ok: true, content: "URL: /pricing\nTitle: Pricing\n\ntext" })) };
    const out: any[] = [];
    for await (const c of runTurn({ system: "s", messages: [{ role: "user", content: "show pricing" }],
      executor: executor as any, signal: new AbortController().signal, stream })) out.push(c);

    const fillerCmds = out.filter((c) => c.type === "filler");
    const sayCmds = out.filter((c) => c.type === "say");

    // The navigate filler must be a filler command, not a say.
    expect(fillerCmds.length).toBeGreaterThan(0);
    expect(fillerCmds[0].text).toBe("Let me pull that up.");

    // The model's real reply is a say command.
    expect(sayCmds.map((c: any) => c.text).join(" ")).toContain("Here is pricing.");

    // No filler text appears as a say command.
    expect(sayCmds.map((c: any) => c.text)).not.toContain("Let me pull that up.");
  });

  it("stops immediately when aborted before streaming", async () => {
    const ac = new AbortController(); ac.abort();
    const stream = (async function* () { yield { kind: "text", delta: "x" }; }) as any;
    const executor = { phase: "HOOK", run: vi.fn() };
    const out: any[] = [];
    for await (const c of runTurn({ system: "s", messages: [], executor: executor as any, signal: ac.signal, stream })) out.push(c);
    expect(out).toEqual([{ type: "done" }]);
  });

  it("does not start a second hop if aborted DURING tool execution (REVIEW FIX improvement 3)", async () => {
    const ac = new AbortController();
    const stream = (async function* () {
      yield { kind: "tool_use", id: "0", name: "navigate", input: { url: "/p" } };
      yield { kind: "end" };
    }) as any;
    const executor = { phase: "HOOK", run: vi.fn(async () => { ac.abort(); return { ok: false, content: "aborted" }; }) };
    const out: any[] = [];
    for await (const c of runTurn({ system: "s", messages: [], executor: executor as any, signal: ac.signal, stream })) out.push(c);
    expect(executor.run).toHaveBeenCalledTimes(1);   // no second hop
    expect(out.at(-1)).toEqual({ type: "done" });
  });
});
