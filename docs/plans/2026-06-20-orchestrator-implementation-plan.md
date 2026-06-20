# Demoless Orchestrator (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working orchestrator agent you can chat with by text that runs a real loop + real LLM (`claude-opus-4-8`) + the real `shared/contract.ts`, driving fake voice/browser/memory handlers, and speaking the parallel lane's `shared/wire.ts` WebSocket protocol so the test chat frontend connects to it.

**Architecture:** Two layers with one boundary. **Layer 1 — Agent Runtime** (`server/`): transport, session state, turn scheduler, guards, command dispatch, fake handler ports. **Layer 2 — Model Layer** (`server/model.ts`): a pure function `complete(req) → Reply`. Layer 1 never imports the SDK; Layer 2 knows nothing about sessions or ws. They meet at `complete(system, messages, schema) → Reply`. The five-element demo arc (HOOK → DISCOVERY → WALKTHROUGH → CLOSE) is soft state the LLM advances; the walkthrough is a tagged catalog filtered by discovery, walked via a bookmark with detour/resume.

**Tech Stack:** TypeScript (ESM, run via `tsx`), Node 23, `zod` (contract source of truth), `@anthropic-ai/sdk` (`messages.parse` + `zodOutputFormat`), `ws` (WebSocket server), `vitest` (tests). Next.js frontend is a separate lane.

## Global Constraints

- **Model ID is exactly `claude-opus-4-8`.** Never a date suffix.
- **`zod` is the single source of truth** for the contract; TS types via `z.infer`. Never hand-write a parallel type or a second validator.
- **Layer 1 must never `import` from `@anthropic-ai/sdk`.** Only `server/model.ts` may.
- **The LLM emits `NoteInput` (no `at`); the runtime stamps `at`.** Never ask the model for a timestamp.
- **Only a `human` turn may emit `navigate`/`click_or_type`.** The loop hard-strips them on `greet`/`screen` turns.
- **`shared/wire.ts` and the harness's draft of `shared/contract.ts` are owned by the frontend lane for consumption; the server lane owns the authoritative `shared/contract.ts`.** Do not change `wire.ts` without coordinating.
- **Secrets:** `ANTHROPIC_API_KEY` goes in `.env.local` (gitignored) or `.env` (added to `.gitignore` in Task 1). Never commit a key; never print it.
- **WebSocket port: `8787`** (override via `PORT`). Tell the frontend lane this value.

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `shared/contract.ts` | zod contract: Incoming/Command/Reply/Buyer/Note/NoteInput | exists (authoritative) |
| `shared/wire.ts` | ws envelope ClientMsg/ServerMsg | exists (frontend lane) |
| `server/state.ts` | LoopState, Phase, TurnType types | exists |
| `server/loop.ts` | Layer 1: scheduler, guards, dispatch, observers | exists (extend in Task 8) |
| `server/model.ts` | Layer 2: `complete()` — stub → real | exists (stub; real in Task 7) |
| `server/context.ts` | prompt assembly (memory-context-layer) | exists (extend in Task 8) |
| `server/fakes/voice.ts` | fake P2: log `say` | exists |
| `server/fakes/browser.ts` | fake P3: echo `screen_is_on` | exists |
| `server/fakes/memory.ts` | fake P4: in-process Map | exists |
| `product/catalog.ts` | `DemoStep` + tagged `CATALOG` | **create (Task 1)** |
| `product/facts.md` | product facts blob | **create (Task 1)** |
| `server/index.ts` | ws server: ClientMsg→loop, observers→ServerMsg | **create (Task 6)** |
| `server/smoke.ts` | standalone console driver (no ws) | **create (Task 9)** |
| `vitest.config.ts` | test runner config | **create (Task 1)** |
| `.env.example` | documents required env | **create (Task 1)** |

---

### Task 1: Tooling, product content, and config (unblocks everything)

`server/context.ts` already imports `../product/catalog` and reads `../product/facts.md` — both missing, so nothing runs until this lands. This task installs deps, creates the product content, and wires config.

**Files:**
- Create: `product/catalog.ts`, `product/facts.md`, `vitest.config.ts`, `.env.example`
- Modify: `package.json` (deps + scripts), `tsconfig.json` (paths), `.gitignore`

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/fisher/Documents/GitHub2026/demoless
npm install @anthropic-ai/sdk ws
npm install -D tsx vitest @types/ws
```

- [ ] **Step 2: Add scripts to `package.json`**

Set the `scripts` block to:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "server": "tsx server/index.ts",
  "smoke": "tsx server/smoke.ts",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["server/**/*.test.ts", "shared/**/*.test.ts"], environment: "node" },
});
```

- [ ] **Step 4: Add the `@shared/*` path to `tsconfig.json`**

In `compilerOptions.paths`, add the shared alias alongside the existing `@/*`:

```json
"paths": { "@/*": ["./*"], "@shared/*": ["./shared/*"] }
```

(Server files use relative imports so they run under `tsx` regardless; this alias is for the editor and the Next frontend.)

- [ ] **Step 5: Add `.env` to `.gitignore`**

Append a line `.env` to `.gitignore` (it currently ignores `.env*.local` but not plain `.env`).

- [ ] **Step 6: Create `.env.example`**

```
# Copy to .env.local and fill in. Never commit a real key.
ANTHROPIC_API_KEY=
PORT=8787
# Set USE_STUB=1 to run the orchestrator with the canned model (no API key needed).
USE_STUB=
```

- [ ] **Step 7: Create `product/catalog.ts`**

```typescript
// The tagged demo-step catalog (Q7). Each step is tagged with the pains it
// addresses; DISCOVERY filters this into the walkthrough subset. Placeholder
// product = Demoless demoing itself. Swap for the real target's steps later.

export interface DemoStep {
  id: string;
  addresses: string[]; // pain phrases this step speaks to
  navigate: string; // target the agent navigates to
  say: string; // talking point
}

export const CATALOG: DemoStep[] = [
  {
    id: "automation",
    addresses: ["manual prep", "wasting time", "hours preparing"],
    navigate: "campaigns/new",
    say: "Here's how a demo gets built automatically — no manual prep.",
  },
  {
    id: "personalization",
    addresses: ["generic demos", "one-size-fits-all", "same thing to everyone"],
    navigate: "dashboard",
    say: "Watch how the walkthrough adapts to each prospect's profile.",
  },
  {
    id: "analytics",
    addresses: ["no visibility", "can't measure", "no insight"],
    navigate: "analytics",
    say: "This is where every conversation's signals show up.",
  },
  {
    id: "memory",
    addresses: ["repeat visitors", "context loss", "starting over"],
    navigate: "buyers",
    say: "And it remembers each buyer across visits — here's the buyer view.",
  },
];
```

- [ ] **Step 8: Create `product/facts.md`**

```markdown
# Demoless

Demoless is an AI agent that demos a company's product for them, 24/7. It sits on
the website or in outbound campaigns, runs a real voice/chat conversation with a
prospect, walks them through the live product on screen, answers questions,
handles objections, and remembers each prospect across visits.

## What it does
- Greets a prospect, names their likely pain, and asks 2-3 discovery questions.
- Shows only the parts of the product that match what the prospect cares about.
- Answers product questions out loud while the real product moves on screen.
- Captures signals (objections, interests, role, questions) into buyer memory.
- On a return visit, greets the prospect by what they cared about last time.

## Who it's for
Sales teams who want warm, qualified pipeline with full conversation context
instead of cold form fills — and prospects who want a personalized demo at 11pm
with no waiting on a calendar.
```

- [ ] **Step 9: Verify the runner works and imports resolve**

Run: `npm test`
Expected: vitest runs, reports "No test files found" (exit 0 is fine; the point is the runner is installed).

Run: `npx tsx -e "import('./server/context.ts').then(m => console.log(typeof m.assembleContext))"`
Expected: prints `function` (proves `context.ts` + its `product/*` imports now resolve).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .env.example vitest.config.ts product/
git commit -m "chore: orchestrator tooling, product catalog/facts, vitest config"
```

---

### Task 2: Lock the contract with round-trip tests

**Files:**
- Test: `shared/contract.test.ts`

**Interfaces:**
- Consumes: `Incoming`, `Command`, `Reply`, `Note`, `NoteInput` from `shared/contract.ts`.
- Produces: nothing new — pins the existing schemas.

- [ ] **Step 1: Write the failing tests**

```typescript
// shared/contract.test.ts
import { describe, it, expect } from "vitest";
import { Incoming, Command, Reply, NoteInput, Note } from "./contract";

describe("contract", () => {
  it("accepts a valid user_said Incoming", () => {
    expect(() => Incoming.parse({ kind: "user_said", text: "hi", final: true })).not.toThrow();
  });

  it("rejects an unknown Incoming kind", () => {
    expect(() => Incoming.parse({ kind: "nope", text: "x" })).toThrow();
  });

  it("accepts say + navigate + remember Commands", () => {
    expect(() => Command.parse({ kind: "say", text: "hello" })).not.toThrow();
    expect(() => Command.parse({ kind: "navigate", target: "dashboard" })).not.toThrow();
    expect(() =>
      Command.parse({ kind: "remember", note: { type: "interest", value: "pricing" } })
    ).not.toThrow();
  });

  it("NoteInput has no `at`; Note requires `at`", () => {
    expect(() => NoteInput.parse({ type: "objection", value: "too pricey" })).not.toThrow();
    expect(() => Note.parse({ type: "objection", value: "too pricey" })).toThrow();
    expect(() =>
      Note.parse({ type: "objection", value: "too pricey", at: "2026-06-20T00:00:00Z" })
    ).not.toThrow();
  });

  it("accepts a Reply with commands and a tour directive", () => {
    const ok = Reply.parse({
      commands: [{ kind: "say", text: "hi" }],
      tour: "advance",
    });
    expect(ok.commands).toHaveLength(1);
    expect(() => Reply.parse({ commands: [{ kind: "say", text: "x" }], tour: { jump: 2 } })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it passes (the contract already exists)**

Run: `npx vitest run shared/contract.test.ts`
Expected: PASS (5 tests). If any fail, the contract drifted — fix `shared/contract.ts`, not the test.

- [ ] **Step 3: Commit**

```bash
git add shared/contract.test.ts
git commit -m "test: lock the loop contract shapes"
```

---

### Task 3: Memory fake tests

**Files:**
- Test: `server/fakes/memory.test.ts`

**Interfaces:**
- Consumes: `loadBuyer(id, name?) → Buyer`, `saveNote(id, NoteInput)`, `wipeBuyer(id)` from `server/fakes/memory.ts`.
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/fakes/memory.test.ts
import { describe, it, expect } from "vitest";
import { loadBuyer, saveNote, wipeBuyer } from "./memory";

describe("memory fake", () => {
  it("creates a buyer on first load and reuses it", () => {
    const a = loadBuyer("alice", "Alice");
    expect(a.id).toBe("alice");
    expect(a.notes).toEqual([]);
    const again = loadBuyer("alice");
    expect(again).toBe(a); // same object — persisted in the Map
  });

  it("saveNote stamps `at` and appends", () => {
    wipeBuyer("bob");
    saveNote("bob", { type: "interest", value: "analytics" });
    const b = loadBuyer("bob");
    expect(b.notes).toHaveLength(1);
    expect(b.notes[0].value).toBe("analytics");
    expect(typeof b.notes[0].at).toBe("string"); // stamped by the runtime
  });

  it("wipeBuyer clears stored notes", () => {
    saveNote("carol", { type: "objection", value: "price" });
    wipeBuyer("carol");
    expect(loadBuyer("carol").notes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `npx vitest run server/fakes/memory.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add server/fakes/memory.test.ts
git commit -m "test: memory fake store + at-stamping"
```

---

### Task 4: Loop guard + dispatch tests (the heart of Layer 1)

Tests the narrate-only strip (Q5b), tour-bookmark application (Q7), and that `remember` reaches handlers. The Model Layer is mocked so the loop is tested in isolation.

**Files:**
- Test: `server/loop.test.ts`

**Interfaces:**
- Consumes: `Loop` (constructor `(sessionId, buyerId)`, `.onCommand(cb)`, `.send(Incoming)`, `.start()`, `.getState()`) from `server/loop.ts`; `complete` from `server/model.ts` (mocked).
- Produces: nothing new.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/loop.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Command } from "../shared/contract";

// Mock Layer 2 so we control exactly what the loop receives.
const mockComplete = vi.fn();
vi.mock("./model", () => ({ complete: (...a: unknown[]) => mockComplete(...a) }));

import { Loop } from "./loop";

// The loop serializes turns on an internal promise chain; flush microtasks.
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("Loop", () => {
  beforeEach(() => mockComplete.mockReset());

  it("dispatches say + navigate on a human turn", async () => {
    mockComplete.mockResolvedValue({
      commands: [
        { kind: "say", text: "ok" },
        { kind: "navigate", target: "dashboard" },
      ],
    });
    const loop = new Loop("s1", "u1");
    const got: Command[] = [];
    loop.onCommand((c) => got.push(c));
    loop.send({ kind: "user_said", text: "show me", final: true });
    await flush();
    expect(got.map((c) => c.kind)).toEqual(["say", "navigate"]);
  });

  it("strips navigate/click_or_type on a screen (narrate-only) turn", async () => {
    mockComplete.mockResolvedValue({
      commands: [
        { kind: "say", text: "this page shows X" },
        { kind: "navigate", target: "elsewhere" }, // must be dropped
      ],
    });
    const loop = new Loop("s1", "u1");
    const got: Command[] = [];
    loop.onCommand((c) => got.push(c));
    loop.send({ kind: "screen_is_on", url: "/dashboard", summary: "the dashboard" });
    await flush();
    expect(got.map((c) => c.kind)).toEqual(["say"]); // navigate stripped
  });

  it("ignores non-final user_said", async () => {
    mockComplete.mockResolvedValue({ commands: [{ kind: "say", text: "x" }] });
    const loop = new Loop("s1", "u1");
    const got: Command[] = [];
    loop.onCommand((c) => got.push(c));
    loop.send({ kind: "user_said", text: "partial", final: false });
    await flush();
    expect(got).toHaveLength(0);
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it("applies tour:advance to the bookmark (clamped to selected length)", async () => {
    mockComplete.mockResolvedValue({ commands: [{ kind: "say", text: "next" }], tour: "advance" });
    const loop = new Loop("s1", "u1");
    // seed a selected subset so advance has room
    (loop.getState() as { selected: string[] }).selected = ["a", "b", "c"];
    loop.send({ kind: "user_said", text: "next", final: true });
    await flush();
    expect(loop.getState().tourIndex).toBe(1);
  });

  it("buyer_loaded updates state without a turn", async () => {
    const loop = new Loop("s1", "u1");
    const got: Command[] = [];
    loop.onCommand((c) => got.push(c));
    loop.send({ kind: "buyer_loaded", buyer: { id: "u1", notes: [] } });
    await flush();
    expect(got).toHaveLength(0);
    expect(loop.getState().buyer?.id).toBe("u1");
    expect(mockComplete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `npx vitest run server/loop.test.ts`
Expected: PASS (5 tests). If "strips navigate" fails, check the `turn !== "human"` filter in `server/loop.ts`.

- [ ] **Step 3: Commit**

```bash
git add server/loop.test.ts
git commit -m "test: loop narrate-only guard, tour bookmark, turn triggers"
```

---

### Task 5: Context assembly test

**Files:**
- Test: `server/context.test.ts`

**Interfaces:**
- Consumes: `assembleContext(state, turn) → { system, messages }` from `server/context.ts`.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

```typescript
// server/context.test.ts
import { describe, it, expect } from "vitest";
import { assembleContext } from "./context";
import type { LoopState } from "./state";

const base: LoopState = {
  sessionId: "s",
  buyerId: "u",
  history: [{ role: "user", text: "we waste hours prepping demos" }],
  phase: "DISCOVERY",
  tourIndex: 0,
  selected: [],
};

describe("assembleContext", () => {
  it("includes the demo arc, product facts, the catalog, and current state", () => {
    const { system } = assembleContext(base, "human");
    expect(system).toContain("HOOK");
    expect(system).toContain("Demoless"); // from facts.md
    expect(system).toContain("automation"); // a catalog id
    expect(system).toContain("phase=DISCOVERY");
  });

  it("maps history into messages", () => {
    const { messages } = assembleContext(base, "human");
    expect(messages).toEqual([{ role: "user", content: "we waste hours prepping demos" }]);
  });
});
```

- [ ] **Step 2: Run to verify it passes**

Run: `npx vitest run server/context.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 3: Commit**

```bash
git add server/context.test.ts
git commit -m "test: context assembly includes arc, facts, catalog, state"
```

---

### Task 6: WebSocket server speaking `wire.ts`

The entry the frontend test harness connects to. Translates `ClientMsg` → loop and broadcasts loop activity as `ServerMsg`. One `Loop` per connection.

**Files:**
- Create: `server/index.ts`
- Test: `server/index.test.ts`

**Interfaces:**
- Consumes: `ClientMsg`, `ServerMsg` from `shared/wire.ts`; `Loop` from `server/loop.ts`; `registerVoiceFake`/`registerBrowserFake` from `server/fakes/*`; `registerMemoryFake`, `wipeBuyer` from `server/fakes/memory.ts`.
- Produces: an exported `startServer(port: number) → { close(): Promise<void>; port: number }` so tests can boot it on an ephemeral port.

- [ ] **Step 1: Write `server/index.ts`**

```typescript
// LAYER 1 transport: WebSocket server speaking shared/wire.ts. The frontend
// test harness connects here. One Loop per connection.

import { WebSocketServer, type WebSocket } from "ws";
import { ClientMsg, type ServerMsg } from "../shared/wire";
import { Loop } from "./loop";
import { registerVoiceFake } from "./fakes/voice";
import { registerBrowserFake } from "./fakes/browser";
import { registerMemoryFake, wipeBuyer } from "./fakes/memory";

function snapshot(loop: Loop): ServerMsg {
  const s = loop.getState();
  return {
    t: "turn",
    snapshot: {
      phase: s.phase,
      tourIndex: s.tourIndex,
      currentStep: s.selected[s.tourIndex] ?? null,
      buyer: s.buyer ?? null,
    },
  };
}

function attach(ws: WebSocket) {
  let loop: Loop | null = null;
  let buyerId = "";

  const emit = (m: ServerMsg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
  };

  const wire = (l: Loop) => {
    registerVoiceFake(l);
    registerBrowserFake(l);
    registerMemoryFake(l, buyerId); // fires buyer_loaded
    l.onIncoming((msg) => emit({ t: "incoming", msg }));
    l.onCommand((cmd) => emit({ t: "command", cmd }));
    l.onTurn(() => emit(snapshot(l)));
  };

  ws.on("message", (raw) => {
    let parsed: unknown;
    try {
      parsed = ClientMsg.parse(JSON.parse(raw.toString()));
    } catch (e) {
      emit({ t: "error", message: `bad ClientMsg: ${(e as Error).message}` });
      return;
    }
    const msg = parsed as import("../shared/wire").ClientMsg;

    if (msg.t === "start") {
      buyerId = msg.buyerId;
      loop = new Loop(`sess-${Date.now()}`, buyerId);
      wire(loop);
      loop.start(); // GREET turn
      return;
    }
    if (!loop) {
      emit({ t: "error", message: "send {t:'start'} first" });
      return;
    }
    if (msg.t === "user_said") {
      loop.send({ kind: "user_said", text: msg.text, final: true });
    } else if (msg.t === "reset") {
      if (msg.wipeBuyer) wipeBuyer(buyerId);
      loop.reset();
      registerMemoryFake(loop, buyerId); // re-fire buyer_loaded
      loop.start();
    }
  });
}

export function startServer(port: number) {
  const wss = new WebSocketServer({ port });
  wss.on("connection", attach);
  return {
    port,
    close: () => new Promise<void>((res) => wss.close(() => res())),
  };
}

// Run directly: `npm run server`
if (process.argv[1] && process.argv[1].endsWith("index.ts")) {
  const port = Number(process.env.PORT ?? 8787);
  startServer(port);
  console.log(`[orchestrator] ws://localhost:${port} — send {t:"start",buyerId:"..."}`);
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// server/index.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { startServer } from "./index";
import type { ServerMsg } from "../shared/wire";

let server: { close: () => Promise<void>; port: number } | null = null;
afterEach(async () => { await server?.close(); server = null; });

function collect(port: number, send: object[], untilCommands: number) {
  return new Promise<ServerMsg[]>((resolve, reject) => {
    const msgs: ServerMsg[] = [];
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("open", () => send.forEach((m) => ws.send(JSON.stringify(m))));
    ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString()) as ServerMsg;
      msgs.push(m);
      if (msgs.filter((x) => x.t === "command").length >= untilCommands) {
        ws.close();
        resolve(msgs);
      }
    });
    ws.on("error", reject);
    setTimeout(() => { ws.close(); resolve(msgs); }, 3000);
  });
}

describe("ws server (stub model)", () => {
  it("greets on start and replies to user_said", async () => {
    server = startServer(0 as number); // ephemeral
    // ws 'port 0' picks a random port; read the actual one:
    const port = (server as unknown as { port: number }).port;
    // NOTE: with port 0, read wss.address().port — see Step 3 fix if this is 0.
    const msgs = await collect(port, [
      { t: "start", buyerId: "tester" },
      { t: "user_said", text: "we waste hours prepping", final: true },
    ], 2);
    const says = msgs.filter((m): m is Extract<ServerMsg, { t: "command" }> => m.t === "command")
      .map((m) => m.cmd).filter((c) => c.kind === "say");
    expect(says.length).toBeGreaterThanOrEqual(2); // greet + reply
  });
});
```

- [ ] **Step 3: Fix ephemeral-port reporting in `startServer`**

`WebSocketServer({ port: 0 })` binds a random port; expose it. Update the return in `server/index.ts`:

```typescript
export function startServer(port: number) {
  const wss = new WebSocketServer({ port });
  wss.on("connection", attach);
  return {
    get port() { return (wss.address() as { port: number }).port; },
    close: () => new Promise<void>((res) => wss.close(() => res())),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run server/index.test.ts`
Expected: PASS (1 test) — greet `say` + reply `say` observed over the socket.

- [ ] **Step 5: Commit**

```bash
git add server/index.ts server/index.test.ts
git commit -m "feat: ws server speaking wire.ts; greet + chat round-trip over socket"
```

---

### Task 7: Real Model Layer (`claude-opus-4-8` via `messages.parse`)

Replace the stub body with a real structured-output call, keeping the same `complete(req) → Reply` signature. A `USE_STUB=1` env (or missing API key) falls back to the stub so the frontend works offline.

**Files:**
- Modify: `server/model.ts`
- Test: `server/model.test.ts`

**Interfaces:**
- Consumes: `Reply` from `shared/contract.ts`; `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod`; `CompleteRequest` (already exported from `server/model.ts`).
- Produces: `complete(req) → Promise<Reply>` (unchanged signature); a pure helper `buildParams(req) → object` for testing prompt assembly without a network call.

- [ ] **Step 1: Write the failing test (pure prompt assembly)**

```typescript
// server/model.test.ts
import { describe, it, expect } from "vitest";
import { buildParams } from "./model";
import type { LoopState } from "./state";

const state: LoopState = {
  sessionId: "s", buyerId: "u", history: [], phase: "HOOK", tourIndex: 0, selected: [],
};

describe("buildParams", () => {
  it("targets claude-opus-4-8 at low effort with a cached system block", () => {
    const p = buildParams({
      system: "SYS", messages: [{ role: "user", content: "hi" }], turn: "human", state,
    });
    expect(p.model).toBe("claude-opus-4-8");
    expect(p.output_config.effort).toBe("low");
    expect(Array.isArray(p.system)).toBe(true);
    expect(p.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(p.messages).toEqual([{ role: "user", content: "hi" }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/model.test.ts`
Expected: FAIL — `buildParams` is not exported yet.

- [ ] **Step 3: Replace `server/model.ts` with the real implementation (stub retained as fallback)**

```typescript
// LAYER 2 — Model Layer. Pure function: prompt in, validated Reply out.
// Real call uses claude-opus-4-8 structured outputs; falls back to the stub
// when USE_STUB=1 or no API key (so the frontend works offline).

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { Reply } from "../shared/contract";
import type { LoopState, TurnType } from "./state";

export interface CompleteRequest {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  turn: TurnType;
  state: LoopState;
}

const useStub = () => process.env.USE_STUB === "1" || !process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

/** Pure: the exact params we send. Extracted so it's testable without a network call. */
export function buildParams(req: CompleteRequest) {
  return {
    model: "claude-opus-4-8" as const,
    max_tokens: 1024,
    thinking: { type: "adaptive" as const },
    output_config: { effort: "low" as const, format: zodOutputFormat(Reply) },
    system: [{ type: "text" as const, text: req.system, cache_control: { type: "ephemeral" as const } }],
    messages: req.messages,
  };
}

export async function complete(req: CompleteRequest): Promise<Reply> {
  if (useStub()) return Reply.parse(stub(req));
  const res = await getClient().messages.parse(buildParams(req));
  if (!res.parsed_output) {
    // Refusal / max_tokens / parse miss — degrade gracefully, never crash the loop.
    return { commands: [{ kind: "say", text: "Sorry — give me one second." }] };
  }
  return res.parsed_output;
}

function stub(req: CompleteRequest): Reply {
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (req.turn === "greet") {
    const b = req.state.buyer;
    const text =
      b && b.notes.length > 0
        ? `Welcome back${b.name ? ", " + b.name : ""}! Last time you were curious about "${b.notes[b.notes.length - 1].value}". Want to pick up there?`
        : `Hi — I'm your demo guide. Before I show you anything: what brought you here today?`;
    return { commands: [{ kind: "say", text }] };
  }
  if (req.turn === "screen") {
    return { commands: [{ kind: "say", text: `(stub) Here's ${req.state.screen?.summary ?? "the page"}.` }] };
  }
  return {
    commands: [
      { kind: "say", text: `(stub) You said: "${lastUser}". Let me pull that up.` },
      { kind: "navigate", target: "dashboard" },
      { kind: "remember", note: { type: "interest", value: lastUser.slice(0, 60) } },
    ],
    tour: "stay",
  };
}
```

- [ ] **Step 4: Run to verify the pure test passes**

Run: `npx vitest run server/model.test.ts`
Expected: PASS (1 test). (No network — `buildParams` is pure.)

- [ ] **Step 5: Live smoke (manual, needs a key)**

Put a real key in `.env.local`, then:

Run: `npx tsx --env-file=.env.local -e "import('./server/model.ts').then(async m => console.log(JSON.stringify(await m.complete({system:'You are a demo guide. Reply with one say command greeting the user.',messages:[{role:'user',content:'hello'}],turn:'human',state:{sessionId:'s',buyerId:'u',history:[],phase:'HOOK',tourIndex:0,selected:[]}}))))"`
Expected: prints a JSON `Reply` with at least one `say` command, validated against the schema.

- [ ] **Step 6: Commit**

```bash
git add server/model.ts server/model.test.ts
git commit -m "feat: real claude-opus-4-8 model layer via messages.parse; stub fallback"
```

---

### Task 8: Phase machine, discovery→catalog filtering, and the tour bookmark (the brain)

Make the agent actually follow HOOK → DISCOVERY → WALKTHROUGH → CLOSE, select catalog steps from discovery, and walk them with detour/resume. The LLM drives phase + tour via the structured reply; the loop holds the state.

**Files:**
- Modify: `shared/contract.ts` (extend `Reply` with `phase` + `select`), `server/loop.ts` (apply phase/select), `server/context.ts` (instruct per phase, expose selected subset)
- Test: `server/brain.test.ts`

**Interfaces:**
- Consumes: `Reply` (extended), `CATALOG` from `product/catalog.ts`, `LoopState`.
- Produces: extended `Reply` shape `{ commands, tour?, phase?, select? }` where `phase?: Phase` (next phase) and `select?: string[]` (catalog ids chosen at end of DISCOVERY). `applySelection(state, ids)` on the loop.

- [ ] **Step 1: Extend `Reply` in `shared/contract.ts`**

Add `phase` and `select` to the existing `Reply` (after `tour`):

```typescript
export const Reply = z.object({
  commands: z.array(Command),
  tour: z
    .union([z.literal("advance"), z.literal("stay"), z.literal("resume"), z.object({ jump: z.number() })])
    .optional(),
  phase: z.enum(["HOOK", "DISCOVERY", "WALKTHROUGH", "CLOSE", "DONE"]).optional(), // next phase
  select: z.array(z.string()).optional(), // catalog ids chosen from discovery
});
```

- [ ] **Step 2: Write the failing tests**

```typescript
// server/brain.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const mockComplete = vi.fn();
vi.mock("./model", () => ({ complete: (...a: unknown[]) => mockComplete(...a) }));
import { Loop } from "./loop";
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("brain: phase + selection", () => {
  beforeEach(() => mockComplete.mockReset());

  it("advances phase when the reply sets one", async () => {
    mockComplete.mockResolvedValue({ commands: [{ kind: "say", text: "q?" }], phase: "DISCOVERY" });
    const loop = new Loop("s", "u");
    loop.send({ kind: "user_said", text: "hi", final: true });
    await flush();
    expect(loop.getState().phase).toBe("DISCOVERY");
  });

  it("applies select to the bookmark subset", async () => {
    mockComplete.mockResolvedValue({
      commands: [{ kind: "say", text: "let me show you" }],
      phase: "WALKTHROUGH",
      select: ["automation", "analytics"],
    });
    const loop = new Loop("s", "u");
    loop.send({ kind: "user_said", text: "we waste time and can't measure", final: true });
    await flush();
    expect(loop.getState().selected).toEqual(["automation", "analytics"]);
    expect(loop.getState().tourIndex).toBe(0);
  });

  it("ignores select ids not in the catalog", async () => {
    mockComplete.mockResolvedValue({ commands: [], select: ["automation", "bogus"] });
    const loop = new Loop("s", "u");
    loop.send({ kind: "user_said", text: "x", final: true });
    await flush();
    expect(loop.getState().selected).toEqual(["automation"]); // bogus dropped
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run server/brain.test.ts`
Expected: FAIL — loop ignores `phase`/`select` today.

- [ ] **Step 4: Apply phase + selection in `server/loop.ts`**

In `runTurn`, after `this.applyTour(reply.tour);`, add:

```typescript
    if (reply.phase) this.state.phase = reply.phase;
    if (reply.select) {
      const valid = new Set(CATALOG.map((s) => s.id));
      const picked = reply.select.filter((id) => valid.has(id));
      this.state.selected = picked;
      this.state.tourIndex = 0;
    }
```

And add the import at the top of `server/loop.ts`:

```typescript
import { CATALOG } from "../product/catalog";
```

- [ ] **Step 5: Run to verify the brain tests pass**

Run: `npx vitest run server/brain.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Teach the prompt to drive phase/select in `server/context.ts`**

Replace the `FRAMEWORK` constant and append per-phase guidance. Update `FRAMEWORK`:

```typescript
const FRAMEWORK = `Demo arc — advance through these phases by setting "phase" in your reply:
1. HOOK — name the prospect's likely pain in one line; don't pitch the company. Then move to DISCOVERY.
2. DISCOVERY — ask 2-3 short questions to learn what they care about. When you understand their pain, set phase="WALKTHROUGH" and set "select" to the catalog ids that match what they said (skip the rest).
3. WALKTHROUGH — walk the selected steps in order. Set tour="advance" when moving to the next step. If the prospect asks something off-script, answer it and set tour="stay" (keep your place); when they're satisfied, set tour="resume" and navigate back to the bookmarked step.
4. CLOSE — propose one concrete next step.
On a page-load turn, describe what's on screen; do NOT navigate. Capture objections/interests/role/questions as "remember" commands as they arise.`;
```

And in `assembleContext`, change the `# Current state` line to also surface the selected steps and the bookmarked step:

```typescript
    `# Current state\nturn=${turn} phase=${state.phase} tourIndex=${state.tourIndex} ` +
      `selected=[${state.selected.join(", ")}] ` +
      `currentStep=${state.selected[state.tourIndex] ?? "none"} ` +
      `screen=${state.screen?.summary ?? "none"} ` +
      `buyerNotes=${state.buyer?.notes.map((n) => n.value).join("; ") ?? "none"}`,
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS — all tests across contract, memory, loop, context, brain, model, index.

- [ ] **Step 8: Commit**

```bash
git add shared/contract.ts server/loop.ts server/context.ts server/brain.test.ts
git commit -m "feat: phase machine + discovery-driven catalog selection + tour bookmark"
```

---

### Task 9: End-to-end smoke (welcome-back across two sessions)

A standalone console driver that proves the whole loop without the frontend: greet → discovery → memory capture → second session greets by what was remembered.

**Files:**
- Create: `server/smoke.ts`
- Test: `server/smoke.test.ts`

**Interfaces:**
- Consumes: `Loop`, the three `register*Fake` functions, `loadBuyer` from `server/fakes/memory.ts`.
- Produces: `runSmoke(buyerId) → Promise<void>` (logs a scripted exchange).

- [ ] **Step 1: Write `server/smoke.ts`**

```typescript
// Standalone driver — no ws, no frontend. Run: `npm run smoke` (USE_STUB=1 for
// no API key). Proves greet → chat → memory capture → welcome-back.

import { Loop } from "./loop";
import { registerVoiceFake } from "./fakes/voice";
import { registerBrowserFake } from "./fakes/browser";
import { registerMemoryFake, loadBuyer } from "./fakes/memory";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function session(buyerId: string, lines: string[]) {
  const loop = new Loop(`sess-${buyerId}-${lines.length}`, buyerId);
  registerVoiceFake(loop);
  registerBrowserFake(loop);
  registerMemoryFake(loop, buyerId);
  loop.start(); // greet
  await sleep(50);
  for (const line of lines) {
    console.log(`\n  🧑 USER: ${line}`);
    loop.send({ kind: "user_said", text: line, final: true });
    await sleep(50);
  }
}

export async function runSmoke(buyerId = "smoke-user") {
  console.log("=== Session 1 (new visitor) ===");
  await session(buyerId, ["we waste hours prepping demos and can't measure results"]);
  console.log("\n  📝 stored notes:", loadBuyer(buyerId).notes.map((n) => `${n.type}:${n.value}`));
  console.log("\n=== Session 2 (returning) ===");
  await session(buyerId, []); // greet only — should welcome back
}

if (process.argv[1] && process.argv[1].endsWith("smoke.ts")) {
  runSmoke().then(() => process.exit(0));
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// server/smoke.test.ts
import { describe, it, expect } from "vitest";
import { runSmoke } from "./smoke";
import { loadBuyer, wipeBuyer } from "./fakes/memory";

describe("e2e smoke (stub model)", () => {
  it("captures a note in session 1 that memory retains for session 2", async () => {
    process.env.USE_STUB = "1";
    wipeBuyer("e2e");
    await runSmoke("e2e");
    expect(loadBuyer("e2e").notes.length).toBeGreaterThan(0); // remember fired
  });
});
```

- [ ] **Step 3: Run to verify it passes**

Run: `npx vitest run server/smoke.test.ts`
Expected: PASS (1 test) — note captured and retained across sessions.

- [ ] **Step 4: Manual run for the demo**

Run: `USE_STUB=1 npm run smoke`
Expected: console shows session 1 greet + reply + stored notes, then session 2 greeting that references the remembered interest.

- [ ] **Step 5: Commit**

```bash
git add server/smoke.ts server/smoke.test.ts
git commit -m "test: e2e smoke — welcome-back across two sessions"
```

---

## Integration handoff (to the frontend lane)

- The orchestrator listens on `ws://localhost:8787` (override `PORT`).
- Protocol is exactly `shared/wire.ts`: client sends `{t:"start",buyerId}` first, then `{t:"user_said",text,final:true}` and `{t:"reset",wipeBuyer}`; server emits `{t:"incoming"|"command"|"turn"|"error"}`.
- Render: `command` with `cmd.kind==="say"` → agent chat bubble; `incoming` with `kind==="user_said"` → user bubble; `turn.snapshot` → phase/bookmark/buyer panel; `incoming` with `kind==="screen_is_on"` → a "screen" indicator.
- Set `USE_STUB=1` to run without an API key.

## Self-Review

- **Spec coverage (Q1–Q10):** Q1 standalone server (Task 6) · Q2 ws JSON contract (Tasks 1,6, `wire.ts`) · Q3 zod source of truth (Task 2) · Q4 structured outputs + opus-4-8 low effort (Task 7) · Q5 trigger model + narrate-only strip (Task 4) · Q6 greet at open (Tasks 6,9) · Q7 scripted tour + bookmark + discovery filter (Task 8) · Q8 fake Map memory (Task 3) · Q9 fold remember + stamp `at` (Tasks 3,7) · Q10 product files (Task 1). All covered.
- **Placeholder scan:** none — every code step has complete code.
- **Type consistency:** `complete(req)→Reply`, `buildParams(req)`, `Loop.{send,start,reset,onCommand,onIncoming,onTurn,getState}`, `loadBuyer/saveNote/wipeBuyer`, extended `Reply{commands,tour?,phase?,select?}` — consistent across tasks.
- **Known risk to watch:** `messages.parse` + `zodOutputFormat` with our discriminated-union `Reply` — if structured outputs rejects the union shape, fall back to `output_config.format` with a flattened schema or tool-use; verified at Task 7 Step 5 (live smoke). The `wire.ts` `Command.remember` now carries `NoteInput` (no `at`) — confirm with the frontend lane on git merge.
```
