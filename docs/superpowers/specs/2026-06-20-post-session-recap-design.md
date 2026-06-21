# Post-Session Analysis & Recap Report — Design Spec

**Date:** 2026-06-20
**Branch:** `feat/post-session-recap`
**Status:** Approved design, pending spec review

## Problem

After an AI demo ends we currently discard the conversation. The only thing that
survives is the cross-session *learnings* distillation (`lib/learnings/`) and any
buyer notes. The salesperson gets nothing actionable about *this* specific demo.

We want: when a demo ends, persist the session (transcript + trace + Browserbase
session id/replay link + pages visited + agent actions), then run a post-session
analysis that produces an **evidence-backed recap report** for the salesperson:

- short summary
- why the buyer came for the demo
- strongest buying signals
- objections / questions
- workflow or product gaps
- recommended next action
- a draft follow-up email
- a success **label** (`hot` / `follow_up_needed` / `nurture`)

**Integrity rule (Granola-style):** every discrete insight must link back to
evidence of what the buyer actually said or did. If we cannot ground a claim in
the transcript or a recorded action, we do not show it. The guarantee is enforced
in *our* code, not by trusting the model.

## Non-goals (v1)

- Tying recaps to a real buyer identity. Buyer stays `anonymous`; recaps are keyed
  by session id. (Wiring the verified form email through the voice WS is a separate
  task.)
- Timestamp-deep-linkable replay. Browserbase exposes a session-level recording
  (dashboard URL, auth-gated) but no URL param to jump to a moment. We persist
  relative timestamps so a future self-hosted rrweb player *could* deep-link, but
  v1 ships a session-level replay link only.
- Live push of the finished recap to an open dashboard. v1 uses "Analyzing…" +
  manual refresh.

## Decisions (locked)

| Axis | Decision |
|---|---|
| Scope | Full slice: persist → analyze → surface on the existing dashboard. |
| Evidence | Full capture: transcript quotes (primary) + recorded agent actions/page visits (secondary), each timestamped. |
| Schema | New purpose-built `RecapReport`, evidence-first. |
| Identity | Key by session id (Browserbase session id); buyer optional/`anonymous`. |
| Label enum | `hot` \| `follow_up_needed` \| `nurture`. |
| Replay | Session-level link `https://www.browserbase.com/sessions/{id}`; no timestamp deep-link. |
| Pending UX | "Analyzing…" + manual refresh; no live push. |
| `summary` / `draftEmail` | Derived prose, exempt from per-line citation (grounded in the whole transcript / already-verified insights). All other insights require verifiable evidence. |

## Architecture

The voice server (standalone Node WS gateway, `server/`) **writes** to Redis; the
Next app **reads** from the same Redis server-side. Shared Redis is the seam —
no new IPC. This mirrors how `lib/learnings` and `lib/memory` already work.

### New module `lib/sessions/` (mirrors `lib/learnings/`, `lib/memory/`)

- `types.ts` — `TraceEvent`, `SessionRecord`, `Evidence`, `RecapReport`, label type.
- `recorder.ts` — `SessionRecorder`: accumulates timestamped events during a live
  session and derives the transcript. Pure, no Redis, unit-testable.
- `keys.ts` — Redis keys (see below). Namespaced `demoless:` like the others.
- `store.ts` — `saveSession` / `loadSession` / `saveRecap` / `loadRecap` /
  `listSessions`. Redis **hash** for the record/recap (JSON-string fields), plus a
  Redis **sorted set** index for the dashboard list. No new dependencies
  (reuses `getRedis()` from `lib/memory/redis.ts`).
- `analyze.ts` — `analyzeSession(trace, ctx, chat?)` and fire-and-forget
  `analyzeAndStore(...)`. Injectable `ChatFn` exactly like `lib/learnings/reflect.ts`.
- `ground.ts` — `verifyEvidence(evidence, trace)` and `groundInsights(report, trace)`:
  the integrity gate. Pure, heavily unit-tested.
- `index.ts` — public surface.

### Redis keys

```
demoless:session:{id}          # hash: metadata + events JSON + transcript JSON
demoless:session:{id}:recap    # hash: RecapReport JSON + status + generatedAt
demoless:sessions              # sorted set: member=id, score=endedAt (dashboard list)
```

## Data captured — the trace (source of truth)

`TraceEvent` is an ordered union, each carrying `ts` (epoch ms) and, where
applicable, the `turn` index:

- `user_said`    `{ text, ts, turn }`
- `agent_said`   `{ text, ts, turn }`   — spoken sentences only; **filler excluded**
- `page_visited` `{ url, ts, turn }`    — from `screen_is_on` / navigate result
- `agent_action` `{ kind: "navigate" | "click", detail, ts, turn }`
- `phase`        `{ phase, ts }`        — from `set_phase`
- `remember`     `{ note, noteType?, ts }`

```ts
interface SessionRecord {
  id: string;            // Browserbase session id
  company: string;
  role?: string;         // visitor's self-reported role
  startedAt: number;
  endedAt: number;
  phaseReached?: string;
  replayUrl?: string;    // https://www.browserbase.com/sessions/{id}
  events: TraceEvent[];
  transcript: ConversationTurn[];   // derived from user_said/agent_said, in order
}
```

### Capture points (in `server/session.ts`)

A `SessionRecorder` instance is owned by `VoiceSession`. Events are recorded at the
existing seams (no behavior change to the live demo):

- `orchestratorSay` command switch: `say` → `agent_said`; `screen_is_on` →
  `page_visited`; `navigate`/`click` → `agent_action`; `set_phase` → `phase`;
  `remember` → `remember`. (`filler` is intentionally **not** recorded.)
- user-turn paths (`endUtterance`, `text_input`) → `user_said`.
- session start records `startedAt`, `role`, and the Browserbase session id.

At `dispose()` (socket close): build the `SessionRecord` → `saveSession` →
`analyzeAndStore` (fire-and-forget, wrapped in try/catch, never blocks teardown).
This sits alongside the existing `reflectAndStore` call.

> **Implementation note:** `server/session.ts` changed on `main` (4aef09e added
> browser warm-up + language detection). Re-read the current `dispose()`,
> `orchestratorSay`, and user-turn paths before wiring capture; the seams above
> are named, not line-numbered, for that reason.

## RecapReport schema (evidence-first)

```ts
type Evidence =
  | { kind: "quote"; speaker: "user" | "agent"; text: string; turn: number; ts: number }
  | { kind: "action"; label: string; ts: number };   // page visit / agent action from the trace

type RecapLabel = "hot" | "follow_up_needed" | "nurture";

interface RecapReport {
  sessionId: string;
  generatedAt: number;

  label: RecapLabel;
  labelEvidence: Evidence[];     // explicit buying-signal quote(s) backing hot/follow_up_needed

  summary: string;               // paraphrase of the whole conversation (exempt from per-line citation)
  whyTheyCame: { text: string; evidence: Evidence[] };
  buyingSignals: { text: string; evidence: Evidence[] }[];
  objectionsQuestions: { text: string; kind: "objection" | "question"; evidence: Evidence[] }[];
  gaps: { text: string; evidence: Evidence[] }[];     // workflow / product gaps
  nextAction: { text: string; evidence: Evidence[] };
  draftEmail: { subject: string; body: string };      // references only grounded insights
}
```

**Integrity rule:** every discrete insight (`whyTheyCame`, each `buyingSignals`,
each `objectionsQuestions`, each `gaps`, `nextAction`) must carry ≥1 evidence that
we verify against the trace; unverifiable items are **dropped before storage**.
`label` requires a verified explicit-buying-signal quote; with none verified, the
label is `nurture`. `summary` and `draftEmail` are derived prose grounded in the
whole transcript / already-verified insights, so they are exempt from per-line
citation.

### Label classification

- `hot` — explicit purchase intent or "where/how do I buy" ("we want to buy",
  "how do I get started", "let's bring in my team to decide").
- `follow_up_needed` — explicit pricing question, asks for a concrete next step,
  asks to involve others, but not an outright purchase commitment.
- `nurture` — no explicit buying signal verified.

Each `hot` / `follow_up_needed` label MUST be backed by the exact verified quote
in `labelEvidence`.

## Analysis pipeline (`analyzeSession`)

1. **Format the trace** for the prompt: number each turn,
   `[turn N][USER]` / `[turn N][AGENT]` lines, with `page_visited` / `agent_action`
   events inlined and timestamped.
2. **System prompt** instructs: produce JSON matching the schema; **every** insight
   must include a verbatim `quote` copied exactly from a `[USER]`/`[AGENT]` line, or
   an `action` referencing a recorded page visit/action; if a claim can't be
   grounded, **omit it — do not speculate**; classify `label` and back `hot` /
   `follow_up_needed` with the exact quote.
3. **One non-streaming Claude call** — `process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8"`,
   `max_tokens ≈ 3000`, via an injectable `ChatFn` (mockable in tests, like
   `reflect.ts`).
4. **Lenient parse** — Zod schema + boundary extraction + coerce (reuse the
   `reflect.ts` resilience pattern) so stray prose around the JSON doesn't fail it.
5. **`groundInsights`** — for each `quote`, normalize whitespace + case and require
   it to be a substring of the cited speaker's turn (fall back to any turn); attach
   the verified `turn`/`ts`. For `action` evidence, require a matching trace event.
   Drop insights with zero verified evidence. Recompute `label` from verified
   buying signals.
6. **Return `RecapReport`.** `analyzeAndStore` saves it (`saveRecap`) and updates the
   `demoless:sessions` index.

**Guard:** skip analysis when the transcript has no `user` turns (matches the
learnings guard). On any error, log and skip — never throw out of `dispose()`.

## Frontend (full slice)

- `lib/dashboard/source.ts` — server-side data access: prefer real
  `listSessions()` / `loadSession()` / `loadRecap()`; **fall back to the existing
  mock `SESSIONS`** when Redis is empty so the prototype still renders.
- **Session detail** (`app/dashboard/sessions/[id]/page.tsx`) — render the
  `RecapReport`: label chip, summary, why-they-came, buying signals / objections /
  gaps each with **inline quote chips** (Granola-style, showing speaker + the
  verbatim quote), next action, draft email with a copy button, the replay link,
  and the transcript. If the recap is missing/pending → "Analyzing…" + a refresh.
- **Dashboard list** (`app/dashboard/page.tsx`) — real sessions when present, mock
  fallback otherwise.

## Testing

- `lib/sessions/recorder.test.ts` — events recorded in order, transcript derived,
  filler excluded, timestamps present.
- `lib/sessions/ground.test.ts` — **the core integrity tests:** a fabricated quote
  is rejected; whitespace/case-normalized matching works; an ungrounded insight is
  dropped; the label downgrades to `nurture` with no verified signal.
- `lib/sessions/analyze.test.ts` — injected `ChatFn` returns canned JSON including a
  hallucinated quote → grounding drops it; label classification from quotes.
- `lib/sessions/store.test.ts` — save/load/list round-trip.
- `server/session.analysis.test.ts` — `dispose()` triggers `analyzeAndStore` once
  with the recorded trace (mock deps), mirroring `server/session.learnings.test.ts`.
- `scripts/sessions-smoke.ts` + a `sessions:smoke` npm script — end-to-end against
  Redis with a fake `ChatFn` (no API key needed), mirroring `learnings-smoke.ts`.

## Error handling / non-functional

- All persistence + analysis is fire-and-forget at `dispose()`, wrapped in
  try/catch; teardown is never blocked (matches `reflectAndStore`).
- Redis outage: swallowed; no recap stored; dashboard shows pending/empty + mock
  fallback.
- One bounded Claude call per ended session; `max_tokens` capped.
- `Date.now()` is used server-side for timestamps (allowed here).

## Open items (none blocking)

All previously-open minor decisions are locked in the Decisions table above.
Anything that surfaces during implementation (e.g. the exact shape of the
Browserbase recording API, or `session.ts` seams shifting) will be raised before
diverging from this spec.
