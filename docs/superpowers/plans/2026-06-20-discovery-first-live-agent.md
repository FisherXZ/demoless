# Discovery-First Live Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every buyer-facing live demo agent path open discovery-first, honor direct navigation requests, remember durable buyer signals, and avoid fake scoring or certainty.

**Architecture:** Keep this as prompt and deterministic harness behavior, not a new orchestration subsystem. The voice path is controlled by `LoopOrchestrator.greeting()` and `buildSystem()`; the harness path is controlled by `assembleContext()`, the stub in `server/model.ts`, the shared note contract, and the in-browser mock server.

**Tech Stack:** TypeScript, Vitest, Anthropic tool-calling prompts, Zod shared contracts, WebSocket harness fakes.

---

## File Structure

- Modify: `server/session.browser.test.ts` — preserve the existing baseline cleanup that mocks async memory/learnings reads and waits for `ready`.
- Modify: `server/orchestrator/loop.ts` — change voice greetings for new and returning buyers.
- Modify: `server/orchestrator/loop.test.ts` — add default greeting tests.
- Modify: `server/orchestrator/loop.recall.test.ts` — strengthen returning-buyer greeting tests.
- Modify: `server/brain/messages.ts` — append discovery-first, direct-request, remember, and anti-scoring instructions to the voice system prompt.
- Create: `server/brain/messages.test.ts` — unit-test the voice system prompt contract.
- Modify: `server/context.ts` — make the harness prompt discovery-first.
- Modify: `server/context.test.ts` — test harness prompt and greet synthetic user message.
- Modify: `shared/contract.ts` — expand harness note types so memory can represent pain points, buyer facts, preferences, and next steps.
- Modify: `shared/contract.test.ts` — prove the expanded note taxonomy.
- Modify: `components/harness/Harness.tsx` — color the expanded note types.
- Modify: `server/model.ts` — update `coerceReply()` note enum and stub behavior for returning greetings and direct pricing/docs requests.
- Modify: `server/model.test.ts` — unit-test expanded note coercion and stub direct-navigation behavior.
- Modify: `lib/harness/mockServer.ts` — align browserless mock greetings and note inference with discovery-first behavior.
- Create: `lib/harness/mockServer.test.ts` — prove the browserless mock greeting behavior.
- Modify: `lib/demoConfig.ts` — remove stale tour-first exported greeting and align system-prompt source text.
- Create: `lib/demoConfig.test.ts` — prove exported product config copy is discovery-first.
- Modify: `server/orchestrator/stub.ts` — remove stale tour-first legacy orchestrator greeting.
- Create: `server/orchestrator/stub.test.ts` — prove legacy orchestrator greeting is discovery-first.
- Modify: `components/DemoRoom.tsx` — remove stale pre-live ready caption.
- Create: `lib/demoRoom.copy.test.ts` — guard against the stale ready caption.
- Modify: `lib/data.ts` — align static captions with discovery-first language.
- Create: `lib/data.test.ts` — guard static caption copy.

---

### Task 0: Stabilize Existing Baseline Test Leak

**Files:**
- Modify: `server/session.browser.test.ts`

- [x] **Step 1: Reproduce the existing leak**

Run:

```bash
npm run test -- server/model.test.ts server/model.streamtools.test.ts lib/memory/pubsub.test.ts lib/learnings/store.test.ts server/session.browser.test.ts
```

Expected before fix: the assertions pass, but Vitest reports unhandled `TypeError: stt.on is not a function` rejections from `server/session.ts`.

- [x] **Step 2: Mock session startup side effects in the browser ownership test**

Add module mocks for `../lib/memory/store`, `../lib/memory/pubsub`, and `../lib/learnings` in `server/session.browser.test.ts`:

```ts
vi.mock("../lib/memory/store", () => ({
  loadBuyer: vi.fn().mockResolvedValue({
    profile: {
      email: "anonymous",
      firstSeen: 0,
      lastSeen: 0,
      visitCount: 1,
    },
    notes: [],
    isReturning: false,
    recall: { line: "", topInterests: [], painPoints: [], objections: [] },
  }),
}));
vi.mock("../lib/memory/pubsub", () => ({
  publishPhase: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/learnings", () => ({
  getLearnings: vi.fn().mockResolvedValue([]),
  buildLearningsContext: vi.fn().mockReturnValue(""),
  reflectAndStore: vi.fn().mockResolvedValue(undefined),
}));
```

- [x] **Step 3: Replace sleep-based startup waits**

Add:

```ts
async function waitForEvent(ws: ReturnType<typeof makeWs>, eventType: string) {
  for (let i = 0; i < 25; i++) {
    const events = ws.sent.map((s) => JSON.parse(s) as { t: string });
    const event = events.find((e) => e.t === eventType);
    if (event) return event;
    await new Promise((r) => setTimeout(r, 1));
  }
  throw new Error(`Timed out waiting for ${eventType}`);
}
```

Replace both `setTimeout(..., 10)` waits with:

```ts
await waitForEvent(ws, "ready");
```

- [x] **Step 4: Verify the baseline leak is gone**

Run:

```bash
npm run test -- server/model.test.ts server/model.streamtools.test.ts lib/memory/pubsub.test.ts lib/learnings/store.test.ts server/session.browser.test.ts
```

Expected: `5 passed`, no unhandled errors.

---

### Task 1: Voice Greeting And Prompt Contract

**Files:**
- Modify: `server/orchestrator/loop.ts`
- Modify: `server/orchestrator/loop.test.ts`
- Modify: `server/orchestrator/loop.recall.test.ts`
- Modify: `server/brain/messages.ts`
- Create: `server/brain/messages.test.ts`

- [x] **Step 1: Write failing greeting tests**

Add to `server/orchestrator/loop.test.ts`:

```ts
it("default greeting asks one discovery question before offering a walkthrough", () => {
  const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
  const text = orch.greeting("en", "Messi");
  expect(text).toContain("Messi");
  expect(text).toMatch(/what .*trying to figure out/i);
  expect(text).not.toMatch(/walk you through|show you/i);
  expect((text.match(/\?/g) ?? []).length).toBe(1);
});
```

Strengthen `server/orchestrator/loop.recall.test.ts`:

```ts
it("returning-buyer greeting references recall and asks today's goal", () => {
  const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
  const text = orch.greeting("en", "Messi", returningBuyer);
  expect(text).toContain("parallel browser sessions");
  expect(text).toMatch(/today/i);
  expect(text).toMatch(/trying to figure out/i);
  expect(text).not.toMatch(/pick up there|walk you through/i);
});
```

- [x] **Step 2: Write failing voice prompt tests**

Create `server/brain/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildSystem } from "./messages";
import type { DemoConfig } from "../config/demoConfig";

const cfg: DemoConfig = {
  company: "browserbase",
  productName: "Browserbase",
  persona: "Messi",
  browseTargetUrl: "https://www.browserbase.com",
  corpusSeed: "",
};

describe("buildSystem discovery contract", () => {
  it("instructs the live agent to discover before generic walkthroughs", () => {
    const system = buildSystem(cfg, "");
    expect(system).toContain("Discovery-first");
    expect(system).toMatch(/why the buyer is here/i);
    expect(system).toMatch(/workflow or problem/i);
    expect(system).toMatch(/background/i);
    expect(system).toMatch(/one short question at a time/i);
    expect(system).toMatch(/do not ask.*multiple discovery questions/i);
  });

  it("preserves direct navigation requests with a contextual follow-up", () => {
    const system = buildSystem(cfg, "");
    expect(system).toMatch(/directly asks/i);
    expect(system).toMatch(/pricing/i);
    expect(system).toMatch(/docs/i);
    expect(system).toMatch(/short contextual follow-up/i);
  });

  it("requires durable buyer memory and bans fake scoring", () => {
    const system = buildSystem(cfg, "");
    expect(system).toMatch(/remember/i);
    expect(system).toMatch(/pain_point/i);
    expect(system).toMatch(/next_step/i);
    expect(system).toMatch(/do not assign/i);
    expect(system).toMatch(/scores/i);
    expect(system).toMatch(/certainty/i);
  });
});
```

- [x] **Step 3: Run tests to verify RED**

Run:

```bash
npm run test -- server/orchestrator/loop.test.ts server/orchestrator/loop.recall.test.ts server/brain/messages.test.ts
```

Expected: fails because the greeting still offers a walkthrough and `buildSystem()` lacks the discovery contract.

- [x] **Step 4: Implement voice greeting and prompt text**

Update `LoopOrchestrator.greeting()` so new-buyer greetings say:

```ts
const base =
  lang === "zh"
    ? `你好，我是${agentName}。你今天想了解${product}的哪件事？`
    : lang === "es"
      ? `Hola, soy ${agentName}. ¿Qué estás tratando de entender sobre ${product} hoy?`
      : `Hi, I'm ${agentName}. What are you trying to figure out about ${product} today?`;
```

Keep recall for returning buyers, then append the same discovery question:

```ts
if (buyer?.isReturning && buyer.recall.line) {
  return `${buyer.recall.line} ${base}`;
}
```

Update `buildSystem()` with a compact instruction block:

```ts
const discoveryFirst = [
  "Discovery-first behavior:",
  "- Open with discovery, not a generic tour. Before giving a generic walkthrough, learn why the buyer is here, the workflow or problem they care about, and the background they bring.",
  "- Ask one short question at a time. Do not ask a form-like list or multiple discovery questions in a row.",
  "- If the visitor directly asks to see something specific like pricing, docs, sessions, or the playground, honor it with navigate/click/look as appropriate, then add one short contextual follow-up question.",
  "- Save durable buyer facts with remember: use persona for background, pain_point for workflow pain, interest for interests, objection for objections, preference for preferences, and next_step for agreed follow-up.",
  "- Do not assign lead scores, intent scores, confidence labels, or certainty claims. Capture evidence-backed facts only.",
].join("\n");
```

Include `discoveryFirst` in the `return [...]` array before the memory context.

- [x] **Step 5: Verify GREEN**

Run:

```bash
npm run test -- server/orchestrator/loop.test.ts server/orchestrator/loop.recall.test.ts server/brain/messages.test.ts
```

Expected: pass.

---

### Task 2: Harness Prompt And Memory Taxonomy

**Files:**
- Modify: `server/context.ts`
- Modify: `server/context.test.ts`
- Modify: `shared/contract.ts`
- Modify: `shared/contract.test.ts`
- Modify: `components/harness/Harness.tsx`
- Modify: `server/model.ts`
- Modify: `server/model.test.ts`

- [x] **Step 1: Write failing harness prompt tests**

Add to `server/context.test.ts`:

```ts
it("tells the harness agent to run discovery before generic walkthroughs", () => {
  const { system, messages } = assembleContext({ ...base, history: [] }, "greet");
  expect(system).toMatch(/discovery-first/i);
  expect(system).toMatch(/why the buyer is here/i);
  expect(system).toMatch(/workflow or problem/i);
  expect(system).toMatch(/background/i);
  expect(system).toMatch(/one short question at a time/i);
  expect(system).toMatch(/do not assign/i);
  expect(system).toMatch(/scores/i);
  expect(messages.at(-1)?.content).toMatch(/one natural discovery question/i);
  expect(messages.at(-1)?.content).not.toMatch(/HOOK/i);
});
```

- [x] **Step 2: Write failing note taxonomy tests**

Add to `shared/contract.test.ts`:

```ts
it("accepts durable discovery note types", () => {
  for (const type of ["pain_point", "next_step", "persona", "preference"] as const) {
    expect(() => NoteInput.parse({ type, value: `${type} signal` })).not.toThrow();
  }
});
```

Add to `server/model.test.ts`:

```ts
it("preserves durable discovery note types when coercing replies", () => {
  const r = coerceReply({
    commands: [
      { kind: "remember", note: { type: "pain_point", value: "demo prep takes hours" } },
      { kind: "remember", note: { type: "next_step", value: "send security docs" } },
    ],
  });
  expect(r.commands).toEqual([
    { kind: "remember", note: { type: "pain_point", value: "demo prep takes hours" } },
    { kind: "remember", note: { type: "next_step", value: "send security docs" } },
  ]);
});
```

- [x] **Step 3: Run tests to verify RED**

Run:

```bash
npm run test -- server/context.test.ts shared/contract.test.ts server/model.test.ts
```

Expected: fails because the prompt lacks the new contract and the shared/model note enums do not accept the new values.

- [x] **Step 4: Implement harness prompt and taxonomy**

Update `FRAMEWORK` in `server/context.ts` to include:

```ts
Discovery-first rules:
- Greet with one natural discovery question before navigating or selecting a walkthrough.
- Learn why the buyer is here, what workflow or problem they care about, and what background they bring before giving a generic walkthrough.
- Ask one short question at a time; do not dump multiple discovery questions in a row.
- If the buyer directly asks to see a concrete area, honor that request, then ask one short contextual follow-up.
- Capture durable buyer signals as remember commands: persona/background, pain_point/workflow pain, interest, objection, preference, next_step.
- Do not assign lead scores, intent scores, certainty labels, or fake qualification.
```

Update the greet synthetic user message to:

```ts
"[The visitor just opened the demo and hasn't spoken yet. Greet them with one natural discovery question before navigating. If they are a returning buyer with notes, briefly reference a prior factual memory, then ask what they are trying to figure out today.]"
```

Update `shared/contract.ts`:

```ts
export const NoteType = z.enum([
  "objection",
  "interest",
  "role",
  "question",
  "pain_point",
  "next_step",
  "persona",
  "preference",
]);
```

Update `server/model.ts` `VALID_NOTE` with the same values.

Update `components/harness/Harness.tsx` `NOTE_COLOR`:

```ts
pain_point: "bg-warnsoft text-warn",
next_step: "bg-brandsoft text-branddeep",
persona: "bg-brandsoft text-branddeep",
preference: "bg-goodsoft text-good",
```

- [x] **Step 5: Verify GREEN**

Run:

```bash
npm run test -- server/context.test.ts shared/contract.test.ts server/model.test.ts
```

Expected: pass.

---

### Task 3: Deterministic Stub And Browserless Mock Behavior

**Files:**
- Modify: `server/model.ts`
- Modify: `server/model.test.ts`
- Modify: `lib/harness/mockServer.ts`
- Create: `lib/harness/mockServer.test.ts`

- [x] **Step 1: Write failing stub tests**

Add to `server/model.test.ts`:

```ts
describe("complete stub discovery behavior", () => {
  it("returning greeting asks what the buyer is figuring out today", async () => {
    const previous = process.env.USE_STUB;
    process.env.USE_STUB = "1";
    try {
      const r = await complete({
        system: "s",
        messages: [{ role: "user", content: "[The visitor just opened the demo.]" }],
        turn: "greet",
        state: {
          ...state,
          buyer: {
            id: "u",
            notes: [{ type: "interest", value: "pricing", at: "2026-06-20T00:00:00Z" }],
          },
        } as any,
      });
      expect(r.commands[0]).toMatchObject({ kind: "say" });
      expect((r.commands[0] as any).text).toMatch(/pricing/);
      expect((r.commands[0] as any).text).toMatch(/trying to figure out today/i);
      expect((r.commands[0] as any).text).not.toMatch(/pick up there/i);
    } finally {
      if (previous === undefined) delete process.env.USE_STUB;
      else process.env.USE_STUB = previous;
    }
  });

  it("direct pricing request navigates and asks a contextual follow-up", async () => {
    const previous = process.env.USE_STUB;
    process.env.USE_STUB = "1";
    try {
      const r = await complete({
        system: "s",
        messages: [{ role: "user", content: "show pricing" }],
        turn: "human",
        state,
      });
      expect(r.commands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: "navigate", target: "pricing" }),
          expect.objectContaining({ kind: "remember", note: expect.objectContaining({ type: "interest" }) }),
        ])
      );
      const say = r.commands.find((c) => c.kind === "say") as any;
      expect(say.text).toMatch(/pricing/i);
      expect(say.text).toMatch(/\?/);
    } finally {
      if (previous === undefined) delete process.env.USE_STUB;
      else process.env.USE_STUB = previous;
    }
  });
});
```

- [x] **Step 2: Write failing mock server tests**

Create `lib/harness/mockServer.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockServer } from "./mockServer";
import type { ServerMsg } from "@/shared/wire";

describe("mock harness server discovery greetings", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returning greeting references memory and asks today's discovery question", () => {
    vi.useFakeTimers();
    const events: ServerMsg[] = [];
    const server = createMockServer((m) => events.push(m));

    server.handle({ t: "start", buyerId: "alice" });
    vi.advanceTimersByTime(500);
    server.handle({ t: "user_said", text: "pricing matters", final: true });
    vi.advanceTimersByTime(900);
    server.handle({ t: "start", buyerId: "alice" });
    vi.advanceTimersByTime(500);

    const says = events
      .filter((m): m is Extract<ServerMsg, { t: "command" }> => m.t === "command")
      .map((m) => m.cmd)
      .filter((c) => c.kind === "say");
    const returning = says.at(-1)?.text ?? "";
    expect(returning).toMatch(/pricing matters/i);
    expect(returning).toMatch(/trying to figure out today/i);
    expect(returning).not.toMatch(/pick up there/i);
  });
});
```

- [x] **Step 3: Run tests to verify RED**

Run:

```bash
npm run test -- server/model.test.ts lib/harness/mockServer.test.ts
```

Expected: fails because stub and mock returning greetings still say “pick up there,” and direct requests go to `dashboard`.

- [x] **Step 4: Implement stub and mock behavior**

In `server/model.ts`, add a small helper:

```ts
function directTarget(text: string): "pricing" | "docs" | null {
  const lower = text.toLowerCase();
  if (/\b(pricing|price|cost|plans?)\b/.test(lower)) return "pricing";
  if (/\b(docs|documentation|api docs|reference|guide)\b/.test(lower)) return "docs";
  return null;
}
```

Update the stub greet returning text:

```ts
? `Welcome back${b.name ? ", " + b.name : ""}! Last time you were interested in "${b.notes[b.notes.length - 1].value}". What are you trying to figure out today?`
```

Update the human stub branch before the default dashboard behavior:

```ts
const target = directTarget(lastUser);
if (target) {
  const label = target === "docs" ? "docs" : "pricing";
  return {
    commands: [
      { kind: "say", text: `Sure — I'll open ${label}. What are you comparing it against today?` },
      { kind: "navigate", target },
      { kind: "remember", note: { type: "interest", value: lastUser.slice(0, 60) } },
    ],
    tour: "stay",
  };
}
```

In `lib/harness/mockServer.ts`, update returning text to:

```ts
? `Welcome back, ${buyer!.name}! Last time you were interested in ${lastInterest?.value ?? "the product"}. What are you trying to figure out today?`
```

Optionally strengthen `noteFor()` to classify pain and next steps:

```ts
: /(pain|problem|struggle|waste|slow|manual|hours|hard)/.test(t)
  ? "pain_point"
  : /(next|follow up|send|book|schedule|trial)/.test(t)
    ? "next_step"
```

- [x] **Step 5: Verify GREEN**

Run:

```bash
npm run test -- server/model.test.ts lib/harness/mockServer.test.ts
```

Expected: pass.

---

### Task 4: Stale Tour-First Copy Cleanup

**Files:**
- Modify: `lib/demoConfig.ts`
- Create: `lib/demoConfig.test.ts`
- Modify: `server/orchestrator/stub.ts`
- Create: `server/orchestrator/stub.test.ts`
- Modify: `components/DemoRoom.tsx`
- Create: `lib/demoRoom.copy.test.ts`
- Modify: `lib/data.ts`
- Create: `lib/data.test.ts`

- [x] **Step 1: Write failing stale-copy tests**

Create `lib/demoConfig.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GREETING, SYSTEM_PROMPT } from "./demoConfig";

describe("demo config discovery copy", () => {
  it("exports a discovery-first greeting", () => {
    expect(GREETING).toMatch(/what .*trying to figure out/i);
    expect(GREETING).not.toMatch(/show you anything|walk you through/i);
  });

  it("keeps the source system prompt discovery-first", () => {
    expect(SYSTEM_PROMPT).toMatch(/Discovery-first/i);
    expect(SYSTEM_PROMPT).toMatch(/one short question/i);
    expect(SYSTEM_PROMPT).toMatch(/do not assign/i);
    expect(SYSTEM_PROMPT).toMatch(/scores|certainty/i);
  });
});
```

Create `server/orchestrator/stub.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { StubOrchestrator } from "./stub";

describe("StubOrchestrator greeting", () => {
  it("asks a discovery question instead of offering a tour", () => {
    const text = new StubOrchestrator().greeting("en", "Messi");
    expect(text).toMatch(/what .*trying to figure out/i);
    expect(text).not.toMatch(/walk you through|what would you like to see first/i);
  });
});
```

Create `lib/demoRoom.copy.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("DemoRoom pre-live copy", () => {
  it("does not promise a generic walkthrough before discovery", () => {
    const source = readFileSync(join(process.cwd(), "components/DemoRoom.tsx"), "utf8");
    expect(source).not.toContain("ready to walk you through the product");
    expect(source).toContain("ready to learn what you want to figure out");
  });
});
```

Create `lib/data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CAPTIONS } from "./data";

describe("static demo captions", () => {
  it("start with discovery-first copy", () => {
    expect(CAPTIONS[0]).toMatch(/before I show anything/i);
    expect(CAPTIONS[0]).toMatch(/what .*trying to figure out/i);
    expect(CAPTIONS[0]).not.toMatch(/walk you through/i);
  });
});
```

- [x] **Step 2: Run tests to verify RED**

Run:

```bash
npm run test -- lib/demoConfig.test.ts server/orchestrator/stub.test.ts lib/demoRoom.copy.test.ts lib/data.test.ts
```

Expected: fails on stale tour-first copy.

- [x] **Step 3: Implement stale-copy cleanup**

Update `lib/demoConfig.ts`:

```ts
export const GREETING =
  "Hi, I'm Messi. Before I show anything, what are you trying to figure out about Browserbase today?";
```

Append discovery-first bullets to `SYSTEM_PROMPT`, matching `server/brain/messages.ts`.

Update `server/orchestrator/stub.ts` English greeting:

```ts
return `Hi, I'm ${agentName}, your Demoless product specialist. What are you trying to figure out today?`;
```

Update the Spanish greeting to ask what the buyer is trying to understand today.

Update `components/DemoRoom.tsx` ready caption:

```tsx
: `${agentName} is ready to learn what you want to figure out.`
```

Update `lib/data.ts` first static caption:

```ts
"Hey! I'm Messi. Before I show anything, what are you trying to figure out about Browserbase today?",
```

- [x] **Step 4: Verify GREEN**

Run:

```bash
npm run test -- lib/demoConfig.test.ts server/orchestrator/stub.test.ts lib/demoRoom.copy.test.ts lib/data.test.ts
```

Expected: pass.

---

### Task 5: Full Verification And Principal Review

**Files:**
- Review all changed files against base branch.

- [x] **Step 1: Run focused acceptance tests**

Run:

```bash
npm run test -- server/orchestrator/loop.test.ts server/orchestrator/loop.recall.test.ts server/brain/messages.test.ts server/context.test.ts shared/contract.test.ts server/model.test.ts lib/harness/mockServer.test.ts server/session.browser.test.ts
```

Expected: pass.

- [x] **Step 2: Run full test suite**

Run:

```bash
npm run test
```

Expected: `28+ passed`, no unhandled errors. Use unsandboxed execution if local WebSocket binding is blocked by the workspace sandbox.

- [x] **Step 3: Principal review against the base branch**

Use `principal-review` against `feat/agent-memory-learnings`, because `codex/issue-20-discovery-first` was created from that branch. Establish:

```bash
git fetch origin feat/agent-memory-learnings --quiet
MERGE_BASE=$(git merge-base HEAD origin/feat/agent-memory-learnings 2>/dev/null || git merge-base HEAD feat/agent-memory-learnings)
git diff --stat "$MERGE_BASE"...HEAD
git diff --name-status "$MERGE_BASE"...HEAD
git status --short
git ls-files --others --exclude-standard
git diff --name-status "$MERGE_BASE" --
```

Review direct codepaths:

```bash
git diff "$MERGE_BASE"...HEAD -- server/orchestrator/loop.ts server/brain/messages.ts server/context.ts server/model.ts shared/contract.ts lib/harness/mockServer.ts
```

Expected: no blocker findings. If the review finds a true positive, fix it with a failing test first, then rerun focused and full tests.

- [x] **Step 4: Completion audit**

Verify each Issue #20 acceptance criterion has evidence:

```text
Default greeting asks one natural discovery question: server/orchestrator/loop.test.ts
Returning greeting references memory and asks today's goal: server/orchestrator/loop.recall.test.ts, lib/harness/mockServer.test.ts, server/model.test.ts
Prompt learns why/workflow/background before generic walkthrough: server/brain/messages.test.ts, server/context.test.ts
One short question at a time: server/brain/messages.test.ts, server/context.test.ts
Direct pricing/docs exception: server/brain/messages.test.ts, server/model.test.ts
Remember captures facts/pains/interests/objections/next steps: server/brain/messages.test.ts, shared/contract.test.ts, server/model.test.ts
No fake scoring/certainty: server/brain/messages.test.ts, server/context.test.ts
```

Expected: every item has direct test or code evidence.
