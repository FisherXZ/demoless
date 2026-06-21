# Cross-session demo learnings (`lib/learnings`)

The agent's self-improving tier. One global Redis stream per company
(`demoless:learnings:{companySlug}`), holding model-distilled rules-of-thumb
about how to run the demo better. Global across all buyers — NOT per-buyer.

## Write path (on every socket close)
1. `VoiceSession.dispose()` fires `reflectAndStore({ company, turns, phaseReached })`
   fire-and-forget (never blocks teardown, never throws). `dispose()` is
   idempotent, so an error-then-close only reflects once. `reflectAndStore`
   no-ops unless the visitor actually spoke (≥1 user turn), so greeting-only
   /abandoned sessions cost no LLM call.
2. `reflectOnSession()` makes ONE LLM call: transcript + phase reached →
   ≤3 generalizable rules `{ text, confidence }` (returns `[]` if nothing
   generalizes or the session was empty).
3. `writeLearnings()` appends each to the stream and `XTRIM`s to `MAX_LEARNINGS`.

> The write path is the only place reflection calls the model, so the server
> env must have `ANTHROPIC_API_KEY` for learnings to be produced in production.
> (Unit tests and the smoke script inject a fake `chat`, so no key is needed there.)

## Read path (at session start)
1. `VoiceSession.startListening()` calls `getLearnings(company)`.
2. `buildLearningsContext()` ranks them (confidence, then recency — same shape
   as `lib/memory`'s `composeRecall`) and formats the top-`TOP_K` into a block.
3. The block is folded into the orchestrator's `memoryContext` and injected into
   the system prompt by `buildSystem()` — so every turn of the next demo sees it.

## Poisoning guard (minimal)
The literature's #1 long-term-memory failure mode is a bad reflection poisoning
future runs. Our single, cheap guard: `buildLearningsContext` never injects a
learning below `MIN_CONFIDENCE` (0.3). Low-confidence rules are still written
(for audit) but stay out of prompts. No contradiction middleware / dedup /
expiry — judged over-engineering for hackathon scope.

## Scope / non-goals
- No vector search (ranked list suffices at demo volume).
- No contradiction-checking / dedup / expiry beyond the stream length cap +
  confidence floor + confidence ordering (deliberately minimal for hackathon scope).
- Per-message importance scoring and rolling-summary compaction are deferred;
  the existing `slice(-MAX_HISTORY_TURNS)` sliding window is the minimal
  in-session working-memory bound for now.

## Verify
```bash
npm test                 # unit tests (store ranking/floor, reflect parsing, wiring)
npm run learnings:smoke  # live-Redis write→read→format round-trip (4 checks)
```
