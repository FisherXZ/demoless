# Design: Single-Brain Convergence — Voice + Browser + Memory

**Date:** 2026-06-20
**Status:** Approved design, pre-implementation
**Research reference:** [`research/voice-agent-architecture-spine.md`](../../../research/voice-agent-architecture-spine.md)

---

## 1. Context

Four parallel work streams produced four partial systems that merge file-clean but do **not** form one system:

| Lane | What it is | Reasoning core | State |
|---|---|---|---|
| **P1** | The intended "Loop" agent runtime — event bus + sales state machine | `claude-opus-4-8`, **batch** structured-JSON `Reply` | local, unpushed; talks only to fakes |
| **P2** | Voice agent — real Deepgram STT/TTS, streaming, barge-in | `StubOrchestrator` (`claude-3-5-haiku`) | on `origin/main` |
| **P3** | Live demo room — real Browserbase browser the visitor watches | `claude-haiku-4-5` + native tool-use | on `origin/main` |
| **P4** | Memory (Redis Notes + recall) + Knowledge (RAG) + NextAuth | grounding, not a brain | on branch `origin/p4-memory-layer` |
| **P5** | Customer dashboard (sessions, scorecard, people) | — | local, uncommitted |

The roadmap's premise was *one Loop, one shared message list, every lane talks only to the Loop.* In practice each lane grew its own mini-orchestrator. Crucially, **P2 built its `Orchestrator` interface in P1's exact shape** (Command union is a superset of P1's) and left a one-line swap seam (`createOrchestrator()`), with the comment *"When P1's real LLM loop lands, swap the implementation here."* The convergence is therefore half-designed already.

This spec defines how the four lanes converge into **one brain** that drives voice, browser, and memory through a single contract.

## 2. Goals & non-goals

**Goals**
1. One brain of record (P1's Loop) that voice and the room both route through.
2. Browser-driving and memory wired in as **tools** the brain calls — not rival brains.
3. The "actual memory layer" (P4) stitched in: per-buyer Notes + recall, plus RAG.
4. Low perceived latency on voice despite a deliberate "thinking" phase.
5. The demonstrated product is **configuration**, so the agent can demo Browserbase now and expand later without rearchitecture.

**Non-goals (deferred)**
- NextAuth / Google sign-in (identity is form-email or stubbed for now).
- Two-tier reflex/supervisor model split (single brain for now).
- Multi-product authoring UI (data model is multi-product; UI is not in scope).

## 3. Locked decisions (with rationale)

1. **P1's Loop is the single brain core.** The code already votes for it — P2 cut its socket in P1's shape.
2. **STT/TTS are the membrane (ears/mouth), not tools.** They are transport that wraps the brain. Confirmed as the dominant industry pattern (LiveKit, Pipecat, OpenAI). Only genuine *decisions* — `navigate`, `click`, `look`, `remember`, `search_knowledge`, `set_phase` — are tools.
3. **Keep the thinking silence.** Decision-making, context processing, and tool calls happen there. Research confirms first-audio latency depends on LLM *time-to-first-token*, not the full thought, so keeping the silence costs nothing on first audio.
4. **Stream the `say` text into TTS sentence-by-sentence.** Documented default in LiveKit (sentence tokenizer) and Pipecat (SENTENCE mode).
5. **One brain, model tier switchable opus↔sonnet** via config/env. `model.ts` already has a single model constant.
6. **Barge-in aborts the turn AND truncates history to what was actually spoken** — the brain must never reason over words the user never heard.
7. **Model-driven flow; phase is observed, not enforced.** P1's rigid `phase`/`tour`/`select` state machine retires; the model self-reports phase via a `set_phase` tool so the P5 dashboard still gets progress.
8. **Node "agent server" owns the brain + the Browserbase session per demo session;** the room is a thin WebSocket client. This is the resolution of the `server/index.ts` conflict.
9. **Memory + RAG wired now; NextAuth deferred.** Identity = form email / stubbed id. Infra: Redis Stack + `OPENAI_API_KEY`.
10. **Demo Browserbase now; data model is multi-product** via a `DemoConfig` keyed by `company`.

## 4. Architecture

```
                         ┌──────────── AGENT SERVER (Node, long-lived) ────────────┐
                         │            one per demo session — owns everything:        │
   room UI    ──audio──► │  ┌─ MEMBRANE ─┐   ┌──── BRAIN (the one Loop) ────┐        │
      ▲   │   ◄──audio──  │  │ Deepgram   │   │ model.ts: streaming native    │        │
      │   │   ◄──say────  │  │ STT → text │──►│ tool-use loop (opus↔sonnet)   │        │
      │   └─text(user_said)──►│ say → TTS │◄──│ • streams `say` to TTS        │        │
      │                  │  └────────────┘   │ • calls TOOLS ↓               │        │
      │  ◄─screen/liveViewUrl────────────────│                               │        │
      │                  │                   └──┬───────────────┬───────────┘        │
      │                  │   ┌──────────────────▼──┐    ┌───────▼────────┐           │
      └── iframe(liveView)   │ Browserbase session  │    │ memory + RAG    │           │
                         │   │ (eyes + hands)       │    │ (Redis + embed) │           │
                         │   └──────────────────────┘    └───────┬────────┘           │
                         └──────────────────────────────── notes pub/sub │ ───────────┘
                                                                          ▼
                                              P5 Dashboard (phase, notes, scorecard)
```

One WebSocket protocol between the room and the agent server carries **audio + text in** and **say + screen + liveViewUrl out**. The brain and the browser it drives live together server-side. The `liveViewUrl` is a Browserbase URL the room iframe loads directly, so browser ownership can move server-side without affecting rendering.

### 4.1 The brain turn (replaces P1's batch `Reply`)

P1's `Loop`, `shared/contract.ts`, and sales-state survive. **`model.ts` is reworked** from structured-JSON-`Reply` into a **streaming native tool-use agentic loop**:

1. Build messages: history + injected **memory recall** + (optional) RAG context + current `PageContext`.
2. Stream the model:
   - text deltas → **sentence-chunk → `say` command → TTS**;
   - `tool_use` blocks → **execute the lane → feed `tool_result` back → continue** until end-of-turn.
3. **Filler before slow tools**, modeled on Vapi's two-stage pattern: emit a `request-start` style line when a tool fires ("let me pull that up…"), and a `request-response-delayed` style line if the tool exceeds a threshold ("still loading…").
4. **Barge-in**: a new `user_said` aborts via the existing `AbortSignal` and truncates history to spoken-only.

The Loop keeps its event bus (`send`/`onCommand`/`onIncoming`/`onTurn`). A thin **`LoopOrchestrator implements Orchestrator`** wraps it so P2's `VoiceSession` consumes `runTurn(input, ctx, signal): AsyncIterable<Command>` **unchanged**; `createOrchestrator()` returns it.

### 4.2 Tools (the only things that are tools)

| Tool | Effect | Result fed back |
|---|---|---|
| `navigate(url)` | drive Browserbase to a URL | fresh `PageContext{url,title,links,text}` |
| `click(text)` | click element by visible text | fresh `PageContext` |
| `look()` | read the current page without navigating | `PageContext` |
| `remember(note, type)` | persist a buyer Note | confirmation |
| `search_knowledge(query)` | RAG over the product corpus | top-k `SearchHit`s |
| `set_phase(phase)` | report sales phase (observed, not enforced) | ack; emitted to dashboard |

STT and TTS are **not** in this table by design.

### 4.3 Memory + knowledge

- **Session start:** `loadBuyer(id)` → `buildMemoryContext` injected into the system prompt; `recall` line used as the returning-buyer greeting.
- **`remember` tool** → `store` Note → **pub/sub → P5 dashboard** live append.
- **`search_knowledge` tool** → `searchKnowledge(company, query)` → `buildAnswerContext`. Corpus keyed by `company`.
- **Infra:** Redis Stack (RediSearch) + `OPENAI_API_KEY` (embeddings `text-embedding-3-small`). Identity = form email / stubbed id; NextAuth deferred.

### 4.4 `DemoConfig` — product is swappable data

```ts
interface DemoConfig {
  company: string;        // RAG corpus key + memory namespace
  productName: string;    // injected into persona/system prompt
  persona: string;        // agent name + voice/system-prompt persona
  browseTargetUrl: string;// where the live browser starts
  corpusSeed: string;     // doc set seeded into the knowledge index
}
```

Seed **Browserbase** now. Adding Demoless-itself or another product later is a new `DemoConfig` + corpus seed — **no brain code changes**.

## 5. Server topology & conflict resolution

- The **agent server is P2's voice gateway, evolved** to own the `Loop` + the Browserbase session per demo session, plus Deepgram STT/TTS and the memory/RAG clients.
- **`createOrchestrator()` returns a `LoopOrchestrator`** instead of `StubOrchestrator`. Nothing else in the voice layer changes.
- **P1's standalone WS loop server demotes to a dev/test harness** (keeps `server/*.test.ts` green); the production transport is the agent server. This *is* the `server/index.ts` resolution.
- The room's `/api/agent` and `/api/browser` routes collapse into WS messages to the agent server (Next.js keeps only minimal session-minting if needed).
- The other four merge conflicts (`package.json`, `package-lock.json`, `.gitignore`, `.env.example`) are mechanical unions.

## 6. P5 dashboard wiring

- Subscribes to the notes **pub/sub** (via the agent server or a Next API reading Redis) for live Note append.
- Consumes `set_phase` events for progress.
- Scorecard: seed-driven now; live when the Loop emits one. Seed-only is acceptable for the demo.

## 7. Sequencing (basis for the implementation plan)

- **P0 — Converge tree:** commit uncommitted P5 work, merge `origin/main` + `p4` branch, resolve the 5 conflicts.
- **P1 — Brain:** rework `model.ts` → streaming native tool-use; add `LoopOrchestrator`; define the tool catalog (start `navigate`/`click`/`look` + `remember` + `search_knowledge` + `set_phase`).
- **P2 — Agent server:** evolve the gateway to own the Loop + Browserbase session; room becomes a WS client.
- **P3 — Memory + RAG:** recall injection, `remember`, `search_knowledge`, notes→dashboard pub/sub.
- **P4 — `DemoConfig`** + Browserbase corpus seed + browse target.
- **P5 — Dashboard live** wiring + barge-in correctness + polish.
- **Deferred:** NextAuth Google, multi-product authoring UI, two-tier reflex layer.

## 8. Risks & mitigations

- **opus first-token latency** on voice. Mitigation: sonnet tier switch + filler speech + accepted thinking silence. Re-evaluate two-tier split if first-audio exceeds ~1.5s p95.
- **Reworking `model.ts` loses P1's tested batch path.** Mitigation: keep the contract/Loop/state tests; add tool-use-loop tests; keep the stub fallback for offline/no-key.
- **Redis Stack dependency** for RAG. Mitigation: feature-flag RAG; memory (plain Redis) works without RediSearch; degrade `search_knowledge` to a no-op if the index is absent.
- **Barge-in correctness** (reasoning over unheard words). Mitigation: truncate history to spoken-only on abort; add a regression test.
- **Persona/corpus drift** across lanes. Mitigation: single `DemoConfig` is the only source of persona + corpus + target.

## 9. Open config items (deferred to planning, non-blocking)

1. **`browseTargetUrl`** for the Browserbase demo — exact site the live browser starts on (e.g., a Browserbase showcase, browserbase.com, or a rich live site framed as "watch our agent drive any site"). Default pending confirmation.
2. **`persona`** name for the Browserbase demo — default "Maya" (carried from P3) unless changed.
