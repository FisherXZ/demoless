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
    expect(says.join(" ")).not.toContain("Let me check.");
    expect(says.join(" ")).toContain("Here is pricing.");
    expect(executor.run).toHaveBeenCalledWith("navigate", { url: "/p" }, expect.anything()); // signal threaded
    expect(out.at(-1)).toEqual({ type: "done" });
  });

  it("emits no spoken filler for tool calls — only the model's real reply is spoken", async () => {
    // We removed the hardcoded tool fillers ("Let me pull that up.", "One sec.",
    // "Let me take a look."): the agent must lead with real value and never
    // narrate its own clicks. A tool call should produce no filler command.
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

    // No filler commands at all — the agent does not narrate tool calls.
    expect(fillerCmds.length).toBe(0);

    // The model's real reply is still spoken.
    expect(sayCmds.map((c: any) => c.text).join(" ")).toContain("Here is pricing.");
  });

  it("stops immediately when aborted before streaming", async () => {
    const ac = new AbortController(); ac.abort();
    const stream = (async function* () { yield { kind: "text", delta: "x" }; }) as any;
    const executor = { phase: "HOOK", run: vi.fn() };
    const out: any[] = [];
    for await (const c of runTurn({ system: "s", messages: [], executor: executor as any, signal: ac.signal, stream })) out.push(c);
    expect(out).toEqual([{ type: "done" }]);
  });

  it("stops if the signal is aborted while a stream event is being processed", async () => {
    const ac = new AbortController();
    const stream = (async function* () {
      ac.abort();
      yield { kind: "text", delta: "too late" };
    }) as any;
    const executor = { phase: "HOOK", run: vi.fn() };
    const out: any[] = [];

    for await (const c of runTurn({
      system: "s",
      messages: [],
      executor: executor as any,
      signal: ac.signal,
      stream,
    })) out.push(c);

    expect(out).toEqual([{ type: "done" }]);
    expect(executor.run).not.toHaveBeenCalled();
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

  it("emits phase, memory, and screen commands from non-navigation tool calls", async () => {
    const stream = (() => {
      let i = 0;
      const scripts = [
        [
          { kind: "tool_use", id: "phase", name: "set_phase", input: { phase: "DISCOVERY" } },
          { kind: "tool_use", id: "memory", name: "remember", input: { type: "interest", note: "security" } },
          { kind: "tool_use", id: "click", name: "click", input: { text: "Security" } },
          { kind: "end" },
        ],
        [{ kind: "end" }],
      ];
      return async function* () { yield* scripts[i++]; } as any;
    })();
    const executor = {
      phase: "HOOK",
      run: vi.fn(async (name: string) => ({
        ok: true,
        content: name === "click" ? "URL: /security\n\nSecurity page" : "ok",
      })),
    };
    const out: any[] = [];

    for await (const c of runTurn({
      system: "s",
      messages: [],
      executor: executor as any,
      signal: new AbortController().signal,
      stream,
    })) out.push(c);

    expect(out).toContainEqual({ type: "set_phase", phase: "DISCOVERY" });
    expect(out).toContainEqual({
      type: "remember",
      note: "security",
      noteType: "interest",
    });
    expect(out).toContainEqual({ type: "screen_is_on", page: "/security" });
  });

  it("falls back to an empty page label when a look result has no title, URL, or input URL", async () => {
    const stream = (() => {
      let i = 0;
      const scripts = [
        [{ kind: "tool_use", id: "look", name: "look", input: {} }, { kind: "end" }],
        [{ kind: "end" }],
      ];
      return async function* () { yield* scripts[i++]; } as any;
    })();
    const executor = {
      phase: "HOOK",
      run: vi.fn(async () => ({ ok: true, content: "PAGE TEXT" })),
    };
    const out: any[] = [];

    for await (const c of runTurn({
      system: "s",
      messages: [],
      executor: executor as any,
      signal: new AbortController().signal,
      stream,
    })) out.push(c);

    expect(out).toContainEqual({ type: "screen_is_on", page: "" });
  });
});
