# Single-Brain Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge four parallel lanes into one brain (P1's Loop) that drives voice (P2), a live browser (P3), and memory+RAG (P4) through a single streaming tool-use contract, hosted in one long-lived Node agent server.

**Architecture:** P1's `Loop`/`contract` survive; `model.ts` is reworked from batch structured-JSON into a streaming native tool-use loop. A `LoopOrchestrator` adapter exposes the Loop as P2's existing `Orchestrator` interface so the voice session is unchanged. The agent server (evolved from P2's voice gateway) owns the Loop + the Browserbase session per demo session; the room is a thin WebSocket client. Browser actions, memory writes, and RAG are **tools** the brain calls; STT/TTS are transport.

**Tech Stack:** TypeScript, Node, Next.js, `ws`, Anthropic SDK (`claude-opus-4-8` / `claude-sonnet-4-6`), Deepgram (STT/TTS), Browserbase + `playwright-core`, Redis / Redis Stack (RediSearch), OpenAI embeddings (`text-embedding-3-small`), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-20-single-brain-convergence-design.md`
**Research reference:** `research/voice-agent-architecture-spine.md`

## Global Constraints

- Brain model tier is config-switchable via `ANTHROPIC_MODEL` (default `claude-opus-4-8`, alt `claude-sonnet-4-6`). Never hard-code the model id outside the one config read.
- STT/TTS are transport, never tools. Tools are exactly: `navigate`, `click`, `look`, `remember`, `search_knowledge`, `set_phase`.
- `say` text streams to TTS sentence-by-sentence; never block first audio on the full response.
- Barge-in aborts the active turn AND truncates conversation history to spoken-only.
- One brain per demo session; the brain and the Browserbase session are co-located in the agent server.
- The demonstrated product is data (`DemoConfig` keyed by `company`), never branched in brain code.
- Memory uses plain Redis; RAG requires Redis Stack + `OPENAI_API_KEY` and must degrade to a no-op if the index is absent.
- NextAuth/Google sign-in is OUT of scope; identity is form-email or a stubbed buyer id.
- Write the failing test first; run it red; implement minimally; run it green; commit. Conventional-commit messages.

---

## File Structure

**New (agent brain):**
- `server/brain/tools.ts` — Anthropic tool definitions + `ToolName` union + tool input/result types.
- `server/brain/executor.ts` — `ToolExecutor` interface + `makeExecutor()` binding tools to lanes (browser/memory/knowledge).
- `server/brain/turn.ts` — `runTurn()` streaming native tool-use loop yielding `Command`s.
- `server/orchestrator/loop.ts` — `LoopOrchestrator implements Orchestrator` (owns Loop state, builds messages, calls `runTurn`).
- `server/brain/messages.ts` — system-prompt + message assembly (persona, memory recall, page context).
- `server/config/demoConfig.ts` — `DemoConfig` type + the Browserbase config + lookup by `company`.
- `server/util/sentenceChunker.ts` — `SentenceChunker` extracted from `stub.ts` (shared by the stub + the brain turn).

**Modified:**
- `lib/voice/messages.ts` — extend the shared `Command` union (add `set_phase`) and `ServerEvent` union (add `set_phase`, `live_view`); keep `click_or_type`/`buyer_loaded`.
- `server/model.ts` — add `streamWithTools()` (max_tokens 2048); keep `complete()` only as the stub-fallback path.
- `server/orchestrator/index.ts` — `createOrchestrator()` returns `LoopOrchestrator`.
- `server/session.ts` — own a Browserbase session per connection; forward `screen_is_on`/`liveViewUrl` to client; truncate history on barge-in.
- `server/index.ts` (P2 gateway, post-merge) — production server; mounts the agent server.
- `lib/voice/useVoiceAgent.ts` — send text `user_said`; receive `screen`/`liveViewUrl`.
- `components/DemoRoom.tsx` — single WS path for text + voice; render `liveViewUrl`.

**Demoted:**
- `server/index.ts` (P1 standalone loop server) → `server/harness.ts` (dev/test harness; keeps `server/*.test.ts` green).

**Memory/knowledge (from P4, post-merge):** consumed as-is — `lib/memory/*`, `lib/knowledge/*`.

---

## PHASE 0 — Converge the tree

> Not TDD; verification is `tsc` + `next build` + existing test suites green. Do this on a dedicated branch.

### Task 0.1: Checkpoint uncommitted P5 work

**Files:** working tree (dashboard, harness, Landing, tokens, DESIGN.md).

- [ ] **Step 1: Create the convergence branch**

```bash
git checkout -b converge/single-brain
```

- [ ] **Step 2: Exclude local agent/tooling dirs, then stage and commit everything else**

```bash
printf '\n.claude/\n.codex/\n.cursor/\n.agents/\n' >> .gitignore
git add -A
# guard: agent/tooling scratch dirs must NOT be in the checkpoint
git diff --cached --name-only | grep -E '^\.(claude|codex|cursor|agents)/' && { echo "STOP: tooling dir staged"; exit 1; } || true
git commit -m "chore: checkpoint P5 dashboard + landing + product/docs before convergence merge"
```

- [ ] **Step 3: Verify clean tree**

Run: `git status --short`
Expected: empty output.

### Task 0.2: Merge origin/main and resolve the four mechanical conflicts

**Files:** Modify: `package.json`, `package-lock.json`, `.gitignore`, `.env.example`.

- [ ] **Step 1: Merge**

```bash
git fetch origin && git merge origin/main
```
Expected: conflicts in `package.json`, `package-lock.json`, `.gitignore`, `.env.example`, `server/index.ts`.

- [ ] **Step 2: Union `package.json`** — keep all deps + scripts from both sides (P5 scripts + P2 voice/server/Browserbase deps). Resolve, then:

```bash
git checkout --theirs package-lock.json   # regenerate next
```

- [ ] **Step 3: Union `.gitignore` and `.env.example`** — keep every line from both sides (dedupe identical lines).

- [ ] **Step 4: Regenerate the lockfile**

Run: `npm install`
Expected: lockfile updates cleanly; no peer-dep errors.

- [ ] **Step 5: Leave `server/index.ts` conflicted** — resolved in Task 0.3.

### Task 0.3: Resolve `server/index.ts` — demote P1's loop server to a harness

**Files:**
- Create: `server/harness.ts` (P1's standalone WS loop server content).
- Modify: `server/index.ts` (keep P2's voice gateway version).
- Modify: any `server/*.test.ts` that imported `startServer` from `./index`.

**Interfaces:**
- Produces: `server/harness.ts` exports `startServer(port: number)` (moved verbatim from P1's `server/index.ts`).

- [ ] **Step 1: Confirm `:2:` IS P1's loop server, then extract it FIRST (REVIEW FIX B6 — do this before any `git add`/`git checkout` of `server/index.ts`, or `:2:` is gone)**

```bash
git show :2:server/index.ts | head -8   # MUST show P1's loop server (imports Loop, fakes/voice|browser|memory)
git show :2:server/index.ts > server/harness.ts
```
`:2:` = "ours" = the converge-branch HEAD = P1's loop server (committed to the branch in Task 0.1). Valid only while `server/index.ts` is still unmerged. If `head` does not show the loop server, STOP — the side assumption is wrong.

- [ ] **Step 2: Take P2's gateway as `server/index.ts`**

```bash
git checkout --theirs server/index.ts
```

- [ ] **Step 3: Update test imports** — change `from "./index"` to `from "./harness"` in `server/index.test.ts` (rename file to `server/harness.test.ts` if it targets the loop server).

- [ ] **Step 4: Mark resolved + verify both compile**

Run: `git add server/index.ts server/harness.ts server/*.test.ts && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 5: Run existing server tests**

Run: `npx vitest run server/`
Expected: P1 loop/contract/harness tests pass against `server/harness.ts`.

- [ ] **Step 6: Commit the origin/main merge**

```bash
git commit -m "merge: origin/main (voice P2 + room P3); demote P1 loop server to server/harness.ts"
```

### Task 0.4: Merge `p4-memory-layer` and resolve P4↔P5/P3 overlaps

**Files:** Modify (conflict resolution): `components/DemoRoom.tsx`, `lib/useDemoState.ts`, `lib/types.ts`, `components/Landing.tsx`, `package.json`, `.env.example`.

- [ ] **Step 1: Merge the branch**

```bash
git merge origin/p4-memory-layer
```

- [ ] **Step 2: Resolve `lib/types.ts`** — union: keep P5/P3 `DemoVals` fields AND P4's `authStatus/recallLine/...`; but since NextAuth is deferred, keep P4's `recallLine` and drop the `auth*`/`signInGoogle` fields (they are out of scope). Keep `role/size/useCase` form fields.

- [ ] **Step 3: Resolve `lib/useDemoState.ts`** — keep P4's `enterDemo()` recall call but replace the `useSession()`/`isAuthed` gate with a stubbed/form identity (buyer id from form email). Remove `signInGoogle/signOutGoogle`.

- [ ] **Step 4: Resolve `components/Landing.tsx`** — keep P5's de-slopped landing; drop P4's Google sign-in button.

- [ ] **Step 5: Resolve `components/DemoRoom.tsx`** — keep P3's room (browser + voice) as the base; graft P4's `recallLine` display. (Full room rewire happens in Phase 2; here just make it compile.)

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git commit -m "merge: p4-memory-layer (Redis memory + RAG); defer NextAuth, use form identity"
```

---

## PHASE 1 — The brain (streaming native tool-use)

### Task 1.0: Extend the shared voice contract (REVIEW FIX B1/B4/B5)

> The brain must yield the **real** `Command` union (`lib/voice/messages.ts`), not a fork. This task extends that one shared union + the `ServerEvent` union so `set_phase` and `live_view` exist end-to-end. Do this first; every later brain task imports `Command` from here.

**Files:**
- Modify: `lib/voice/messages.ts`
- Modify: `server/session.ts` (forward `set_phase`)
- Test: `lib/voice/messages.test.ts`

**Interfaces:**
- Produces: the shared `Command` union gains `{ type: "set_phase"; phase: string }` (keeping `click_or_type` and `buyer_loaded`). The shared `ServerEvent` union gains `{ t: "set_phase"; phase: string }` and `{ t: "live_view"; url: string }`. `parseServerEvent` accepts both new events. `server/session.ts`'s `orchestratorSay` switch forwards a `set_phase` command as `{ t: "set_phase", phase }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { parseServerEvent } from "./messages";

describe("voice contract extensions", () => {
  it("parses a live_view event", () => {
    expect(parseServerEvent(JSON.stringify({ t: "live_view", url: "https://x" })))
      .toEqual({ t: "live_view", url: "https://x" });
  });
  it("parses a set_phase event", () => {
    expect(parseServerEvent(JSON.stringify({ t: "set_phase", phase: "DISCOVERY" })))
      .toEqual({ t: "set_phase", phase: "DISCOVERY" });
  });
});
```

- [ ] **Step 2: Run red** — `npx vitest run lib/voice/messages.test.ts` → FAIL (events unrecognized / type missing).

- [ ] **Step 3: Implement** — first locate the SINGLE `Command` union that `server/orchestrator/types.ts`'s `Orchestrator.runTurn` references. It is defined in `lib/voice/messages.ts` and imported by `types.ts`. If the two are instead duplicated, add `set_phase` to BOTH and leave a `// TODO: dedupe` — they MUST stay structurally identical (the brain yields one, the Orchestrator expects the other). Then in `lib/voice/messages.ts`:
  - add `| { type: "set_phase"; phase: string }` to the `Command` union (leave `click_or_type` and `buyer_loaded` intact);
  - add `| { t: "set_phase"; phase: string }` and `| { t: "live_view"; url: string }` to the `ServerEvent` union;
  - extend `parseServerEvent`'s recognized `t` values to include `"set_phase"` and `"live_view"`.

- [ ] **Step 4: Forward `set_phase` in `server/session.ts`** — add to the `orchestratorSay` switch (alongside `screen_is_on`/`remember`):

```ts
case "set_phase":
  this.send({ t: "set_phase", phase: cmd.phase });
  break;
```

- [ ] **Step 5: Run green** — `npx vitest run lib/voice/messages.test.ts` → PASS; `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit** — `git commit -am "feat(contract): add set_phase + live_view to shared Command/ServerEvent unions"`

### Task 1.1: Tool catalog + types

**Files:**
- Create: `server/brain/tools.ts`
- Test: `server/brain/tools.test.ts`

**Interfaces:**
- Produces:
  - `type ToolName = "navigate" | "click" | "look" | "remember" | "search_knowledge" | "set_phase"`
  - `const TOOLS: Anthropic.Tool[]`
  - `interface ToolResult { ok: boolean; content: string }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { TOOLS } from "./tools";

describe("tool catalog", () => {
  it("exposes exactly the six brain tools and no STT/TTS tool", () => {
    const names = TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(
      ["click", "look", "navigate", "remember", "search_knowledge", "set_phase"].sort()
    );
  });
  it("every tool has an input_schema with a type object", () => {
    for (const t of TOOLS) expect(t.input_schema.type).toBe("object");
  });
});
```

- [ ] **Step 2: Run red**

Run: `npx vitest run server/brain/tools.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import type Anthropic from "@anthropic-ai/sdk";

export type ToolName =
  | "navigate" | "click" | "look" | "remember" | "search_knowledge" | "set_phase";

export interface ToolResult { ok: boolean; content: string }

export const TOOLS: Anthropic.Tool[] = [
  { name: "navigate", description: "Drive the live browser to a full URL on the demo site.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "click", description: "Click an element on the current page by its visible text.",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
  { name: "look", description: "Read the current page (title, links, text) without navigating.",
    input_schema: { type: "object", properties: {}, required: [] } },
  { name: "remember", description: "Save a durable note about the buyer.",
    input_schema: { type: "object", properties: {
      note: { type: "string" },
      type: { type: "string", enum: ["preference","pain_point","objection","interest","persona","next_step"] }
    }, required: ["note","type"] } },
  { name: "search_knowledge", description: "Look up grounded product facts before answering.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "set_phase", description: "Report the current sales phase (observed, not enforced).",
    input_schema: { type: "object", properties: {
      phase: { type: "string", enum: ["HOOK","DISCOVERY","WALKTHROUGH","CLOSE","DONE"] }
    }, required: ["phase"] } },
];
```

- [ ] **Step 4: Run green**

Run: `npx vitest run server/brain/tools.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/brain/tools.ts server/brain/tools.test.ts
git commit -m "feat(brain): tool catalog (navigate/click/look/remember/search_knowledge/set_phase)"
```

### Task 1.2: ToolExecutor

**Files:**
- Create: `server/brain/executor.ts`
- Test: `server/brain/executor.test.ts`

**Interfaces:**
- Consumes: `ToolName`, `ToolResult` (Task 1.1); browser lane (from `lib/browser/session.ts`) — **REVIEW FIX B3:** `navigate(sessionId,url)` and `clickText(sessionId,text)` return `ScreenState{sessionId,url,title}` (NO `links`/`text`); only `pageContext(sessionId)` returns the full `PageContext{url,title,links,text}`. So after a navigate/click we MUST call `pageContext` to get text for the model. Memory `remember`; knowledge `searchKnowledge`+`buildAnswerContext`.
- Produces:
  - `interface ToolExecutor { run(name: ToolName, input: any, signal?: AbortSignal): Promise<ToolResult>; phase: string }`
  - `function makeExecutor(deps: ExecutorDeps): ToolExecutor`
  - `interface ExecutorDeps { sessionId: string; buyerId: string; company: string; browser: BrowserLane; memory: MemoryLane; knowledge: KnowledgeLane }`

- [ ] **Step 1: Write the failing test** (fakes mirror the REAL lane shapes — navigate/click return `ScreenState`, pageContext returns full `PageContext`)

```ts
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
```

- [ ] **Step 2: Run red** — `npx vitest run server/brain/executor.test.ts` → FAIL.

- [ ] **Step 3: Implement** (note `ScreenState` vs `PageContext`, the navigate→pageContext two-step, and the abort guard)

```ts
import type { ToolName, ToolResult } from "./tools";

export interface ScreenState { sessionId: string; url: string; title: string }
export interface PageContext { url: string; title: string; links: string[]; text: string }
export interface BrowserLane {
  navigate(sessionId: string, url: string): Promise<ScreenState>;
  clickText(sessionId: string, text: string): Promise<ScreenState>;
  pageContext(sessionId: string): Promise<PageContext>;
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
  `URL: ${p.url}\nTitle: ${p.title}\nLinks: ${p.links.join(", ")}\n\n${p.text}`.slice(0, 4000);

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
          case "look":
            return { ok: true, content: pageToText(await d.browser.pageContext(d.sessionId)) };
          case "remember":
            await d.memory.remember(d.buyerId, { text: input.note, type: input.type });
            return { ok: true, content: "noted" };
          case "search_knowledge": {
            const hits = await d.knowledge.searchKnowledge(d.company, input.query);
            return { ok: true, content: hits.length ? d.knowledge.buildAnswerContext(hits) : "No matching facts." };
          }
          case "set_phase": phase = input.phase; return { ok: true, content: `phase=${phase}` };
        }
      } catch (e) {
        return { ok: false, content: `tool ${name} failed: ${(e as Error).message}` };
      }
    },
  };
}
```

- [ ] **Step 4: Run green** — `npx vitest run server/brain/executor.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(brain): ToolExecutor (ScreenState→pageContext two-step, abort guard)"`

### Task 1.3: `streamWithTools()` in `model.ts`

**Files:**
- Modify: `server/model.ts`
- Test: `server/model.streamtools.test.ts`

**Interfaces:**
- Produces: `async function* streamWithTools(req: StreamRequest): AsyncIterable<ModelEvent>` where
  - `interface StreamRequest { system: string; messages: Anthropic.MessageParam[]; tools: Anthropic.Tool[] }`
  - `type ModelEvent = { kind: "text"; delta: string } | { kind: "tool_use"; id: string; name: string; input: any } | { kind: "end" }`
  - reads model id from `process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8"`.

- [ ] **Step 1: Write the failing test** (mock the Anthropic stream)

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mkStream = (events: any[]) => ({ async *[Symbol.asyncIterator]() { for (const e of events) yield e; } });

vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { stream: vi.fn(() => mkStream([
    { type: "content_block_delta", delta: { type: "text_delta", text: "Hi " } },
    { type: "content_block_delta", delta: { type: "text_delta", text: "there." } },
    { type: "message_stop" },
  ])) } },
}));

describe("streamWithTools", () => {
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = "x"; });
  it("yields text deltas then end", async () => {
    const { streamWithTools } = await import("./model");
    const out: any[] = [];
    for await (const e of streamWithTools({ system: "s", messages: [{ role: "user", content: "hi" }], tools: [] })) out.push(e);
    expect(out.filter((e) => e.kind === "text").map((e) => e.delta).join("")).toBe("Hi there.");
    expect(out.at(-1)).toEqual({ kind: "end" });
  });
});
```

- [ ] **Step 2: Run red** — FAIL (no `streamWithTools`).

- [ ] **Step 3: Implement** (add to `model.ts`, leave `complete()` as the stub-fallback path)

```ts
export interface StreamRequest { system: string; messages: Anthropic.MessageParam[]; tools: Anthropic.Tool[] }
export type ModelEvent =
  | { kind: "text"; delta: string }
  | { kind: "tool_use"; id: string; name: string; input: any }
  | { kind: "end" };

const MODEL = () => process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export async function* streamWithTools(req: StreamRequest): AsyncIterable<ModelEvent> {
  const stream = getClient().messages.stream({
    model: MODEL(), max_tokens: 2048, system: req.system, messages: req.messages, tools: req.tools, // 2048: REVIEW FIX — matches main (e167048), avoids mid-output truncation
  });
  const toolBuf: Record<string, { name: string; json: string }> = {};
  for await (const ev of stream as any) {
    if (ev.type === "content_block_start" && ev.content_block?.type === "tool_use")
      toolBuf[ev.index] = { name: ev.content_block.name, json: "" };
    else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta")
      yield { kind: "text", delta: ev.delta.text };
    else if (ev.type === "content_block_delta" && ev.delta?.type === "input_json_delta")
      toolBuf[ev.index].json += ev.delta.partial_json;
    else if (ev.type === "content_block_stop" && toolBuf[ev.index]) {
      const b = toolBuf[ev.index];
      yield { kind: "tool_use", id: String(ev.index), name: b.name, input: b.json ? JSON.parse(b.json) : {} };
    }
  }
  yield { kind: "end" };
}
```

- [ ] **Step 4: Run green** — PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(model): streamWithTools() streaming native tool-use (opus/sonnet via env)"`

### Task 1.4: `runTurn()` — the agentic loop yielding Commands

**Files:**
- Create: `server/brain/turn.ts`
- Test: `server/brain/turn.test.ts`

**Interfaces:**
- Consumes: `streamWithTools`+`ModelEvent` (1.3), `TOOLS` (1.1), `ToolExecutor` (1.2), the shared `Command` (Task 1.0), `SentenceChunker` (extracted below).
- Produces: `async function* runTurn(args: TurnArgs): AsyncIterable<Command>` where
  - `interface TurnArgs { system: string; messages: Anthropic.MessageParam[]; executor: ToolExecutor; signal: AbortSignal; stream?: typeof streamWithTools }`
  - **REVIEW FIX B1:** `Command` is **imported from `lib/voice/messages.ts`** (the one shared union), NOT redefined. `runTurn` yields a subset of it (`say`/`navigate`/`screen_is_on`/`remember`/`set_phase`/`done`).
  - Sentence-chunks text into `say` via the shared `SentenceChunker`; executes tool calls via `executor` (passing the abort signal); feeds `tool_result` back; loops until `end` with no tool calls; emits filler `say` at tool-call start.

- [ ] **Step 1: Extract `SentenceChunker` to a shared module (REVIEW FIX improvement 2)** — move the `SentenceChunker` class out of `server/orchestrator/stub.ts` into `server/util/sentenceChunker.ts` (export it, preserving its existing `push(text: string): string[]` / `flush(): string` API), and update `stub.ts` to import it. Run `npx vitest run server/orchestrator/` → existing stub tests still pass.

- [ ] **Step 2: Write the failing test** (fake stream: text → tool_use(navigate) → end, then text → end; plus an abort-during-tool case)

```ts
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
```

- [ ] **Step 3: Run red** — FAIL.

- [ ] **Step 4: Implement**

```ts
import type Anthropic from "@anthropic-ai/sdk";
import { streamWithTools as defaultStream, type ModelEvent } from "../model";
import { TOOLS } from "./tools";
import type { ToolExecutor, ToolName } from "./executor";
import { SentenceChunker } from "../util/sentenceChunker";          // REVIEW FIX improvement 2
import type { Command } from "../../lib/voice/messages";            // REVIEW FIX B1: the ONE shared union

export interface TurnArgs {
  system: string;
  messages: Anthropic.MessageParam[];
  executor: ToolExecutor;
  signal: AbortSignal;
  stream?: (req: any) => AsyncIterable<ModelEvent>;
}

const FILLER: Record<string, string> = {
  navigate: "Let me pull that up.", click: "One sec.", look: "Let me take a look.",
  search_knowledge: "Let me check that.", remember: "", set_phase: "",
};

export async function* runTurn(args: TurnArgs): AsyncIterable<Command> {
  const stream = args.stream ?? defaultStream;
  const messages = [...args.messages];
  for (let hop = 0; hop < 8; hop++) {
    if (args.signal.aborted) break;
    const chunker = new SentenceChunker();
    const toolCalls: { id: string; name: ToolName; input: any }[] = [];
    let textForHistory = "";
    for await (const ev of stream({ system: args.system, messages, tools: TOOLS })) {
      if (args.signal.aborted) { yield { type: "done" }; return; }
      if (ev.kind === "text") {
        textForHistory += ev.delta;
        for (const s of chunker.push(ev.delta)) yield { type: "say", text: s };
      } else if (ev.kind === "tool_use") {
        toolCalls.push({ id: ev.id, name: ev.name as ToolName, input: ev.input });
      }
    }
    const tail = chunker.flush();
    if (tail.trim()) yield { type: "say", text: tail.trim() };
    if (!toolCalls.length) { yield { type: "done" }; return; }

    // record assistant turn (text + tool_use) then execute and feed results back
    const assistant: any[] = [];
    if (textForHistory.trim()) assistant.push({ type: "text", text: textForHistory });
    for (const t of toolCalls) assistant.push({ type: "tool_use", id: t.id, name: t.name, input: t.input });
    messages.push({ role: "assistant", content: assistant });

    const results: any[] = [];
    for (const t of toolCalls) {
      if (FILLER[t.name]) yield { type: "say", text: FILLER[t.name] };
      const r = await args.executor.run(t.name, t.input, args.signal);   // REVIEW FIX improvement 3: thread signal
      if (t.name === "navigate") yield { type: "navigate", url: t.input.url };
      if (t.name === "set_phase") yield { type: "set_phase", phase: t.input.phase };
      if (t.name === "remember") yield { type: "remember", note: t.input.note, noteType: t.input.type };
      if (t.name === "navigate" || t.name === "click" || t.name === "look")
        yield { type: "screen_is_on", page: r.content.slice(0, 200) };
      results.push({ type: "tool_result", tool_use_id: t.id, content: r.content, is_error: !r.ok });
    }
    messages.push({ role: "user", content: results });
  }
  yield { type: "done" };
}
```

- [ ] **Step 5: Run green** — PASS.

- [ ] **Step 6: Commit** — `git commit -am "feat(brain): runTurn yields shared Command, reuses SentenceChunker, threads abort"`

### Task 1.5: `LoopOrchestrator` implements P2's `Orchestrator`

**Files:**
- Create: `server/orchestrator/loop.ts`
- Create: `server/brain/messages.ts`
- Test: `server/orchestrator/loop.test.ts`

**Interfaces:**
- Consumes: `Orchestrator`/`TurnInput`/`TurnContext` (`server/orchestrator/types.ts`), `runTurn` (1.4), `makeExecutor` (1.2), `buildSystem` (below).
- Produces:
  - `server/brain/messages.ts`: `function buildSystem(cfg: DemoConfig, memoryContext: string): string`; `function toMessages(history: ConversationTurn[]): Anthropic.MessageParam[]`.
  - `server/orchestrator/loop.ts`: `class LoopOrchestrator implements Orchestrator` with ctor `(deps: { executor: ToolExecutor; cfg: DemoConfig })`. **REVIEW FIX B2:** `greeting` is the OPTIONAL interface member `greeting?(language: Language, agentName: string): Promise<string> | string`; declaring a concrete sync `greeting(...)` satisfies it. **REVIEW FIX B1:** `runTurn`'s yielded `Command` (shared, Task 1.0) and the `Orchestrator`'s `Command` (`./types`) MUST be the same union — the voice session acts on `say`, forwards the rest.

- [ ] **Step 1: Write the failing test** (inject a fake `runTurn` via a seam, assert `runTurn` Commands surface as Orchestrator Commands)

```ts
import { describe, it, expect } from "vitest";
import { LoopOrchestrator } from "./loop";

const cfg = { company: "browserbase", productName: "Browserbase", persona: "Messi", browseTargetUrl: "https://x", corpusSeed: "" };
const executor = { phase: "HOOK", run: async () => ({ ok: true, content: "" }) };

describe("LoopOrchestrator", () => {
  it("yields say commands from a turn", async () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    (orch as any)._runTurn = async function* () { yield { type: "say", text: "Hello." }; yield { type: "done" }; };
    const out: any[] = [];
    for await (const c of orch.runTurn({ text: "hi", language: "en" }, { history: [], buyerNotes: [], agentName: "Messi" }, new AbortController().signal)) out.push(c);
    expect(out.some((c) => c.type === "say" && c.text === "Hello.")).toBe(true);
  });
  it("greeting uses persona + recall", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    expect(orch.greeting("en", "Messi")).toContain("Messi");
  });
});
```

- [ ] **Step 2: Run red** — FAIL.

- [ ] **Step 3: Implement `messages.ts`**

```ts
import type Anthropic from "@anthropic-ai/sdk";
import type { DemoConfig } from "../config/demoConfig";

export interface ConversationTurn { role: "user" | "agent"; text: string }

export function buildSystem(cfg: DemoConfig, memoryContext: string): string {
  return [
    `You are ${cfg.persona}, a friendly AI sales rep giving a LIVE, screen-shared demo of ${cfg.productName}.`,
    `You drive a real web browser the visitor is watching. Use the navigate/click/look tools to show pages.`,
    `Before stating product facts, call search_knowledge. Save durable buyer signals with remember.`,
    `Report your sales phase with set_phase as the conversation moves (HOOK→DISCOVERY→WALKTHROUGH→CLOSE).`,
    memoryContext ? `\n${memoryContext}` : "",
  ].join("\n");
}

export function toMessages(history: ConversationTurn[]): Anthropic.MessageParam[] {
  return history.map((h) => ({ role: h.role === "agent" ? "assistant" : "user", content: h.text }));
}
```

- [ ] **Step 4: Implement `loop.ts`**

```ts
import type { Orchestrator, TurnInput, TurnContext, Command, Language } from "./types";
import type { ToolExecutor } from "../brain/executor";
import type { DemoConfig } from "../config/demoConfig";
import { runTurn } from "../brain/turn";
import { buildSystem, toMessages } from "../brain/messages";

export class LoopOrchestrator implements Orchestrator {
  private _runTurn = runTurn; // seam for tests
  constructor(private deps: { executor: ToolExecutor; cfg: DemoConfig }) {}

  greeting(_lang: Language, agentName: string): string {
    return `Hi, I'm ${agentName}. Want me to walk you through ${this.deps.cfg.productName}?`;
  }

  async *runTurn(input: TurnInput, ctx: TurnContext, signal: AbortSignal): AsyncIterable<Command> {
    const memoryContext = ctx.buyerNotes.length ? `Known buyer notes:\n- ${ctx.buyerNotes.join("\n- ")}` : "";
    const system = buildSystem(this.deps.cfg, memoryContext);
    const messages = [...toMessages(ctx.history), { role: "user" as const, content: input.text }];
    for await (const c of this._runTurn({ system, messages, executor: this.deps.executor, signal })) {
      yield c as Command; // P2 acts on say, forwards navigate/screen_is_on/remember/set_phase
    }
  }
}
```

- [ ] **Step 5: Run green** — PASS.

- [ ] **Step 6: Commit** — `git commit -am "feat(orchestrator): LoopOrchestrator implements Orchestrator over runTurn"`

---

## PHASE 2 — Agent server owns the brain + browser

### Task 2.1: `DemoConfig` + Browserbase config

**Files:**
- Create: `server/config/demoConfig.ts`
- Test: `server/config/demoConfig.test.ts`

**Interfaces:**
- Produces: `interface DemoConfig {...}` (per spec §4.4); `function getDemoConfig(company?: string): DemoConfig` returning the Browserbase default.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { getDemoConfig } from "./demoConfig";
describe("getDemoConfig", () => {
  it("returns the Browserbase default", () => {
    const c = getDemoConfig();
    expect(c.company).toBe("browserbase");
    expect(c.browseTargetUrl).toMatch(/^https?:\/\//);
    expect(c.persona).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement** (persona + browseTargetUrl are the two deferred config values — set defaults; confirm with stakeholder before stage)

```ts
export interface DemoConfig {
  company: string; productName: string; persona: string; browseTargetUrl: string; corpusSeed: string;
}
const BROWSERBASE: DemoConfig = {
  company: "browserbase",
  productName: "Browserbase",
  persona: process.env.DEMO_PERSONA ?? "Messi",
  browseTargetUrl: process.env.DEMO_BROWSE_URL ?? "https://www.browserbase.com",
  corpusSeed: "browserbase",
};
export function getDemoConfig(company = "browserbase"): DemoConfig {
  if (company === "browserbase") return BROWSERBASE;
  throw new Error(`no DemoConfig for company '${company}'`);
}
```

- [ ] **Step 4: Run green. Step 5: Commit** — `git commit -am "feat(config): DemoConfig with Browserbase default (persona/url via env)"`

### Task 2.2: Wire `createOrchestrator()` to build a `LoopOrchestrator` per session

**Files:**
- Modify: `server/orchestrator/index.ts`
- Modify: `server/session.ts` (construct executor with the session's Browserbase id + buyer + config)
- Test: `server/orchestrator/index.test.ts`

**Interfaces:**
- Consumes: `LoopOrchestrator` (1.5), `makeExecutor` (1.2), `getDemoConfig` (2.1), browser lane (`lib/browser/session.ts`), memory/knowledge lanes.
- Produces: `createOrchestrator(args: { sessionId: string; buyerId: string; company: string }): Orchestrator`.

- [ ] **Step 1: Failing test** — `createOrchestrator({...})` returns an object with `runTurn` + `greeting`.

```ts
import { describe, it, expect } from "vitest";
import { createOrchestrator } from "./index";
describe("createOrchestrator", () => {
  it("returns a LoopOrchestrator (has runTurn + greeting)", () => {
    const o = createOrchestrator({ sessionId: "s", buyerId: "b", company: "browserbase" });
    expect(typeof o.runTurn).toBe("function");
    expect(typeof o.greeting).toBe("function");
  });
});
```

- [ ] **Step 2: Run red** (current `createOrchestrator` takes no args / returns StubOrchestrator).

- [ ] **Step 3: Implement**

```ts
import type { Orchestrator } from "./types";
import { LoopOrchestrator } from "./loop";
import { makeExecutor } from "../brain/executor";
import { getDemoConfig } from "../config/demoConfig";
import * as browser from "../../lib/browser/session";
import { remember } from "../../lib/memory/store";
import { searchKnowledge, buildAnswerContext } from "../../lib/knowledge/store";

export function createOrchestrator(args: { sessionId: string; buyerId: string; company: string }): Orchestrator {
  const cfg = getDemoConfig(args.company);
  const executor = makeExecutor({
    sessionId: args.sessionId, buyerId: args.buyerId, company: cfg.company,
    browser, memory: { remember }, knowledge: { searchKnowledge, buildAnswerContext },
  });
  return new LoopOrchestrator({ executor, cfg });
}
```

- [ ] **Step 4: Run green. Step 5: Commit** — `git commit -am "feat(orchestrator): createOrchestrator builds per-session LoopOrchestrator"`

### Task 2.3: `VoiceSession` owns a Browserbase session + forwards screen/liveViewUrl

**Files:**
- Modify: `server/session.ts`
- Test: `server/session.browser.test.ts`

**Interfaces:**
- Consumes: `browser.startSession/stopSession` (`lib/browser/session.ts`); `createOrchestrator` (2.2); the `live_view` `ServerEvent` (added in Task 1.0, **REVIEW FIX B4**).
- Produces: on connect, `VoiceSession` calls `startSession(cfg.browseTargetUrl)`, sends `{ t: "live_view", url }` to the client (event type now exists per Task 1.0), builds the orchestrator with the returned `sessionId`; on close calls `stopSession(sessionId)`. `{ t: "screen_is_on"; page }` already exists.

- [ ] **Step 1: Failing test** — construct a `VoiceSession` with a fake ws + fake `startSession`; assert it emits `live_view` with the URL and builds the orchestrator with the returned `sessionId`. (Use dependency injection: add an optional `deps` ctor param defaulting to the real `browser`/`createOrchestrator`.)

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement** — in the ctor/`startListening`, call `startSession`, store `sessionId`, emit `live_view`, and replace `createOrchestrator()` with `createOrchestrator({ sessionId, buyerId, company })`. On `ws.close`, `stopSession(sessionId)`.

- [ ] **Step 4: Run green. Step 5: Commit** — `git commit -am "feat(session): VoiceSession owns Browserbase session, forwards live_view"`

### Task 2.4: Barge-in truncates history to spoken-only

**Files:**
- Modify: `server/session.ts`
- Test: `server/session.bargein.test.ts`

**Interfaces:**
- Consumes: existing `runTurn` cancellation (`this.active.abort`), `this.history`, `pipelineSpeak` return value (`spoken: string[]`).
- Produces: on barge-in, the agent turn is recorded as ONLY the spoken sentences (`spoken.join(" ")`), never the full intended response.
- **REVIEW FIX improvement 4 — this is a behavior CHANGE, not a no-op.** Today `session.ts` appends the agent turn ONLY inside an `if (!abort.signal.aborted)` block, so on barge-in it currently records NOTHING. The spec wants "history = spoken-only," so this task records the spoken sentences even on abort. Do not append unspoken text; if `spoken` is empty, append nothing.

- [ ] **Step 1: Failing test** — drive a turn yielding 3 sentences but aborted after 1 played; assert the recorded agent history entry equals the 1 spoken sentence (today it would be empty — the test pins the new behavior).

- [ ] **Step 2: Run red** (current code records nothing on abort → assertion fails).

- [ ] **Step 3: Implement** — move the agent-turn append OUT of the `if (!aborted)` guard: always `if (spoken.length) this.history.push({ role: "agent", text: spoken.join(" ") })` after the turn settles (aborted or not). Never append the unspoken/intended text.

- [ ] **Step 4: Run green. Step 5: Commit** — `git commit -am "fix(session): record spoken-only agent turn on barge-in (behavior change)"`

### Task 2.5: Room becomes a WS client (text + voice + live view)

**Files:**
- Modify: `lib/voice/useVoiceAgent.ts`
- Modify: `components/DemoRoom.tsx`
- Test: `lib/voice/useVoiceAgent.test.ts` (jsdom)

**Interfaces:**
- Produces (**REVIEW FIX improvement 5 — spell out the `VoiceAgent` delta**): extend the `VoiceAgent` interface (`lib/voice/useVoiceAgent.ts`) with:
  - `sendText(text: string): void` — sends `{ t: "text_input", text }` over the existing socket;
  - `liveViewUrl: string | null` — set when a `{ t: "live_view", url }` event arrives;
  - `lastScreen: { page: string } | null` — set from `{ t: "screen_is_on", page }`.
  `DemoRoom` binds the iframe `src` to `liveViewUrl`, routes its text input through `sendText` (deleting the `/api/agent` fetch path), and the `set_phase` event (already in `ServerEvent`) can update a progress indicator.

- [ ] **Step 1: Failing test** — mock WebSocket; assert `sendText("hi")` writes `{ t: "text_input", text: "hi" }` and a `live_view` message sets `liveViewUrl`.

- [ ] **Step 2: Run red.**

- [ ] **Step 3: Implement** — add the handlers + outbound message; in `DemoRoom`, replace `send()`'s fetch with `voice.sendText(msg)` and bind the iframe `src` to `voice.liveViewUrl`.

- [ ] **Step 4: Run green. Step 5: Commit** — `git commit -am "feat(room): single WS path for text+voice; render server live view"`

### Task 2.6: Verify the room end-to-end (manual, gated)

- [ ] **Step 1:** Start Redis Stack: `docker run -d -p 6379:6379 redis/redis-stack:latest`
- [ ] **Step 2:** Seed knowledge: `npm run knowledge:seed` (Browserbase corpus). Expected: ">0 chunks indexed".
- [ ] **Step 3:** Start the agent server + Next dev; open the room; speak "show me pricing". Expected: Messi says a filler line, the watched browser navigates, Messi answers grounded; a note appears in the dashboard.
- [ ] **Step 4: Commit any fixups** with `fix(room): ...` messages.

---

## PHASE 3 — Memory + RAG grounding

### Task 3.1: Inject buyer recall at session start

**Files:**
- Modify: `server/session.ts` (load buyer on connect)
- Modify: `server/orchestrator/loop.ts` (greeting uses recall)
- Test: `server/orchestrator/loop.recall.test.ts`

**Interfaces:**
- Consumes: `loadBuyer(email)` → `{ recall, notes, isReturning }`, `composeRecall`/`buildMemoryContext` (`lib/memory/*`).
- Produces: `VoiceSession` loads the buyer, passes `buyerNotes` (string[]) into `TurnContext`, and uses `recall.line` in the greeting for returning buyers.

- [ ] **Step 1: Failing test** — returning buyer with notes → greeting contains the recall line; `buildSystem` system prompt includes the memory context block.
- [ ] **Step 2: Run red. Step 3: Implement. Step 4: Run green.**
- [ ] **Step 5: Commit** — `git commit -am "feat(memory): inject buyer recall into greeting + system prompt"`

### Task 3.2: `search_knowledge` degrades gracefully without RediSearch

**Files:**
- Modify: `server/brain/executor.ts`
- Test: `server/brain/executor.rag.test.ts`

**Interfaces:**
- Produces: if `searchKnowledge` throws the "requires Redis Stack" error, the tool returns `{ ok: true, content: "Knowledge base unavailable; answer from general product facts." }` instead of failing the turn.

- [ ] **Step 1: Failing test** — `searchKnowledge` rejects with the RediSearch error → executor returns the graceful content, `ok: true`.
- [ ] **Step 2: Run red. Step 3: Implement (try/catch around the RAG branch). Step 4: Run green.**
- [ ] **Step 5: Commit** — `git commit -am "feat(rag): graceful degrade when RediSearch index absent"`

### Task 3.3: Notes pub/sub → dashboard

**Files:**
- Create: `app/api/notes/stream/route.ts` (SSE bridging Redis pub/sub → browser) OR extend the agent-server WS.
- Modify: P5 dashboard session view to subscribe.
- Test: `lib/memory/pubsub.test.ts` (already exists for publish; add subscribe-callback test).

**Interfaces:**
- Consumes: `createNotesSubscriber(onNote)` (`lib/memory/pubsub.ts`).
- Produces: an SSE endpoint that emits each `NoteAddedEvent`; the dashboard appends live.

- [ ] **Step 1: Failing test** — publishing a note invokes the subscriber callback with the note payload.
- [ ] **Step 2: Run red. Step 3: Implement the SSE route + dashboard subscription. Step 4: Run green.**
- [ ] **Step 5: Commit** — `git commit -am "feat(dashboard): live note stream via Redis pub/sub"`

---

## PHASE 4 — Knowledge corpus seed for Browserbase

### Task 4.1: Seed the Browserbase corpus

**Files:**
- Modify: `scripts/knowledge-seed.ts` (point `SEED_DOCS` at Browserbase facts; company `browserbase`).
- Test: `scripts/knowledge-seed.smoke.ts` (gated; requires Redis Stack + OpenAI key).

**Interfaces:**
- Consumes: `indexDocuments(company, docs)`, `ensureIndex()`.
- Produces: `npm run knowledge:seed` indexes the Browserbase corpus under company `browserbase`.

- [ ] **Step 1:** Replace the placeholder seed docs with real Browserbase product facts (Overview, Pricing, Integrations, Security, ROI) sourced from `product/facts.md` / `product/catalog.ts`.
- [ ] **Step 2:** Run `npm run knowledge:seed`. Expected: ">0 chunks indexed for browserbase".
- [ ] **Step 3:** Spot-check: `searchKnowledge("browserbase", "pricing")` returns a Pricing hit (smoke script).
- [ ] **Step 4: Commit** — `git commit -am "feat(knowledge): seed Browserbase corpus"`

---

## PHASE 5 — Polish & cleanup

### Task 5.1: Remove the dead P3 `/api/agent` brain

**Files:**
- Delete: `app/api/agent/route.ts`, `lib/agent/brain.ts` (superseded by the single brain).
- Keep: `app/api/browser/route.ts` only if `/sandbox` still uses it; otherwise delete.

- [ ] **Step 1:** Confirm no live import of `lib/agent/brain.ts` remains (`grep -rn "lib/agent/brain"`). Expected: only `/api/agent/route.ts`.
- [ ] **Step 2:** Delete the files; run `npx tsc --noEmit`. Expected: no errors.
- [ ] **Step 3: Commit** — `git commit -am "chore: remove superseded P3 /api/agent brain (single brain owns reasoning)"`

### Task 5.2: Full suite + typecheck + build gate

- [ ] **Step 1:** `npx vitest run` — all unit tests green.
- [ ] **Step 2:** `npx tsc --noEmit` — clean.
- [ ] **Step 3:** `npm run build` — succeeds.
- [ ] **Step 4: Commit** — `git commit -am "chore: convergence green — tests, types, build"`

---

## Self-Review

**Spec coverage:** §3 decisions 1–10 each map to a task — single brain (1.4/1.5), membrane-not-tools (1.1), thinking-silence+filler (1.4), streamed say (1.4), opus↔sonnet (1.3/Global Constraints), barge-in spoken-only (2.4), model-driven phase (1.0 set_phase contract + 1.1 tool), Node agent server topology (2.2/2.3), memory+RAG+no-OAuth (3.1/3.2/0.4), DemoConfig (2.1). §5 conflict resolution → 0.3. §6 dashboard → 3.3 (+ set_phase path via 1.0). §7 sequencing → phase order. §9 open config (persona/url) → 2.1 env defaults.

**Placeholder scan:** No "TBD/handle errors/similar-to" left; the two deferred config values are explicit env-defaulted decisions, not placeholders.

**Type consistency:** `Command` is the ONE shared union from `lib/voice/messages.ts` (extended in Task 1.0), imported by `turn.ts` and matched by the `Orchestrator` in `types.ts`. `ToolName`/`ToolResult` shared from 1.1. `ScreenState` (navigate/click return) and `PageContext` (pageContext return) are now distinct per the real `lib/browser/session.ts`. `streamWithTools` signature matches its consumer in `runTurn`; `executor.run(name,input,signal)` matches its caller. `createOrchestrator({sessionId,buyerId,company})` matches its caller in `session.ts`.

## Review Fixes Applied (2026-06-20, post plan-eng-review)

All six blockers + four improvements from the eng review folded in:
- **B1** — `Command` is no longer forked; `turn.ts` imports the shared union; **Task 1.0** extends it with `set_phase` (keeping `click_or_type`/`buyer_loaded`).
- **B2** — `greeting` documented as the optional `greeting?(...): Promise<string>|string` member (Task 1.5).
- **B3** — `BrowserLane`: `navigate`/`clickText` return `ScreenState` (no text); executor now does navigate→`pageContext` two-step (Task 1.2).
- **B4/B5** — `live_view` + `set_phase` added to `ServerEvent`; `session.ts` forwards `set_phase` (Task 1.0).
- **B6** — `git show :2:` extracted before any `git add`, with a header assertion (Task 0.3).
- **Improvements** — `max_tokens` 2048 (1.3); reuse extracted `SentenceChunker` (1.4 + new `server/util/sentenceChunker.ts`); abort signal threaded into the executor with a test (1.2/1.4); barge-in spelled out as a behavior change (2.4); `VoiceAgent` interface delta enumerated (2.5).

---

## GSTACK REVIEW REPORT

| Run | Status | Findings |
|---|---|---|
| plan-eng-review (non-interactive subagent) | complete | 6 blockers, 5 improvements, 3 nice-to-haves |

**VERDICT: NEEDS-REWORK** — the plan's core integration contract (the `Command` union and `Orchestrator.greeting`) contradicts the real P2 code it claims to plug into unchanged. Three asserted interfaces are wrong against `origin/main`. Fixable, but the affected tasks (1.4, 1.5, 2.x) must be re-specified before execution or the brain will not wire to the voice session.

**BLOCKERS** (must-fix; see returned review for full detail):
1. T1.4/T1.5 — `Command` union mismatch: real union is in `lib/voice/messages.ts` with `click_or_type`/`buyer_loaded` and NO `set_phase`/`live_view`. Plan invents a divergent union.
2. T1.5 — `greeting()` is `greeting?(): Promise<string>|string` (optional). Plan declares it non-optional sync; `LoopOrchestrator` must keep the `?` + return type or it does not satisfy `Orchestrator`.
3. T1.2 — `BrowserLane.navigate/clickText` really return `ScreenState {sessionId,url,title}` (no `links`/`text`); `pageToText()` reads `.links`/`.text` → runtime undefined. Only `pageContext()` returns `PageContext`.
4. T2.3/T2.5 — `live_view` server→client event does not exist in `messages.ts` and is never added. Must extend `ServerEvent`.
5. T1.1/T1.4 — `set_phase` / `screen_is_on(page)` carrying a phase: `set_phase` is not in the Command union nor wire contract; dashboard (T3.3) can't receive it.
6. T0.3 — `git show :2:server/index.ts` only valid mid-conflict; ordering + the assumption P1's server is "ours" (side 2) needs guarding.

**UNRESOLVED DECISIONS:**
- Whether to extend the shared `Command`/`ServerEvent` unions (preferred) or keep brain-internal commands and translate at the `LoopOrchestrator`/session boundary. Recommend extending the shared contract once, in a Phase 0/1 task, before any consumer is written.
