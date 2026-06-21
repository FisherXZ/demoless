# Sponsor Walkthrough — Browserbase · Deepgram · Redis

Cheat sheet for talking to sponsor reps at the hackathon. Everything here is grounded in our
actual code (file:line cited), so you can defend any detail they poke at.

**What demoless is, in one breath:** an AI voice agent that runs *live* product demos 24/7. It
**listens** (Deepgram STT) → **thinks** (Claude w/ native tool-use) → **drives a real cloud browser**
(Browserbase) → **speaks** (Deepgram/OpenAI TTS), and remembers + retrieves product knowledge via
**Redis**. The buyer watches the agent actually click through the live product while talking to it.

So all three sponsors are *load-bearing* in the same loop — that's the strong story: **one agent,
three of your stacks, in production on the critical path.**

---

## 🌐 BROWSERBASE — "the agent drives a real browser the buyer can watch"

### 30-sec pitch
We use Browserbase as the agent's hands and the buyer's eyes. The agent navigates/clicks the *real*
product over CDP; the buyer watches the **Live View** iframe in real time. Not screenshots, not a
recording — a live cloud Chrome the AI controls by voice.

### What we use (be specific — they'll like the detail)
- **SDK:** `@browserbasehq/sdk` v2.14.1 — `sessions.create / debug / update` (`lib/browser/session.ts`)
- **Live View:** `debug.debuggerFullscreenUrl` + `&navbar=false`, iframed to the buyer (session.ts:97)
- **Control:** raw **Playwright over CDP** via `chromium.connectOverCDP(session.connectUrl)` — *not Stagehand yet*
- **Contexts:** pre-authenticated context via `BROWSERBASE_CONTEXT_ID`, `persist:false` so the prospect's clicks don't overwrite our saved login
- **keepAlive:** `true` + `timeout:900` so sessions survive CDP reconnects (dev HMR, brief drops)
- **Proxies:** residential proxies behind `BROWSERBASE_PROXIES=1` (off by default — datacenter IPs work for most SaaS)
- **Prewarm:** we warm a session when the form loads (120s TTL) so the room opens near-instantly

### The agent's browser toolset (`server/brain/tools.ts` + `executor.ts`)
`navigate`, `click(text)`, `type(text, into?)`, `press(key)`, `scroll(dir)`, `wait(until?, sec?)`, `look`.
- `look` extracts visible links/buttons + `innerText` (capped ~2800–4000 chars) to ground Claude each turn.
- `wait` polls `innerText` for a target string or until the page settles — never throws, 15s cap. This is
  what makes **results-driven** demos work (e.g. "pull the latest SEC filing" — agent waits for the real result).

### Decisions / tradeoffs (one-liners — "X over Y because Z")
- **Browserbase cloud Chrome over local headless** — because we need a *shareable live view* for the buyer + no local browser infra.
- **Raw Playwright/CDP over Stagehand** — deterministic, low-latency clicks for a live demo; Stagehand (LLM-driven) is the planned next step once it earns its latency (path stubbed at session.ts:129).
- **`click({ force:true })`** — skips Playwright actionability checks that hang on chart/repaint-heavy pages.
- **`domcontentloaded` over `networkidle`** — dashboards with live polling never go idle; networkidle would freeze the demo.

### Honest feedback / asks (reps love candor + a concrete ask)
- **~6s cold session start** — prewarm hides it, but a faster create or a "warm pool" API would kill the last gap. *(good thing to ask them about)*
- **Context is global, not per-company** — multi-product demos need a manual env swap. **Ask:** best pattern for per-tenant authenticated context pooling?
- **No iframe/shadow-DOM traversal** in our `look`/`click` (our limitation via `$$eval`/`innerText`).
- **What works great:** Live View embed (zero friction), keepAlive + explicit `REQUEST_RELEASE`, prewarm.

---

## 🎙️ DEEPGRAM — "STT + TTS on the live conversation loop"

### 30-sec pitch
Deepgram is both ears and (default) voice. **nova-3** streaming STT with VAD/endpointing drives
turn-taking and barge-in; **Aura-2** TTS speaks the agent's reply, pipelined per-sentence so the
buyer hears audio before the LLM finishes generating.

### STT specifics (`server/deepgram/stt.ts`)
- **Model:** `nova-3`, WebSocket streaming, **Linear16 PCM mono @ 24kHz**
- Flags: `interim_results`, `smart_format`, `punctuate`, `vad_events`, `endpointing=STT_ENDPOINTING_MS` (default 250ms), `utterance_end_ms=1000`
- **8s keep-alive heartbeats** so the socket doesn't drop during silence
- Emits `isFinal` / `speechFinal` / `confidence`; we threshold finals at `STT_MIN_CONFIDENCE` (0.55) and filter phantom outro spam ("thanks for watching") in `server/stt/filter.ts`

### TTS specifics (`server/tts/`)
- **Aura-2** via REST `/v1/speak` (streamed) — EN `aura-2-thalia-en`, ES `aura-2-celeste-es`
- **Routing factory** (`index.ts`) picks provider per language at runtime
- **Per-sentence pipelining** (`sentenceChunker.ts` + `chunkChannel.ts`): first clause flushes after ~18 chars / punctuation → time-to-first-audio drops; next sentence synthesizes while the current one plays → gapless

### Barge-in (`server/bargeIn.ts`) — this is a strong technical talking point
- Three modes: `off` (half-duplex, default), `vad` (interrupt on voice onset), `speech` (interrupt only on *novel* transcribed words)
- **Echo-word filtering:** `novelWordCount()` discounts the agent's own TTS bleeding into the mic — only *new* words past `BARGE_IN_MIN_WORDS` (3) and `BARGE_IN_MIN_CONFIDENCE` (0.6) trigger
- Interrupt → `AbortController.abort()` cancels in-flight TTS + client `PcmPlayer.stop()` for instant cutoff
- `POST_SPEECH_GUARD_MS=1200` suppresses echo tail after the agent stops

### Decisions / tradeoffs
- **nova-3 streaming over batch** — interim results give live captions + low-latency turn detection without waiting on the LLM.
- **Aura-2 via REST stream over the WS SDK** — sidesteps SDK frame-decoding quirks; PCM @ 24kHz needs no transcoding.
- **Multi-provider TTS abstraction** — so we can pin a language to the best voice (see Mandarin below) without touching the pipeline.

### Honest feedback / asks
- **Aura-2 has no Mandarin voice** (supports en/es/nl/fr/de/it/ja). We keep **Deepgram STT for `zh`** but route TTS to OpenAI. **This is the #1 thing to mention** — a Mandarin Aura voice would let us go full-Deepgram. *(They'll want this feedback.)*
- **Endpointing is a tuning tradeoff** — 250ms is snappy but can clip slow speakers; no universal value. **Ask:** any adaptive-endpointing guidance?
- **Echo in half-duplex** still leaks to the mic; our filter is best-effort. **Ask:** recommended echo-cancellation setup for speaker (non-headset) callers?

---

## 🧱 REDIS — "one datastore, two jobs: buyer memory + vector RAG"

### 30-sec pitch
We use a single Redis instance for two distinct jobs: **(1)** per-buyer memory (who is this person,
what do they care about) and **(2)** semantic product-knowledge RAG (what does the product do). Same
`demoless:` namespace, two key families, one ops surface.

### Two layers — keep them distinct (this clarity impresses)
| | Buyer memory (`lib/memory/`) | Product knowledge (`lib/knowledge/`) |
|---|---|---|
| Answers | *Who* is this buyer? | *What* does the product do? |
| Storage | HASH + STREAM | HASH + **RediSearch HNSW index** |
| Retrieval | importance + recency (in-memory) | **vector KNN, cosine** |
| Key | `demoless:buyer:{email}` | `demoless:kb:{company}:{chunkId}` |

### Data structures & commands (be precise)
- **Buyer profile = HASH**, `HSET` + **`HSETNX`** for init-only `firstSeen`/`visitCount` (returning-buyer detection without races) — `store.ts:34`
- **Notes = append-only STREAM** (`XADD` / `XREVRANGE`) — immutable chronological log fits "remember things about a buyer"; ranking happens after load
- **Live notes = Pub/Sub** on `demoless:notes`, **separate ioredis subscriber connection** (subscriber mode is blocking), **shared across all SSE clients** → bridged to the dashboard via `/api/notes/stream` (SSE)
- **Knowledge = RediSearch HNSW index** `demoless:kb-idx`: `VECTOR HNSW 6 TYPE FLOAT32 DIM 1536 DISTANCE_METRIC COSINE`, `company` **TAG** pre-filter, KNN query `(@company:{tag})=>[KNN k @vector $BLOB]`, DIALECT 2 — `store.ts:18,162`
- **Embeddings:** OpenAI `text-embedding-3-small` (1536-d), paragraph-aware chunking w/ 150-char overlap → FLOAT32 little-endian buffer
- **Source-of-record split:** `demoless:kb-source:*` (authored prose) vs `demoless:kb:*` (derived vectors) → re-embed safely via `reindexFromSource`

### Decisions / tradeoffs
- **One Redis for both over a separate vector DB (Pinecone/Weaviate)** — keeps ops to one box at hackathon scale; `buyer:` vs `kb:` prefixes allow a later split.
- **Redis Stack (RediSearch) over plain Redis** — built-in HNSW vector search; the tradeoff is a harder dependency (`redis/redis-stack`), which we accept.
- **Streams over Lists for notes** — auto chronological IDs + immutable-log semantics.
- **Source-of-record separate from vectors** — edit prose, then reindex; vectors are fully regenerable.

### Graceful degradation (shows production maturity)
- `search_knowledge` catches a missing-Redis-Stack error and tells the agent "answer from general product facts" instead of crashing (`executor.ts:59`)
- `loadBuyer` is try/caught at startup — a Redis outage just means no recall line, demo still runs (`startup.ts:191`)
- `ensureIndex()` detects "unknown command" and prints the exact `docker run redis/redis-stack` fix

### Honest feedback / asks
- **Redis Stack is a hard dep for RAG** — no fallback vector store by design. **Ask:** Redis Cloud sizing for HNSW at multi-company scale?
- **Retrieval is fast:** ~10–50ms per `FT.SEARCH` (k=4, HNSW); ~6MB index per ~40 doc pages.
- **Provisional message contracts** in `types.ts` (pending an internal cross-track reconciliation) — minor.
- **Lazy `REDIS_URL` read** to dodge an ESM/dotenv hoisting trap (`redis.ts:14`) — small gotcha worth a knowing nod.

---

## Likely cross-cutting questions + crisp answers
- **"Why all three?"** → They're on one critical loop: Deepgram hears → Claude+Browserbase acts → Redis remembers/retrieves → Deepgram speaks. Not a demo bolt-on.
- **"Latency end to end?"** → Mic PCM (24kHz, ~40ms frames) → nova-3 interim → endpoint/barge-in → Claude streams → first clause → Aura-2 → PcmPlayer. First audio in ~2–3s; Browserbase prewarm removes the room cold-start.
- **"Scale?"** → 1 Browserbase session per concurrent call (~2min avg), thousands of buyers in one Redis, ~10–50ms vector search. Single-process session map today (globalThis) — known limit.
- **"What'd you cut for the hackathon?"** → Stagehand integration, per-company browser contexts, adaptive endpointing, multi-process session store.
