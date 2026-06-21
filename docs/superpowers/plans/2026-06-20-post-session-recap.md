# Post-Session Recap Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a demo ends, persist the session (transcript + event trace + Browserbase replay link) and run a one-shot LLM analysis that produces an evidence-backed recap report for the salesperson, surfaced on the existing dashboard.

**Architecture:** New self-contained `lib/sessions/` module (mirrors `lib/learnings/`): a pure `SessionRecorder` accumulates timestamped trace events during the live call; at `VoiceSession.dispose()` we build a `SessionRecord`, persist it to Redis, and fire-and-forget an analysis that calls Claude once, then **verifies every insight's evidence against the trace in our own code** (dropping anything ungrounded) before storing a `RecapReport`. The Next app reads the same Redis server-side to render the recap, falling back to the existing mock data when Redis is empty.

**Tech Stack:** TypeScript, Node (standalone `server/` WS gateway), Next.js 15 App Router, ioredis (Redis Stack), `@anthropic-ai/sdk`, Vitest.

## Global Constraints

- Redis namespace prefix is `demoless:` for every key.
- Reuse the shared client `getRedis()` from `lib/memory/redis.ts`; do NOT create new ioredis clients.
- LLM calls use an injectable `ChatFn = (system: string, user: string) => Promise<string>` (mockable in tests); the default impl uses `new Anthropic()` with model `process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8"`. No SDK calls in unit tests.
- All session-teardown work (persist + analyze) is fire-and-forget, wrapped in try/catch, and MUST NOT throw out of `dispose()`.
- `lib/` must not import from `server/`; define local turn types in `lib/sessions` (mirrors `ReflectTurn` in `lib/learnings/reflect.ts`).
- Evidence integrity is enforced in our code (`ground.ts`), never by trusting the model. An insight with zero verified evidence is dropped before storage.
- Label enum is exactly `"hot" | "follow_up_needed" | "nurture"`.
- Tests run with `npx vitest run <file>`; smoke scripts run with `tsx` and need a live Redis (`REDIS_URL`, default `redis://localhost:6379`).

---

## File Structure

- `lib/sessions/types.ts` — all shared types (`TraceEvent`, `TranscriptTurn`, `SessionRecord`, `Evidence`, `RecapReport`, `RecapLabel`, `RecapStatus`).
- `lib/sessions/keys.ts` — Redis key builders + `NS`.
- `lib/sessions/recorder.ts` — `SessionRecorder` (pure, no Redis).
- `lib/sessions/ground.ts` — evidence verification gate (pure).
- `lib/sessions/analyze.ts` — prompt build + `ChatFn` + lenient parse + `analyzeSession` + `analyzeAndStore`.
- `lib/sessions/store.ts` — Redis persistence (`saveSession`/`loadSession`/`saveRecap`/`loadRecap`/`listSessions`).
- `lib/sessions/index.ts` — public surface.
- `lib/sessions/*.test.ts` — unit tests (recorder, ground, analyze, store).
- `scripts/sessions-smoke.ts` — end-to-end smoke (fake `ChatFn`, real Redis).
- `server/session.ts` — MODIFY: own a `SessionRecorder`, record at existing seams, persist+analyze in `dispose()`; extend `VoiceSessionDeps`.
- `server/session.analysis.test.ts` — `dispose()` triggers persistence/analysis once.
- `lib/dashboard/source.ts` — server-side data access: real recap → view model, mock fallback.
- `app/dashboard/sessions/[id]/page.tsx` — MODIFY: render real recap when present.
- `package.json` — MODIFY: add `sessions:smoke` script.

---

### Task 1: Types and Redis keys

**Files:**
- Create: `lib/sessions/types.ts`
- Create: `lib/sessions/keys.ts`
- Test: `lib/sessions/keys.test.ts`

**Interfaces:**
- Produces: all types listed below; `NS = "demoless"`; `sessionKey(id)`, `recapKey(id)`, `SESSIONS_INDEX`, `replayUrl(id)`.

- [ ] **Step 1: Write the types file**

Create `lib/sessions/types.ts`:

```ts
// Shared types for the post-session recap feature. Kept free of any server/
// imports (lib must not depend on server); the transcript turn shape is local.

export type RecapLabel = "hot" | "follow_up_needed" | "nurture";
export type RecapStatus = "pending" | "ready";

/** An ordered, timestamped record of what happened during a live demo. */
export type TraceEvent =
  | { kind: "user_said"; text: string; ts: number; turn: number }
  | { kind: "agent_said"; text: string; ts: number; turn: number }
  | { kind: "page_visited"; url: string; ts: number; turn: number }
  | { kind: "agent_action"; action: "navigate" | "click"; detail: string; ts: number; turn: number }
  | { kind: "phase"; phase: string; ts: number }
  | { kind: "remember"; note: string; noteType?: string; ts: number };

/** A spoken turn, derived from user_said/agent_said events (display + grounding). */
export interface TranscriptTurn {
  role: "user" | "agent";
  text: string;
  turn: number;
  ts: number;
}

/** Everything persisted about one finished session — the source of truth. */
export interface SessionRecord {
  id: string;          // Browserbase session id
  company: string;
  role?: string;       // visitor's self-reported role
  startedAt: number;
  endedAt: number;
  phaseReached?: string;
  replayUrl?: string;
  events: TraceEvent[];
  transcript: TranscriptTurn[];
}

/** Proof attached to every shown insight. */
export type Evidence =
  | { kind: "quote"; speaker: "user" | "agent"; text: string; turn: number; ts: number }
  | { kind: "action"; label: string; ts: number };

export interface InsightItem { text: string; evidence: Evidence[] }
export interface ObjectionItem { text: string; kind: "objection" | "question"; evidence: Evidence[] }

/** The salesperson-facing recap. Every insight here is evidence-verified. */
export interface RecapReport {
  sessionId: string;
  generatedAt: number;
  label: RecapLabel;
  labelEvidence: Evidence[];
  summary: string;                                   // paraphrase, exempt from per-line citation
  whyTheyCame: { text: string; evidence: Evidence[] };
  buyingSignals: InsightItem[];
  objectionsQuestions: ObjectionItem[];
  gaps: InsightItem[];
  nextAction: { text: string; evidence: Evidence[] };
  draftEmail: { subject: string; body: string };     // references only grounded insights
}
```

- [ ] **Step 2: Write the failing keys test**

Create `lib/sessions/keys.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { NS, sessionKey, recapKey, SESSIONS_INDEX, replayUrl } from "./keys";

describe("sessions keys", () => {
  it("namespaces session and recap keys by id", () => {
    expect(NS).toBe("demoless");
    expect(sessionKey("s1")).toBe("demoless:session:s1");
    expect(recapKey("s1")).toBe("demoless:session:s1:recap");
    expect(SESSIONS_INDEX).toBe("demoless:sessions");
  });
  it("builds a browserbase replay url", () => {
    expect(replayUrl("s1")).toBe("https://www.browserbase.com/sessions/s1");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/sessions/keys.test.ts`
Expected: FAIL — cannot find module `./keys`.

- [ ] **Step 4: Write the keys implementation**

Create `lib/sessions/keys.ts`:

```ts
// Redis key builders for the per-session recap layer. Keyed by session id
// (Browserbase session id), namespaced under `demoless:` like the other layers.
export const NS = "demoless";

/** Hash holding the SessionRecord (metadata + events + transcript as JSON). */
export function sessionKey(id: string): string {
  return `${NS}:session:${id}`;
}

/** Hash holding the RecapReport + status for one session. */
export function recapKey(id: string): string {
  return `${NS}:session:${id}:recap`;
}

/** Sorted set indexing sessions by endedAt (member = id) for the dashboard list. */
export const SESSIONS_INDEX = `${NS}:sessions`;

/** Browserbase dashboard replay link (auth-gated; internal salesperson use). */
export function replayUrl(id: string): string {
  return `https://www.browserbase.com/sessions/${id}`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/sessions/keys.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/sessions/types.ts lib/sessions/keys.ts lib/sessions/keys.test.ts
git commit -m "feat(sessions): recap types and redis key builders"
```

---

### Task 2: SessionRecorder

**Files:**
- Create: `lib/sessions/recorder.ts`
- Test: `lib/sessions/recorder.test.ts`

**Interfaces:**
- Consumes: `TraceEvent`, `TranscriptTurn`, `SessionRecord` from `./types`.
- Produces: `class SessionRecorder` with methods `recordUser(text, turn, ts?)`, `recordAgent(text, turn, ts?)`, `recordPage(url, turn, ts?)`, `recordAction(action, detail, turn, ts?)`, `recordPhase(phase, ts?)`, `recordRemember(note, noteType?, ts?)`, `events(): TraceEvent[]`, `transcript(): TranscriptTurn[]`, `build(args: { id: string; company: string; role?: string; phaseReached?: string; replayUrl?: string; endedAt?: number }): SessionRecord`. Constructor: `new SessionRecorder(startedAt?: number)`.

- [ ] **Step 1: Write the failing test**

Create `lib/sessions/recorder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SessionRecorder } from "./recorder";

describe("SessionRecorder", () => {
  it("derives an ordered transcript from say/user events and excludes non-speech", () => {
    const r = new SessionRecorder(1000);
    r.recordUser("hi there", 1, 1100);
    r.recordPage("https://x/pricing", 1, 1150);
    r.recordAgent("here is pricing", 1, 1200);
    r.recordAction("click", "Pricing", 1, 1250);
    r.recordPhase("WALKTHROUGH", 1300);

    const t = r.transcript();
    expect(t.map((x) => x.role)).toEqual(["user", "agent"]);
    expect(t[0]).toMatchObject({ role: "user", text: "hi there", turn: 1, ts: 1100 });
    expect(t[1]).toMatchObject({ role: "agent", text: "here is pricing", turn: 1, ts: 1200 });
  });

  it("keeps page/action/phase events in the trace", () => {
    const r = new SessionRecorder(1000);
    r.recordPage("https://x/pricing", 2, 1150);
    r.recordAction("navigate", "https://x/pricing", 2, 1160);
    expect(r.events().map((e) => e.kind)).toEqual(["page_visited", "agent_action"]);
  });

  it("builds a SessionRecord with metadata and derived transcript", () => {
    const r = new SessionRecorder(1000);
    r.recordUser("we want to buy", 1, 1100);
    const rec = r.build({ id: "s1", company: "Acme", role: "Engineer", phaseReached: "CLOSE", replayUrl: "u", endedAt: 2000 });
    expect(rec).toMatchObject({ id: "s1", company: "Acme", role: "Engineer", startedAt: 1000, endedAt: 2000, phaseReached: "CLOSE", replayUrl: "u" });
    expect(rec.transcript).toHaveLength(1);
    expect(rec.events).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/sessions/recorder.test.ts`
Expected: FAIL — cannot find module `./recorder`.

- [ ] **Step 3: Write the implementation**

Create `lib/sessions/recorder.ts`:

```ts
// Pure, in-memory accumulator of trace events for one live session. No Redis,
// no network — VoiceSession feeds it events; build() snapshots a SessionRecord.
import type { TraceEvent, TranscriptTurn, SessionRecord } from "./types";

export class SessionRecorder {
  private _events: TraceEvent[] = [];
  constructor(private startedAt: number = Date.now()) {}

  recordUser(text: string, turn: number, ts: number = Date.now()) {
    this._events.push({ kind: "user_said", text, turn, ts });
  }
  recordAgent(text: string, turn: number, ts: number = Date.now()) {
    this._events.push({ kind: "agent_said", text, turn, ts });
  }
  recordPage(url: string, turn: number, ts: number = Date.now()) {
    this._events.push({ kind: "page_visited", url, turn, ts });
  }
  recordAction(action: "navigate" | "click", detail: string, turn: number, ts: number = Date.now()) {
    this._events.push({ kind: "agent_action", action, detail, turn, ts });
  }
  recordPhase(phase: string, ts: number = Date.now()) {
    this._events.push({ kind: "phase", phase, ts });
  }
  recordRemember(note: string, noteType?: string, ts: number = Date.now()) {
    this._events.push({ kind: "remember", note, noteType, ts });
  }

  events(): TraceEvent[] {
    return [...this._events];
  }

  /** Transcript = the user_said/agent_said events, in order. */
  transcript(): TranscriptTurn[] {
    return this._events
      .filter((e): e is Extract<TraceEvent, { kind: "user_said" | "agent_said" }> =>
        e.kind === "user_said" || e.kind === "agent_said")
      .map((e) => ({
        role: e.kind === "user_said" ? "user" : "agent",
        text: e.text,
        turn: e.turn,
        ts: e.ts,
      }));
  }

  build(args: {
    id: string;
    company: string;
    role?: string;
    phaseReached?: string;
    replayUrl?: string;
    endedAt?: number;
  }): SessionRecord {
    return {
      id: args.id,
      company: args.company,
      role: args.role,
      startedAt: this.startedAt,
      endedAt: args.endedAt ?? Date.now(),
      phaseReached: args.phaseReached,
      replayUrl: args.replayUrl,
      events: this.events(),
      transcript: this.transcript(),
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/sessions/recorder.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/sessions/recorder.ts lib/sessions/recorder.test.ts
git commit -m "feat(sessions): SessionRecorder accumulates trace + derives transcript"
```

---

### Task 3: Evidence grounding gate (the integrity core)

**Files:**
- Create: `lib/sessions/ground.ts`
- Test: `lib/sessions/ground.test.ts`

**Interfaces:**
- Consumes: `Evidence`, `SessionRecord`, `RecapReport`, `RecapLabel` from `./types`.
- Produces: `verifyEvidence(ev: Evidence, record: SessionRecord): Evidence | null`; `groundEvidenceList(list: Evidence[], record: SessionRecord): Evidence[]`; `groundInsights(report: RecapReport, record: SessionRecord): RecapReport`.

- [ ] **Step 1: Write the failing test**

Create `lib/sessions/ground.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { verifyEvidence, groundInsights } from "./ground";
import type { RecapReport, SessionRecord } from "./types";

const record: SessionRecord = {
  id: "s1",
  company: "Acme",
  startedAt: 0,
  endedAt: 10,
  events: [
    { kind: "user_said", text: "How much does the Pro plan cost?", turn: 1, ts: 1 },
    { kind: "agent_said", text: "Pro is $99 per seat.", turn: 1, ts: 2 },
    { kind: "page_visited", url: "https://acme.com/pricing", turn: 1, ts: 3 },
  ],
  transcript: [
    { role: "user", text: "How much does the Pro plan cost?", turn: 1, ts: 1 },
    { role: "agent", text: "Pro is $99 per seat.", turn: 1, ts: 2 },
  ],
};

describe("verifyEvidence", () => {
  it("accepts a quote that is a (normalized) substring of the claimed speaker's turn", () => {
    const ev = verifyEvidence(
      { kind: "quote", speaker: "user", text: "how much does the   PRO plan cost", turn: 0, ts: 0 },
      record
    );
    expect(ev).not.toBeNull();
    expect(ev).toMatchObject({ kind: "quote", speaker: "user", turn: 1, ts: 1 });
  });

  it("rejects a fabricated quote that appears nowhere", () => {
    expect(
      verifyEvidence({ kind: "quote", speaker: "user", text: "we have a $2M budget", turn: 0, ts: 0 }, record)
    ).toBeNull();
  });

  it("accepts an action that matches a recorded page visit", () => {
    expect(
      verifyEvidence({ kind: "action", label: "pricing", ts: 0 }, record)
    ).not.toBeNull();
  });

  it("rejects an action with no matching trace event", () => {
    expect(verifyEvidence({ kind: "action", label: "checkout", ts: 0 }, record)).toBeNull();
  });
});

function baseReport(over: Partial<RecapReport>): RecapReport {
  return {
    sessionId: "s1",
    generatedAt: 0,
    label: "hot",
    labelEvidence: [],
    summary: "s",
    whyTheyCame: { text: "evaluating pricing", evidence: [] },
    buyingSignals: [],
    objectionsQuestions: [],
    gaps: [],
    nextAction: { text: "send pricing", evidence: [] },
    draftEmail: { subject: "x", body: "y" },
    ...over,
  };
}

describe("groundInsights", () => {
  it("drops insights whose evidence cannot be verified", () => {
    const out = groundInsights(
      baseReport({
        buyingSignals: [
          { text: "asked about pricing", evidence: [{ kind: "quote", speaker: "user", text: "how much does the Pro plan cost", turn: 0, ts: 0 }] },
          { text: "fabricated", evidence: [{ kind: "quote", speaker: "user", text: "nope never said", turn: 0, ts: 0 }] },
        ],
      }),
      record
    );
    expect(out.buyingSignals).toHaveLength(1);
    expect(out.buyingSignals[0].text).toBe("asked about pricing");
  });

  it("downgrades label to nurture when no buying signal survives grounding", () => {
    const out = groundInsights(
      baseReport({
        label: "hot",
        labelEvidence: [{ kind: "quote", speaker: "user", text: "ungrounded", turn: 0, ts: 0 }],
        buyingSignals: [{ text: "x", evidence: [{ kind: "quote", speaker: "user", text: "ungrounded", turn: 0, ts: 0 }] }],
      }),
      record
    );
    expect(out.label).toBe("nurture");
    expect(out.labelEvidence).toHaveLength(0);
  });

  it("keeps a verified hot label with grounded evidence", () => {
    const ev = { kind: "quote", speaker: "user", text: "how much does the Pro plan cost", turn: 0, ts: 0 } as const;
    const out = groundInsights(
      baseReport({ label: "hot", labelEvidence: [ev], buyingSignals: [{ text: "pricing", evidence: [ev] }] }),
      record
    );
    expect(out.label).toBe("hot");
    expect(out.labelEvidence.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/sessions/ground.test.ts`
Expected: FAIL — cannot find module `./ground`.

- [ ] **Step 3: Write the implementation**

Create `lib/sessions/ground.ts`:

```ts
// The integrity gate: every insight must be backed by evidence we can verify
// against the recorded trace. Quotes must appear (whitespace/case-normalized) in
// a transcript turn; actions must match a recorded page visit / agent action.
// Anything unverifiable is dropped here, before storage — never trust the model.
import type {
  Evidence,
  RecapReport,
  RecapLabel,
  SessionRecord,
} from "./types";

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Returns a corrected Evidence (with real turn/ts/speaker) or null if unverifiable. */
export function verifyEvidence(ev: Evidence, record: SessionRecord): Evidence | null {
  if (ev.kind === "quote") {
    const want = normalize(ev.text);
    if (!want) return null;
    const bySpeaker = record.transcript.find(
      (t) => t.role === ev.speaker && normalize(t.text).includes(want)
    );
    const anyTurn = bySpeaker ?? record.transcript.find((t) => normalize(t.text).includes(want));
    if (!anyTurn) return null;
    return { kind: "quote", speaker: anyTurn.role, text: ev.text.trim(), turn: anyTurn.turn, ts: anyTurn.ts };
  }
  // action evidence: match label against a recorded page_visited url or agent_action detail.
  const want = normalize(ev.label);
  if (!want) return null;
  const hit = record.events.find(
    (e) =>
      (e.kind === "page_visited" && normalize(e.url).includes(want)) ||
      (e.kind === "agent_action" && normalize(e.detail).includes(want))
  );
  if (!hit) return null;
  return { kind: "action", label: ev.label.trim(), ts: hit.ts };
}

export function groundEvidenceList(list: Evidence[], record: SessionRecord): Evidence[] {
  return (list ?? [])
    .map((e) => verifyEvidence(e, record))
    .filter((e): e is Evidence => e !== null);
}

function groundItem<T extends { evidence: Evidence[] }>(item: T, record: SessionRecord): T | null {
  const evidence = groundEvidenceList(item.evidence, record);
  return evidence.length ? { ...item, evidence } : null;
}

/** Ground every insight; drop the ungrounded; recompute the label from survivors. */
export function groundInsights(report: RecapReport, record: SessionRecord): RecapReport {
  const buyingSignals = (report.buyingSignals ?? [])
    .map((s) => groundItem(s, record))
    .filter((s): s is RecapReport["buyingSignals"][number] => s !== null);
  const objectionsQuestions = (report.objectionsQuestions ?? [])
    .map((o) => groundItem(o, record))
    .filter((o): o is RecapReport["objectionsQuestions"][number] => o !== null);
  const gaps = (report.gaps ?? [])
    .map((g) => groundItem(g, record))
    .filter((g): g is RecapReport["gaps"][number] => g !== null);

  const whyEv = groundEvidenceList(report.whyTheyCame?.evidence ?? [], record);
  const nextEv = groundEvidenceList(report.nextAction?.evidence ?? [], record);
  let labelEvidence = groundEvidenceList(report.labelEvidence ?? [], record);

  // A hot / follow_up_needed label requires a surviving buying signal AND grounded
  // label evidence; otherwise it's nurture.
  let label: RecapLabel = report.label;
  if (label !== "nurture" && (buyingSignals.length === 0 || labelEvidence.length === 0)) {
    label = "nurture";
    labelEvidence = [];
  }

  return {
    ...report,
    label,
    labelEvidence,
    whyTheyCame: { text: report.whyTheyCame?.text ?? "", evidence: whyEv },
    buyingSignals,
    objectionsQuestions,
    gaps,
    nextAction: { text: report.nextAction?.text ?? "", evidence: nextEv },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/sessions/ground.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/sessions/ground.ts lib/sessions/ground.test.ts
git commit -m "feat(sessions): evidence grounding gate drops ungrounded insights"
```

---

### Task 4: Analysis (prompt + parse + analyzeSession)

**Files:**
- Create: `lib/sessions/analyze.ts`
- Test: `lib/sessions/analyze.test.ts`

**Interfaces:**
- Consumes: `SessionRecord`, `RecapReport` from `./types`; `groundInsights` from `./ground`; `saveRecap` from `./store` (Task 5 — for `analyzeAndStore`; tests here only cover `analyzeSession`/`parseRecap`).
- Produces: `type ChatFn = (system: string, user: string) => Promise<string>`; `parseRecap(raw: string, sessionId: string, now: number): RecapReport | null`; `analyzeSession(record: SessionRecord, chat?: ChatFn, now?: number): Promise<RecapReport | null>`; `analyzeAndStore(record: SessionRecord, chat?: ChatFn): Promise<void>`.

> **Note:** `analyzeAndStore` imports `saveRecap` from `./store`, built in Task 5. Implement the import now; the `analyzeAndStore` path is exercised by the smoke script (Task 6) and `store` round-trip (Task 5), not by this task's unit test.

- [ ] **Step 1: Write the failing test**

Create `lib/sessions/analyze.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { analyzeSession } from "./analyze";
import type { SessionRecord } from "./types";

const record: SessionRecord = {
  id: "s1",
  company: "Acme",
  startedAt: 0,
  endedAt: 10,
  events: [
    { kind: "user_said", text: "How much does the Pro plan cost?", turn: 1, ts: 1 },
    { kind: "agent_said", text: "Pro is $99 per seat.", turn: 1, ts: 2 },
  ],
  transcript: [
    { role: "user", text: "How much does the Pro plan cost?", turn: 1, ts: 1 },
    { role: "agent", text: "Pro is $99 per seat.", turn: 1, ts: 2 },
  ],
};

// A model reply with one grounded signal and one hallucinated one.
const reply = JSON.stringify({
  label: "follow_up_needed",
  labelEvidence: [{ kind: "quote", speaker: "user", text: "How much does the Pro plan cost" }],
  summary: "Buyer asked about pricing.",
  whyTheyCame: { text: "evaluating cost", evidence: [{ kind: "quote", speaker: "user", text: "How much does the Pro plan cost" }] },
  buyingSignals: [
    { text: "asked about Pro pricing", evidence: [{ kind: "quote", speaker: "user", text: "How much does the Pro plan cost" }] },
    { text: "said they have budget approved", evidence: [{ kind: "quote", speaker: "user", text: "we have budget approved" }] },
  ],
  objectionsQuestions: [],
  gaps: [],
  nextAction: { text: "send pricing one-pager", evidence: [{ kind: "quote", speaker: "agent", text: "Pro is $99 per seat" }] },
  draftEmail: { subject: "Pricing", body: "Hi, here's the pricing..." },
});

describe("analyzeSession", () => {
  it("parses the model reply and drops the hallucinated buying signal", async () => {
    const chat = vi.fn(async () => reply);
    const out = await analyzeSession(record, chat, 123);
    expect(out).not.toBeNull();
    expect(out!.sessionId).toBe("s1");
    expect(out!.generatedAt).toBe(123);
    expect(out!.label).toBe("follow_up_needed");
    expect(out!.buyingSignals).toHaveLength(1); // hallucinated one dropped by grounding
    expect(out!.buyingSignals[0].text).toBe("asked about Pro pricing");
  });

  it("tolerates prose wrapped around the JSON object", async () => {
    const chat = vi.fn(async () => "Here is the recap:\n" + reply + "\nDone.");
    const out = await analyzeSession(record, chat, 1);
    expect(out).not.toBeNull();
    expect(out!.label).toBe("follow_up_needed");
  });

  it("returns null when there are no user turns (nothing to analyze)", async () => {
    const chat = vi.fn(async () => reply);
    const empty: SessionRecord = { ...record, events: [], transcript: [] };
    const out = await analyzeSession(empty, chat, 1);
    expect(out).toBeNull();
    expect(chat).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/sessions/analyze.test.ts`
Expected: FAIL — cannot find module `./analyze`.

- [ ] **Step 3: Write the implementation**

Create `lib/sessions/analyze.ts`:

```ts
// Post-session analysis: one non-streaming Claude call turns a SessionRecord into
// a RecapReport, then groundInsights() verifies every cited quote/action against
// the trace and drops anything unverifiable. Fire-and-forget from session teardown.
import Anthropic from "@anthropic-ai/sdk";
import { groundInsights } from "./ground";
import { saveRecap } from "./store";
import type { Evidence, RecapLabel, RecapReport, SessionRecord } from "./types";

export type ChatFn = (system: string, user: string) => Promise<string>;

const SYSTEM = `You analyze a finished sales-demo conversation and produce a recap for the salesperson.
Return ONLY a JSON object with this exact shape:
{
  "label": "hot" | "follow_up_needed" | "nurture",
  "labelEvidence": Evidence[],
  "summary": string,
  "whyTheyCame": { "text": string, "evidence": Evidence[] },
  "buyingSignals": { "text": string, "evidence": Evidence[] }[],
  "objectionsQuestions": { "text": string, "kind": "objection" | "question", "evidence": Evidence[] }[],
  "gaps": { "text": string, "evidence": Evidence[] }[],
  "nextAction": { "text": string, "evidence": Evidence[] },
  "draftEmail": { "subject": string, "body": string }
}
An Evidence is either {"kind":"quote","speaker":"user"|"agent","text":<a VERBATIM substring of that speaker's line>} or {"kind":"action","label":<a page URL or clicked label that was actually visited>}.
HARD RULES:
- Every item in whyTheyCame, buyingSignals, objectionsQuestions, gaps, and nextAction MUST include at least one evidence entry copied EXACTLY from the transcript or a recorded action. If you cannot ground a claim, OMIT it. Never invent quotes.
- Classify "label": "hot" for explicit purchase intent or asking how/where to buy; "follow_up_needed" for explicit pricing questions, asking for a concrete next step, or asking to involve their team; otherwise "nurture". Back a hot/follow_up_needed label with the exact buyer quote in labelEvidence.
- summary and draftEmail are prose and need no evidence, but must only reference grounded facts.`;

/** Format the trace into a numbered transcript with inline page/action markers. */
function buildUserPrompt(record: SessionRecord): string {
  const lines: string[] = [];
  for (const e of record.events) {
    if (e.kind === "user_said") lines.push(`[turn ${e.turn}][USER] ${e.text}`);
    else if (e.kind === "agent_said") lines.push(`[turn ${e.turn}][AGENT] ${e.text}`);
    else if (e.kind === "page_visited") lines.push(`[turn ${e.turn}][PAGE] ${e.url}`);
    else if (e.kind === "agent_action") lines.push(`[turn ${e.turn}][ACTION ${e.action}] ${e.detail}`);
  }
  return `Company: ${record.company}\nVisitor role: ${record.role ?? "unknown"}\nPhase reached: ${record.phaseReached ?? "unknown"}\n\nTranscript and actions:\n${lines.join("\n")}`;
}

/** Lenient parse: pull the first {...} object out of the model output and coerce. */
export function parseRecap(raw: string, sessionId: string, now: number): RecapReport | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  let obj: any;
  try {
    obj = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const evList = (v: any): Evidence[] => (Array.isArray(v) ? v.filter((e) => e && (e.kind === "quote" || e.kind === "action")) : []);
  const labels: RecapLabel[] = ["hot", "follow_up_needed", "nurture"];
  return {
    sessionId,
    generatedAt: now,
    label: labels.includes(obj.label) ? obj.label : "nurture",
    labelEvidence: evList(obj.labelEvidence),
    summary: typeof obj.summary === "string" ? obj.summary : "",
    whyTheyCame: { text: String(obj.whyTheyCame?.text ?? ""), evidence: evList(obj.whyTheyCame?.evidence) },
    buyingSignals: Array.isArray(obj.buyingSignals)
      ? obj.buyingSignals.filter((s: any) => s?.text).map((s: any) => ({ text: String(s.text), evidence: evList(s.evidence) }))
      : [],
    objectionsQuestions: Array.isArray(obj.objectionsQuestions)
      ? obj.objectionsQuestions.filter((o: any) => o?.text).map((o: any) => ({
          text: String(o.text),
          kind: o.kind === "objection" ? "objection" : "question",
          evidence: evList(o.evidence),
        }))
      : [],
    gaps: Array.isArray(obj.gaps)
      ? obj.gaps.filter((g: any) => g?.text).map((g: any) => ({ text: String(g.text), evidence: evList(g.evidence) }))
      : [],
    nextAction: { text: String(obj.nextAction?.text ?? ""), evidence: evList(obj.nextAction?.evidence) },
    draftEmail: {
      subject: String(obj.draftEmail?.subject ?? ""),
      body: String(obj.draftEmail?.body ?? ""),
    },
  };
}

const defaultChat: ChatFn = async (system, user) => {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
  const res = await client.messages.create({
    model,
    max_tokens: 3000,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
};

/** Analyze a session into a grounded RecapReport. null if nothing to analyze / parse fails. */
export async function analyzeSession(
  record: SessionRecord,
  chat: ChatFn = defaultChat,
  now: number = Date.now()
): Promise<RecapReport | null> {
  if (!record.transcript.some((t) => t.role === "user")) return null;
  const raw = await chat(SYSTEM, buildUserPrompt(record));
  const parsed = parseRecap(raw, record.id, now);
  if (!parsed) return null;
  return groundInsights(parsed, record);
}

/** Fire-and-forget entry from teardown: analyze, then persist. Never throws. */
export async function analyzeAndStore(record: SessionRecord, chat: ChatFn = defaultChat): Promise<void> {
  try {
    const recap = await analyzeSession(record, chat);
    if (!recap) return;
    await saveRecap(record.id, recap);
    console.log(`[sessions] stored recap for ${record.id} (label=${recap.label})`);
  } catch (err) {
    console.error("[sessions] analyzeAndStore failed:", err);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/sessions/analyze.test.ts`
Expected: PASS (3 tests). (Imports `./store`, created next — if running before Task 5, this file won't typecheck; create Task 5's `store.ts` first or run after Task 5. The unit test itself only calls `analyzeSession`.)

- [ ] **Step 5: Commit**

```bash
git add lib/sessions/analyze.ts lib/sessions/analyze.test.ts
git commit -m "feat(sessions): LLM analysis with lenient parse + grounding"
```

---

### Task 5: Redis store + public surface

**Files:**
- Create: `lib/sessions/store.ts`
- Create: `lib/sessions/index.ts`
- Test: `lib/sessions/store.test.ts`

**Interfaces:**
- Consumes: `getRedis` from `../memory/redis`; keys from `./keys`; types from `./types`.
- Produces: `saveSession(record: SessionRecord): Promise<void>`; `loadSession(id: string): Promise<SessionRecord | null>`; `saveRecap(id: string, recap: RecapReport): Promise<void>`; `loadRecap(id: string): Promise<{ status: RecapStatus; recap: RecapReport | null }>`; `listSessions(limit?: number): Promise<SessionSummary[]>` where `SessionSummary = { id: string; company: string; endedAt: number; label?: RecapLabel; summary?: string }`.

- [ ] **Step 1: Write the failing test (mocked Redis)**

Create `lib/sessions/store.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory fake of the bits of ioredis we use (hset/hgetall/zadd/zrevrange).
const hashes = new Map<string, Record<string, string>>();
const zsets = new Map<string, { member: string; score: number }[]>();
const fake = {
  hset: vi.fn(async (key: string, obj: Record<string, string>) => {
    hashes.set(key, { ...(hashes.get(key) ?? {}), ...obj });
  }),
  hgetall: vi.fn(async (key: string) => hashes.get(key) ?? {}),
  zadd: vi.fn(async (key: string, score: number, member: string) => {
    const arr = zsets.get(key) ?? [];
    const next = arr.filter((e) => e.member !== member);
    next.push({ member, score });
    zsets.set(key, next);
  }),
  zrevrange: vi.fn(async (key: string, start: number, stop: number) => {
    const arr = [...(zsets.get(key) ?? [])].sort((a, b) => b.score - a.score);
    return arr.slice(start, stop + 1).map((e) => e.member);
  }),
};
vi.mock("../memory/redis", () => ({ getRedis: () => fake }));

import { saveSession, loadSession, saveRecap, loadRecap, listSessions } from "./store";
import type { RecapReport, SessionRecord } from "./types";

const record: SessionRecord = {
  id: "s1", company: "Acme", role: "Engineer", startedAt: 1, endedAt: 2,
  phaseReached: "CLOSE", replayUrl: "u",
  events: [{ kind: "user_said", text: "hi", turn: 1, ts: 1 }],
  transcript: [{ role: "user", text: "hi", turn: 1, ts: 1 }],
};
const recap: RecapReport = {
  sessionId: "s1", generatedAt: 9, label: "hot", labelEvidence: [],
  summary: "good call", whyTheyCame: { text: "", evidence: [] },
  buyingSignals: [], objectionsQuestions: [], gaps: [],
  nextAction: { text: "", evidence: [] }, draftEmail: { subject: "", body: "" },
};

beforeEach(() => { hashes.clear(); zsets.clear(); });

describe("sessions store", () => {
  it("round-trips a SessionRecord and indexes it", async () => {
    await saveSession(record);
    const got = await loadSession("s1");
    expect(got).toEqual(record);
    expect(await listSessions()).toEqual([{ id: "s1", company: "Acme", endedAt: 2, label: undefined, summary: undefined }]);
  });

  it("round-trips a RecapReport and reports ready status", async () => {
    await saveRecap("s1", recap);
    const got = await loadRecap("s1");
    expect(got.status).toBe("ready");
    expect(got.recap).toEqual(recap);
  });

  it("returns pending status when no recap exists", async () => {
    const got = await loadRecap("missing");
    expect(got).toEqual({ status: "pending", recap: null });
  });

  it("merges recap label/summary into the index after analysis", async () => {
    await saveSession(record);
    await saveRecap("s1", recap);
    const list = await listSessions();
    expect(list[0]).toMatchObject({ id: "s1", label: "hot", summary: "good call" });
  });

  it("returns null for an unknown session", async () => {
    expect(await loadSession("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/sessions/store.test.ts`
Expected: FAIL — cannot find module `./store`.

- [ ] **Step 3: Write the store implementation**

Create `lib/sessions/store.ts`:

```ts
// Redis persistence for sessions + recaps. Record/recap stored as JSON-string
// fields in a hash; a sorted set (score=endedAt) indexes sessions for the
// dashboard list. Reuses the shared command client from lib/memory.
import { getRedis } from "../memory/redis";
import { sessionKey, recapKey, SESSIONS_INDEX } from "./keys";
import type { RecapLabel, RecapReport, RecapStatus, SessionRecord } from "./types";

export interface SessionSummary {
  id: string;
  company: string;
  endedAt: number;
  label?: RecapLabel;
  summary?: string;
}

export async function saveSession(record: SessionRecord): Promise<void> {
  const redis = getRedis();
  await redis.hset(sessionKey(record.id), {
    id: record.id,
    company: record.company,
    endedAt: String(record.endedAt),
    record: JSON.stringify(record),
  });
  await redis.zadd(SESSIONS_INDEX, record.endedAt, record.id);
}

export async function loadSession(id: string): Promise<SessionRecord | null> {
  const h = await getRedis().hgetall(sessionKey(id));
  if (!h || !h.record) return null;
  try {
    return JSON.parse(h.record) as SessionRecord;
  } catch {
    return null;
  }
}

export async function saveRecap(id: string, recap: RecapReport): Promise<void> {
  const redis = getRedis();
  await redis.hset(recapKey(id), {
    status: "ready",
    recap: JSON.stringify(recap),
    label: recap.label,
    summary: recap.summary,
    generatedAt: String(recap.generatedAt),
  });
  // Denormalize label/summary onto the index hash so the list view needs one read.
  await redis.hset(sessionKey(id), { label: recap.label, summary: recap.summary });
}

export async function loadRecap(id: string): Promise<{ status: RecapStatus; recap: RecapReport | null }> {
  const h = await getRedis().hgetall(recapKey(id));
  if (!h || !h.recap) return { status: "pending", recap: null };
  try {
    return { status: "ready", recap: JSON.parse(h.recap) as RecapReport };
  } catch {
    return { status: "pending", recap: null };
  }
}

export async function listSessions(limit = 50): Promise<SessionSummary[]> {
  const redis = getRedis();
  const ids = await redis.zrevrange(SESSIONS_INDEX, 0, limit - 1);
  const out: SessionSummary[] = [];
  for (const id of ids) {
    const h = await redis.hgetall(sessionKey(id));
    if (!h || !h.id) continue;
    out.push({
      id: h.id,
      company: h.company ?? "",
      endedAt: Number(h.endedAt ?? 0),
      label: (h.label as RecapLabel) || undefined,
      summary: h.summary || undefined,
    });
  }
  return out;
}
```

- [ ] **Step 4: Write the public surface**

Create `lib/sessions/index.ts`:

```ts
// Public surface of the post-session recap layer.
export { SessionRecorder } from "./recorder";
export { verifyEvidence, groundEvidenceList, groundInsights } from "./ground";
export { analyzeSession, analyzeAndStore, parseRecap, type ChatFn } from "./analyze";
export {
  saveSession,
  loadSession,
  saveRecap,
  loadRecap,
  listSessions,
  type SessionSummary,
} from "./store";
export { NS, sessionKey, recapKey, SESSIONS_INDEX, replayUrl } from "./keys";
export type {
  TraceEvent,
  TranscriptTurn,
  SessionRecord,
  Evidence,
  InsightItem,
  ObjectionItem,
  RecapReport,
  RecapLabel,
  RecapStatus,
} from "./types";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/sessions/store.test.ts lib/sessions/analyze.test.ts`
Expected: PASS (store: 5 tests; analyze: 3 tests, now that `./store` resolves).

- [ ] **Step 6: Commit**

```bash
git add lib/sessions/store.ts lib/sessions/index.ts lib/sessions/store.test.ts
git commit -m "feat(sessions): Redis store, session index, and module surface"
```

---

### Task 6: End-to-end smoke script

**Files:**
- Create: `scripts/sessions-smoke.ts`
- Modify: `package.json` (add `sessions:smoke` script)

**Interfaces:**
- Consumes: `SessionRecorder`, `analyzeAndStore`, `loadRecap`, `loadSession`, `listSessions`, `saveSession`, `sessionKey`, `recapKey` from `../lib/sessions`; `getRedis`, `closeRedis` from `../lib/memory`.

- [ ] **Step 1: Write the smoke script**

Create `scripts/sessions-smoke.ts`:

```ts
/**
 * Standalone smoke test for the post-session recap layer.
 *
 *   docker run -p 6379:6379 redis:7      # or set REDIS_URL
 *   npm run sessions:smoke
 *
 * Exercises: record -> persist -> analyze (fake model) -> grounding drops a
 * hallucinated insight -> recap round-trip -> dashboard index. No API key needed.
 */
import {
  SessionRecorder,
  analyzeAndStore,
  saveSession,
  loadSession,
  loadRecap,
  listSessions,
  sessionKey,
  recapKey,
} from "../lib/sessions";
import { getRedis, closeRedis } from "../lib/memory";

const ID = `smoke-${Date.now()}`;
let passed = 0;
let failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? "  ✓" : "  ✗"} ${label}`);
  ok ? passed++ : failed++;
}

const fakeChat = async () =>
  JSON.stringify({
    label: "follow_up_needed",
    labelEvidence: [{ kind: "quote", speaker: "user", text: "what does it cost" }],
    summary: "Buyer asked about pricing and integrations.",
    whyTheyCame: { text: "evaluating cost", evidence: [{ kind: "quote", speaker: "user", text: "what does it cost" }] },
    buyingSignals: [
      { text: "asked about pricing", evidence: [{ kind: "quote", speaker: "user", text: "what does it cost" }] },
      { text: "claimed budget (hallucinated)", evidence: [{ kind: "quote", speaker: "user", text: "we have a huge budget" }] },
    ],
    objectionsQuestions: [],
    gaps: [],
    nextAction: { text: "send pricing", evidence: [{ kind: "quote", speaker: "user", text: "what does it cost" }] },
    draftEmail: { subject: "Pricing", body: "Hi..." },
  });

async function main() {
  const r = new SessionRecorder(Date.now());
  r.recordUser("what does it cost", 1);
  r.recordPage("https://acme.com/pricing", 1);
  r.recordAgent("It's $99 per seat.", 1);
  const record = r.build({ id: ID, company: "Acme", role: "Engineer", phaseReached: "WALKTHROUGH" });

  await saveSession(record);
  check("session persisted", (await loadSession(ID))?.id === ID);

  await analyzeAndStore(record, fakeChat);
  const { status, recap } = await loadRecap(ID);
  check("recap ready", status === "ready" && !!recap);
  check("grounding dropped the hallucinated signal", recap!.buyingSignals.length === 1);
  check("label is follow_up_needed", recap!.label === "follow_up_needed");

  const list = await listSessions();
  check("session appears in dashboard index with label", list.some((s) => s.id === ID && s.label === "follow_up_needed"));

  await getRedis().del(sessionKey(ID), recapKey(ID));
  await getRedis().zrem("demoless:sessions", ID);
  await closeRedis();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add to `"scripts"` after the `"learnings:smoke"` line:

```json
    "sessions:smoke": "tsx scripts/sessions-smoke.ts",
```

- [ ] **Step 3: Run the smoke script (needs Redis)**

Run: `docker run -d -p 6379:6379 redis/redis-stack:latest` (if not already running), then `npm run sessions:smoke`
Expected: `5 passed, 0 failed`.

- [ ] **Step 4: Commit**

```bash
git add scripts/sessions-smoke.ts package.json
git commit -m "test(sessions): end-to-end smoke script + npm script"
```

---

### Task 7: Wire capture + persistence into VoiceSession

**Files:**
- Modify: `server/session.ts`
- Test: `server/session.analysis.test.ts`

**Interfaces:**
- Consumes: `SessionRecorder`, `analyzeAndStore`, `saveSession`, `replayUrl`, type `SessionRecord` from `../lib/sessions`.
- Produces: extends `VoiceSessionDeps` with `saveSession: (record: SessionRecord) => Promise<void>` and `analyzeAndStore: (record: SessionRecord) => Promise<void>`.

- [ ] **Step 1: Write the failing test**

Create `server/session.analysis.test.ts` (mirrors `server/session.learnings.test.ts`):

```ts
import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";

vi.mock("./deepgram/stt", () => ({
  DeepgramStt: vi.fn().mockImplementation(() => ({
    on: vi.fn(), start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined), sendAudio: vi.fn(),
  })),
}));
vi.mock("./tts", () => ({
  createTts: vi.fn().mockReturnValue({
    synthesize: vi.fn().mockReturnValue((async function* () {})()),
    voiceName: vi.fn().mockReturnValue("Messi"),
  }),
}));
vi.mock("./bargeIn", () => ({
  readBargeConfig: vi.fn().mockReturnValue({ mode: "off" }),
  novelWordCount: vi.fn().mockReturnValue(0),
  tokenize: vi.fn().mockReturnValue([]),
}));

import { VoiceSession } from "./session";

function fakeWs() {
  const ws = new EventEmitter() as any;
  ws.OPEN = 1; ws.readyState = 1; ws.send = vi.fn();
  return ws;
}

describe("VoiceSession analysis", () => {
  it("persists and analyzes the session once on socket close", () => {
    const ws = fakeWs();
    const saveSession = vi.fn(async () => {});
    const analyzeAndStore = vi.fn(async () => {});
    new VoiceSession(ws, "dg-key", {
      startSession: vi.fn(),
      stopSession: vi.fn(async () => {}),
      createOrchestrator: vi.fn(),
      reflectAndStore: vi.fn(async () => {}),
      saveSession,
      analyzeAndStore,
    });
    ws.emit("close");
    expect(saveSession).toHaveBeenCalledTimes(1);
    expect(analyzeAndStore).toHaveBeenCalledTimes(1);
    // both receive the same SessionRecord shape
    expect(saveSession.mock.calls[0][0]).toHaveProperty("transcript");
    expect(analyzeAndStore.mock.calls[0][0]).toHaveProperty("events");
  });

  it("does not persist twice when error then close both fire", () => {
    const ws = fakeWs();
    const saveSession = vi.fn(async () => {});
    const analyzeAndStore = vi.fn(async () => {});
    new VoiceSession(ws, "dg-key", {
      startSession: vi.fn(), stopSession: vi.fn(async () => {}),
      createOrchestrator: vi.fn(), reflectAndStore: vi.fn(async () => {}),
      saveSession, analyzeAndStore,
    });
    ws.emit("error", new Error("boom"));
    ws.emit("close");
    expect(saveSession).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/session.analysis.test.ts`
Expected: FAIL — `saveSession`/`analyzeAndStore` not part of deps / not called.

- [ ] **Step 3: Add imports and extend deps**

In `server/session.ts`, after the learnings import block (around line 34), add:

```ts
import {
  SessionRecorder,
  saveSession as defaultSaveSession,
  analyzeAndStore as defaultAnalyzeAndStore,
  replayUrl,
  type SessionRecord,
} from "../lib/sessions";
```

In `VoiceSessionDeps` (after `reflectAndStore`), add:

```ts
  saveSession: (record: SessionRecord) => Promise<void>;
  analyzeAndStore: (record: SessionRecord) => Promise<void>;
```

In the constructor's `this.deps = { ... }` block (after `reflectAndStore: ...`), add:

```ts
      saveSession: deps?.saveSession ?? defaultSaveSession,
      analyzeAndStore: deps?.analyzeAndStore ?? defaultAnalyzeAndStore,
```

- [ ] **Step 4: Add the recorder field and capture hooks**

In `server/session.ts`, add a field near `private history` (around line 81):

```ts
  private recorder = new SessionRecorder();
```

In `runTurn`, right after `this.history.push({ role: "user", text: userText });` (line 465), add:

```ts
    this.recorder.recordUser(userText, turn);
```

In `runTurn`, inside `if (spoken.length > 0) { ... }` (after the existing `this.history.push({ role: "agent", ... })`, line 487), add:

```ts
      this.recorder.recordAgent(spoken.join(" "), turn);
```

In `orchestratorSay`'s command switch, add capture in the relevant cases. Replace the `screen_is_on`, `remember`, and `set_phase` cases with:

```ts
        case "screen_is_on":
          this.recorder.recordPage(cmd.page, this.turnCounter);
          this.send({ t: "screen_is_on", page: cmd.page });
          break;
        case "remember":
          this.recorder.recordRemember(cmd.note, cmd.noteType);
          this.send({ t: "remember", note: cmd.note, noteType: cmd.noteType });
          break;
        case "buyer_loaded":
          this.buyerNotes = cmd.notes ?? this.buyerNotes;
          this.send({ t: "buyer_loaded", buyerId: cmd.buyerId, notes: cmd.notes });
          break;
        case "set_phase":
          this.lastPhase = cmd.phase;
          this.recorder.recordPhase(cmd.phase);
          this.send({ t: "set_phase", phase: cmd.phase });
          void publishPhase("anonymous", cmd.phase);
          break;
```

> **Note:** the greeting path (`speakTurn`) pushes to `history` but is not a user-driven turn; we intentionally do NOT record the greeting as an `agent_said` trace event (it carries no buyer evidence). Capture stays limited to `runTurn` + `orchestratorSay`.

- [ ] **Step 5: Persist + analyze in dispose()**

In `dispose()` (after the existing `reflectAndStore` call, before `this.cancelActive()`), add:

```ts
    // Persist the full session + kick off the evidence-backed recap analysis.
    // Fire-and-forget; both impls swallow their own errors and never block teardown.
    if (this.browserSessionId) {
      const record = this.recorder.build({
        id: this.browserSessionId,
        company: this.company,
        role: this.role,
        phaseReached: this.lastPhase,
        replayUrl: replayUrl(this.browserSessionId),
      });
      void this.deps.saveSession(record).catch(() => {});
      void this.deps.analyzeAndStore(record);
    }
```

- [ ] **Step 6: Run the test + full suite**

Run: `npx vitest run server/session.analysis.test.ts server/session.learnings.test.ts`
Expected: PASS. The analysis test's `close` fires `dispose()`; because `browserSessionId` is null in this unit test (startSession was never run), the guard would skip persistence.

> **Adjust for the test:** the guard on `browserSessionId` must not block the test. Two options — pick one and keep it consistent: (a) in the test, set a session id by emitting a minimal `audio_start` flow (heavier); or (b) relax the guard to always build a record (using `this.browserSessionId ?? "unknown"` as id) so teardown analysis runs even for sessions that never fully started. **Use (b):** replace `if (this.browserSessionId) {` with `{ const id = this.browserSessionId ?? "unknown";` and use `id` in `build({ id, ... })` and `replayUrl(id)`. This also captures abandoned-before-start sessions. Re-run the test; expected PASS.

- [ ] **Step 7: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add server/session.ts server/session.analysis.test.ts
git commit -m "feat(sessions): record trace + persist/analyze on session teardown"
```

---

### Task 8: Dashboard data source (real recap → view model, mock fallback)

**Files:**
- Create: `lib/dashboard/source.ts`
- Test: `lib/dashboard/source.test.ts`

**Interfaces:**
- Consumes: `loadSession`, `loadRecap`, `listSessions` from `../sessions`; existing mock `getSession`, `SESSIONS` from `./data`.
- Produces: `getRecapView(id: string): Promise<RecapView | null>` where `RecapView` carries the `SessionRecord` + `RecapReport` + `status`; `getSessionView(id)` that prefers real, else maps the mock `Session` to a `RecapView`-ish shape for rendering.

> **Scope note:** the existing dashboard mock (`lib/dashboard/data.ts`) has a different `Session` shape than `RecapReport`. To avoid a large refactor, this task adds a thin real-data accessor the recap UI (Task 9) consumes; the mock pages keep working unchanged. The list page wiring is OPTIONAL and folded here only if trivial.

- [ ] **Step 1: Write the failing test (mock the sessions layer)**

Create `lib/dashboard/source.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../sessions", () => ({
  loadSession: vi.fn(),
  loadRecap: vi.fn(),
  listSessions: vi.fn(async () => []),
}));

import { loadSession, loadRecap } from "../sessions";
import { getRecapView } from "./source";

describe("getRecapView", () => {
  it("returns null when the session is unknown", async () => {
    (loadSession as any).mockResolvedValue(null);
    (loadRecap as any).mockResolvedValue({ status: "pending", recap: null });
    expect(await getRecapView("nope")).toBeNull();
  });

  it("returns the record + recap + status when present", async () => {
    (loadSession as any).mockResolvedValue({ id: "s1", company: "Acme", events: [], transcript: [], startedAt: 0, endedAt: 1 });
    (loadRecap as any).mockResolvedValue({ status: "ready", recap: { sessionId: "s1", label: "hot" } });
    const v = await getRecapView("s1");
    expect(v).toMatchObject({ status: "ready" });
    expect(v!.record.id).toBe("s1");
    expect(v!.recap!.label).toBe("hot");
  });

  it("returns pending status when the recap is not ready yet", async () => {
    (loadSession as any).mockResolvedValue({ id: "s1", company: "Acme", events: [], transcript: [], startedAt: 0, endedAt: 1 });
    (loadRecap as any).mockResolvedValue({ status: "pending", recap: null });
    const v = await getRecapView("s1");
    expect(v).toMatchObject({ status: "pending" });
    expect(v!.recap).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/dashboard/source.test.ts`
Expected: FAIL — cannot find module `./source`.

- [ ] **Step 3: Write the source implementation**

Create `lib/dashboard/source.ts`:

```ts
// Server-side data access for the dashboard recap UI. Prefers real persisted
// sessions/recaps from Redis; callers fall back to the existing mock data when a
// real session id is not found (see app/dashboard/sessions/[id]/page.tsx).
import { loadSession, loadRecap, listSessions } from "../sessions";
import type { RecapReport, RecapStatus, SessionRecord } from "../sessions";

export interface RecapView {
  record: SessionRecord;
  recap: RecapReport | null;
  status: RecapStatus;
}

/** The real recap view for a session id, or null if no such session is stored. */
export async function getRecapView(id: string): Promise<RecapView | null> {
  const record = await loadSession(id);
  if (!record) return null;
  const { status, recap } = await loadRecap(id);
  return { record, recap, status };
}

/** Real session summaries for the dashboard list (empty when Redis is empty). */
export async function listRecapSessions(limit = 50) {
  return listSessions(limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/dashboard/source.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/source.ts lib/dashboard/source.test.ts
git commit -m "feat(dashboard): real recap data source with mock fallback"
```

---

### Task 9: Render the recap on the session detail page

**Files:**
- Create: `components/dashboard/RecapPanel.tsx`
- Modify: `app/dashboard/sessions/[id]/page.tsx`

**Interfaces:**
- Consumes: `getRecapView` from `@/lib/dashboard/source`; `RecapReport`, `Evidence` types from `@/lib/sessions`; existing mock path `getSession` from `@/lib/dashboard/data`.
- Produces: `<RecapPanel view={RecapView} />` React server component.

- [ ] **Step 1: Write the RecapPanel component**

Create `components/dashboard/RecapPanel.tsx`:

```tsx
import type { Evidence, RecapReport } from "@/lib/sessions";
import type { RecapView } from "@/lib/dashboard/source";

const LABEL_STYLE: Record<RecapReport["label"], string> = {
  hot: "bg-goodlit/15 text-goodlit",
  follow_up_needed: "bg-warnlit/15 text-warnlit",
  nurture: "bg-slate2 text-ash",
};
const LABEL_TEXT: Record<RecapReport["label"], string> = {
  hot: "Hot",
  follow_up_needed: "Follow-up needed",
  nurture: "Nurture",
};

function EvidenceChips({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {evidence.map((e, i) =>
        e.kind === "quote" ? (
          <span key={i} className="rounded bg-slate2 px-2 py-0.5 font-mono text-[11px] text-ash">
            <span className="text-ember">{e.speaker === "user" ? "buyer" : "agent"}:</span> “{e.text}”
          </span>
        ) : (
          <span key={i} className="rounded bg-slate2 px-2 py-0.5 font-mono text-[11px] text-ash">
            ↪ {e.label}
          </span>
        )
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-[12px] border border-edge bg-slate p-4">
      <span className="mb-[8px] block font-mono text-[11px] uppercase tracking-[0.1em] text-ember">{label}</span>
      {children}
    </div>
  );
}

export default function RecapPanel({ view }: { view: RecapView }) {
  if (view.status !== "ready" || !view.recap) {
    return (
      <Section label="Recap">
        <p className="m-0 text-[14px] text-ash">Analyzing this session… refresh in a moment.</p>
      </Section>
    );
  }
  const r = view.recap;
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className={"rounded px-2 py-1 text-[12px] font-semibold " + LABEL_STYLE[r.label]}>{LABEL_TEXT[r.label]}</span>
        <EvidenceChips evidence={r.labelEvidence} />
      </div>

      <Section label="Summary">
        <p className="m-0 text-[14px] leading-[1.6] text-ash">{r.summary}</p>
      </Section>

      {r.whyTheyCame.text && (
        <Section label="Why they came">
          <p className="m-0 text-[14px] text-ash">{r.whyTheyCame.text}</p>
          <EvidenceChips evidence={r.whyTheyCame.evidence} />
        </Section>
      )}

      {r.buyingSignals.length > 0 && (
        <Section label="Buying signals">
          {r.buyingSignals.map((s, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <p className="m-0 text-[14px] text-ash">{s.text}</p>
              <EvidenceChips evidence={s.evidence} />
            </div>
          ))}
        </Section>
      )}

      {r.objectionsQuestions.length > 0 && (
        <Section label="Objections & questions">
          {r.objectionsQuestions.map((o, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <p className="m-0 text-[14px] text-ash">
                <span className="text-ember">[{o.kind}]</span> {o.text}
              </p>
              <EvidenceChips evidence={o.evidence} />
            </div>
          ))}
        </Section>
      )}

      {r.gaps.length > 0 && (
        <Section label="Workflow / product gaps">
          {r.gaps.map((g, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <p className="m-0 text-[14px] text-ash">{g.text}</p>
              <EvidenceChips evidence={g.evidence} />
            </div>
          ))}
        </Section>
      )}

      {r.nextAction.text && (
        <Section label="Recommended next action">
          <p className="m-0 text-[14px] text-ash">{r.nextAction.text}</p>
          <EvidenceChips evidence={r.nextAction.evidence} />
        </Section>
      )}

      <Section label="Draft follow-up email">
        <p className="m-0 text-[13px] font-semibold text-chalk">{r.draftEmail.subject}</p>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-[1.6] text-ash">{r.draftEmail.body}</pre>
      </Section>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the session detail page**

In `app/dashboard/sessions/[id]/page.tsx`, add imports at the top:

```tsx
import RecapPanel from "@/components/dashboard/RecapPanel";
import { getRecapView } from "@/lib/dashboard/source";
```

Replace the body of `SessionDetail` that reads `const s = getSession(id); if (!s) notFound();` with a real-first lookup:

```tsx
  const { id } = await params;
  const view = await getRecapView(id);
  if (view) {
    // Real recorded session: render the evidence-backed recap.
    return (
      <div className="flex h-screen flex-col text-chalk">
        <header className="flex flex-none items-center gap-[10px] border-b border-edge px-5 py-[14px]">
          <span className="font-serif text-[17px] font-medium tracking-[-0.01em]">Session recap</span>
          <span className="dl-num ml-auto font-mono text-[11px] uppercase tracking-[0.1em] text-ember">
            {view.record.company}
          </span>
        </header>
        <div className="dl-scroll min-h-0 flex-1 overflow-y-auto px-6 py-[22px]">
          <div className="mx-auto max-w-[760px]">
            {view.record.replayUrl && (
              <a
                href={view.record.replayUrl}
                target="_blank"
                rel="noreferrer"
                className="mb-4 inline-block rounded-[8px] border border-edge px-3 py-1.5 text-[12px] font-semibold text-brandlit2 hover:border-ember hover:text-chalk"
              >
                ▶ Open Browserbase replay →
              </a>
            )}
            <RecapPanel view={view} />
          </div>
        </div>
      </div>
    );
  }
  // Fall back to the seeded mock prototype for ids that aren't real sessions.
  const s = getSession(id);
  if (!s) notFound();
  const k = kpis();
```

(The remaining mock JSX below this point is unchanged.)

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npm run build`
Expected: build succeeds (the page compiles; both branches typecheck).

- [ ] **Step 4: Manual verification (optional, needs Redis + a recorded session)**

With Redis running and after a real demo (or after `npm run sessions:smoke` which seeds one), visit `/dashboard/sessions/<id>` for the seeded id and confirm the recap renders with evidence chips; visit a mock id (e.g. one from `lib/dashboard/data.ts`) and confirm the original prototype still renders.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/RecapPanel.tsx "app/dashboard/sessions/[id]/page.tsx"
git commit -m "feat(dashboard): render evidence-backed recap on session detail page"
```

---

### Task 10: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all files pass, including the new `lib/sessions/*` tests, `lib/dashboard/source.test.ts`, and `server/session.analysis.test.ts`; no regressions in existing tests.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Smoke (needs Redis)**

Run: `npm run sessions:smoke`
Expected: `5 passed, 0 failed`.

- [ ] **Step 4: Final commit (if any lint/format fixups)**

```bash
git add -A
git commit -m "chore(sessions): full-suite green for post-session recap" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**
- Persist transcript + session data → Tasks 2, 5, 7 (SessionRecord with events + transcript; `saveSession`; dispose wiring). ✓
- Full capture (transcript + traces + pages + replay) → Task 2 event kinds + Task 7 capture hooks (`recordUser`/`recordAgent`/`recordPage`/`recordAction`/`recordPhase`/`recordRemember`) + `replayUrl`. ✓
- Post-session analysis job → Task 4 (`analyzeSession`/`analyzeAndStore`), triggered Task 7 dispose. ✓
- Recap fields (summary, why-they-came, buying signals, objections/questions, gaps, next action, draft email) → Task 1 `RecapReport` + Task 9 rendering. ✓
- Evidence on every insight; drop ungrounded → Task 3 `groundInsights` + Task 4 integration; tests assert hallucinated quote dropped. ✓
- Label hot/follow_up_needed/nurture backed by exact quote → Task 3 label recompute + Task 4 prompt; tests cover downgrade. ✓
- Key by session id, buyer optional → Task 1 keys + Task 5 store + Task 7 uses `browserSessionId`. ✓
- Frontend on existing dashboard with mock fallback → Tasks 8, 9. ✓
- Pending UX ("Analyzing…") → Task 9 RecapPanel pending branch. ✓
- Smoke + tests mirroring learnings → Tasks 6, and unit tests in each module. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. The one conditional decision (Task 7 Step 6) is resolved explicitly to option (b).

**Type consistency:** `ChatFn` signature matches `lib/learnings`. `RecapReport`/`Evidence`/`SessionRecord`/`TraceEvent` names are used identically across Tasks 1, 3, 4, 5, 8, 9. `saveRecap(id, recap)` / `loadRecap(id)` / `saveSession(record)` / `loadSession(id)` signatures match between Task 5 (def), Task 4 (`analyzeAndStore`), and Task 8 (`getRecapView`). `SessionRecorder` method names match between Task 2 (def) and Task 7 (calls).
