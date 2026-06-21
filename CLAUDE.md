# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Demoless is an AI agent platform that runs live product demos for companies 24/7 (see `BRAINSTORM.txt` for the product vision, which breaks the work into tracks P1–P5). The repo is now **two halves that meet at a Redis + product-knowledge core**:

- A **Next.js 15 (App Router) + TypeScript + Tailwind frontend** — the buyer-facing demo (landing → form → live room) plus a multi-route **operator dashboard**.
- A **Node voice-agent backend** (`server/`) that *runs the actual demo*: it **listens** (Deepgram STT), **thinks** (Claude with native tool-use), **drives a real browser** (Browserbase cloud Chrome), and **speaks** (TTS) — streaming all of it to the browser over a WebSocket.

The reference product being demoed is **Browserbase** (`company: "browserbase"`); the agent persona is **Maya**. This is the result of the "single-brain convergence" (see `docs/superpowers/specs/2026-06-20-single-brain-convergence-design.md`), which merged the P1–P5 tracks into one streaming brain that owns voice, browser, and memory.

> This codebase has changed a lot. It is **not** "mostly a frontend prototype with mock data" anymore — the voice backend is the live system, and the memory + knowledge layers are wired into it.

## Commands

```bash
npm install

# Frontend (Next.js, http://localhost:3000)
npm run dev          # dev server
npm run build        # production build
npm run start        # serve the production build
npm run lint         # next lint

# Voice backend (WebSocket gateway, ws://localhost:3001 by default)
npm run dev:voice    # tsx watch server/index.ts (auto-reload)
npm run server       # production: node --env-file-if-exists … --import tsx server/index.ts
npm run dev:all      # concurrently: web + voice together

# Tests (vitest) — co-located *.test.ts under server/, shared/, lib/
npm test             # vitest run (one-shot)
npm run test:watch   # vitest watch mode

# Orchestrator smoke (console driver, no WebSocket; runs under USE_STUB=1 without keys)
npm run smoke        # tsx server/smoke.ts

# Redis-backed layers — need a Redis instance (REDIS_URL, see .env.example).
# Vector search (lib/knowledge) needs Redis Stack; it's a superset, so use it for both.
docker run -d -p 6379:6379 redis/redis-stack:latest        # local Redis + Search
npm run memory:smoke       # P4 buyer-memory smoke test
npm run knowledge:seed     # fresh setup: curate from documents.jsonl + rebuild vectors (needs OPENAI_API_KEY)
npm run knowledge:curate   # re-write source-of-record from documents.jsonl (no embedding)
npm run knowledge:reindex  # rebuild vector index from source-of-record (needs OPENAI_API_KEY)
npm run knowledge:export   # dump source-of-record to JSON for review/backup
npm run knowledge:smoke    # end-to-end semantic-retrieval smoke test
```

`USE_STUB=1` runs the brain with a canned stub orchestrator (`server/orchestrator/stub.ts`) so the voice/loop plumbing works without an Anthropic key — handy for `npm run smoke` and tests.

## Environment (`.env.example` → copy to `.env.local`)

The voice server loads `.env.local` then `.env` (`server/index.ts`, `npm run server`). Group by feature:

- **Brain (Claude):** `ANTHROPIC_API_KEY`; `USE_STUB=1` to bypass it; `ANTHROPIC_MODEL` overrides the default `claude-opus-4-8`.
- **Voice:** `DEEPGRAM_API_KEY` (STT + default TTS), `VOICE_SERVER_PORT` (default 3001). Additional knobs are read directly from `process.env` in code (not all are in `.env.example`): `TTS_PROVIDER` (`deepgram`|`openai`|`elevenlabs`), `TTS_SPEED`, `DEEPGRAM_TTS_MODEL`/`OPENAI_TTS_MODEL`/`ELEVENLABS_*`, `STT_ENDPOINTING_MS`, `BARGE_IN` (`off`|`vad`|`speech`), `BARGE_IN_MIN_WORDS`, `BARGE_IN_MIN_CONFIDENCE`, `AGENT_NAME`/`DEMO_PERSONA`. Source of truth: `server/tts/index.ts`, `server/bargeIn.ts`, `server/config/demoConfig.ts`.
- **Browser (Browserbase):** `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, optional `BROWSERBASE_CONTEXT_ID`, and `DEMO_TARGET_URL` (the landing URL the demo browser opens).
- **Redis + RAG:** `REDIS_URL`; for `lib/knowledge` also `OPENAI_API_KEY`, `EMBED_MODEL` (`text-embedding-3-small`), `EMBED_DIM` (`1536`, must match the model and the index).
- **Google auth (scaffolding, currently deferred):** `AUTH_SECRET` (`npx auth secret`), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` from a Google Cloud OAuth 2.0 Web client whose redirect URI is `http://localhost:3000/api/auth/callback/google`.
- **Client:** the browser dials `NEXT_PUBLIC_VOICE_WS_URL` (default `ws://localhost:3001`).
- **Legacy harness:** `PORT` (default 8787) is the *text-chat* harness server, **not** the voice gateway (see "Two subsystems" below).

## Architecture

The buyer flow is still a single client-rendered page: `app/page.tsx` calls `useDemoState()` and switches between `landing | form | room`. What changed is that the **`room` is now driven live by the voice backend** over a WebSocket, and selecting the `dashboard` screen now `router.replace("/dashboard")`s into a **real multi-route operator app** rather than rendering inline. There is no longer a `PrototypeNav` jump-between-screens widget.

### Two subsystems, two ports, two wire contracts (don't conflate them)

| | **Live voice demo** (the real system) | **Text-chat harness** (dev/test only) |
|---|---|---|
| Entry | `server/index.ts` → `VoiceSession` | `server/harness.ts` |
| Port | `VOICE_SERVER_PORT` = 3001 | `PORT` = 8787 |
| Brain | `server/orchestrator/` + `server/brain/turn.ts` (streaming **native tool-use**) | `server/loop.ts` + `server/model.ts` (structured-JSON `Reply`) |
| Wire types | `lib/voice/messages.ts` | `shared/wire.ts` + `shared/contract.ts` (zod) |
| Client | buyer `components/DemoRoom.tsx` (`useVoiceAgent`) | `/harness` dev UI (`components/harness/`, `lib/harness/`) |

When working on the demo, you almost always mean the **live voice** column. `loop.ts`/`model.ts`/`shared/*` are the older P1 text harness — kept for testing the brain in a console/chat, not the production path.

### The voice backend (`server/`) — the live system

- **`server/index.ts`** — `ws` WebSocket gateway on `VOICE_SERVER_PORT`; every browser connection gets one `VoiceSession`. Keeps Deepgram/Anthropic keys server-side.
- **`server/session.ts`** — `VoiceSession`: one live conversation. Bridges browser ⇄ Deepgram STT ⇄ orchestrator ⇄ TTS; owns turn-taking and **barge-in**; bounds prompt size (`MAX_HISTORY_TURNS = 12`); pipelines TTS per sentence (`server/util/sentenceChunker.ts` + `chunkChannel.ts`) so speech starts before the whole reply is generated. Dependencies are injected (`VoiceSessionDeps`: `startSession`/`stopSession`/`createOrchestrator`) so tests substitute fakes (`server/fakes/`). On connect it starts a Browserbase session (`lib/browser/session`), loads the buyer (`lib/memory/store#loadBuyer`), and `publishPhase`es (`lib/memory/pubsub`).
- **`server/orchestrator/`** — the **seam** between the session and the brain. `types.ts` defines `Orchestrator` (`runTurn(input, ctx, signal): AsyncIterable<Command>`, optional `greeting()`). `loop.ts` `LoopOrchestrator` is the real impl; `stub.ts` is the `USE_STUB` canned impl; `index.ts#createOrchestrator` wires the tools into the brain's executor — `lib/browser/session`, `lib/memory#remember`, and `lib/knowledge#{searchKnowledge,buildAnswerContext}`.
- **`server/brain/`** — the streaming agentic loop. `turn.ts#runTurn` streams Claude (`model.ts#streamWithTools`), yields `say`/`filler` text as it arrives, executes tool calls, feeds results back, and loops. `tools.ts` is the six-tool catalog: **`navigate`**, **`click`**, **`look`** (drive/read the live browser), **`remember`** (persist a buyer note), **`search_knowledge`** (RAG lookup before stating facts), **`set_phase`** (report sales phase, observed not enforced). `executor.ts` routes those calls to browser/memory/knowledge; `messages.ts` builds the system prompt (`buildSystem`) and converts history (`toMessages`).
- **STT/TTS:** `server/deepgram/stt.ts` (`DeepgramStt`, nova-3, VAD + endpointing). `server/tts/` is a routing factory (`index.ts`) over `deepgram.ts`/`openai.ts`/`elevenlabs.ts` behind one `provider.ts` interface; **Mandarin (`zh`) is pinned to OpenAI** because Deepgram Aura has no Mandarin voice. Barge-in lives in `server/bargeIn.ts` (modes `off`/`vad`/`speech`, with echo-word filtering).
- **Demo content/config:** `server/config/demoConfig.ts` wraps **`lib/demoConfig.ts`** — the single source of truth for product content (`PRODUCT_NAME`, `SECTIONS`, `GREETING`, `SYSTEM_PROMPT`). `getDemoConfig(company)` currently only knows `"browserbase"`; adding a company = a new `DemoConfig` + corpus.

### Live-voice wire contract (`lib/voice/messages.ts`)

The isomorphic protocol shared by `server/*` and the browser client (and re-included by `server/tsconfig.json`):

- **Client → server** (`ClientMessage`): `audio_start`/`audio_stop`, `set_language`, `barge_in`, `text_input`, plus raw binary PCM frames.
- **Server → client** (`ServerEvent`): `ready`, `user_said`, `say`, `tts_chunk`, `agent_state`, `screen_is_on`, `remember`, `buyer_loaded`, `set_phase`, `live_view`, `error`.
- **`Command`** is the orchestrator's internal output union (`say`/`filler`/tool effects/`done`). `Language` is `en`/`es`/`zh`; `AUDIO_SAMPLE_RATE = 24000`.

### Frontend

**Buyer flow — single source of truth is `lib/useDemoState.ts`.** It owns UI state in one object and returns a single fully *derived* `DemoVals` (hex colors, formatted clock/labels, callbacks, per-item view models). Screens (`Landing`, `PreCallForm`, `DemoRoom`) receive `vals` and are essentially presentational. When changing what a screen shows, compute the value in `useDemoState` and add a field to `DemoVals` (the typed contract is **`lib/types.ts`**), then read it in the component.

**`DemoRoom.tsx` is now hybrid:** it reads `vals` for layout *and* consumes **`useVoiceAgent()`** (`lib/voice/`) for the live demo — mic capture via `getUserMedia` + an AudioWorklet (`public/worklets/pcm-capture.js`), gapless TTS playback (`audioPlayback.ts#PcmPlayer`), captions/partial-transcript/live-view iframe from server events, language toggle, and `start`/`stop`/`sendText`. The old **CSS-animation auto-advance is gone** — the room is driven by the voice server now, not by `onAnimationEnd`/`vals.advance`. (`moment` state still exists in `useDemoState` but no longer drives the live flow.) `useAgentName()` fetches the persona name from `/api/agent-name`.

**Operator dashboard** (`app/dashboard/**`: overview, `sessions/[id]`, `people/[id]`) renders mock data from `lib/dashboard/data.ts` via `components/dashboard/` (`AskBar`, `LiveNotes`, `SessionList`, `SignalGroup`). Dev tools: `/harness` (text-chat brain tester) and `/sandbox` (manual browser-session tester).

**API routes** (`app/api/`): `auth/[...nextauth]` (Auth.js), `agent-name` (persona name from `AGENT_NAME`/TTS voice), `browser` (Browserbase start/navigate/click/stop, Node runtime), `notes/stream` (bridges the memory Pub/Sub feed to the frontend).

### P4 memory layer (`lib/memory/`)

A self-contained Redis module, public surface in `lib/memory/index.ts`. Now **actively consumed**: the brain's `remember` tool (`server/brain/executor.ts` → `lib/memory/store#remember`), the session loader (`loadBuyer`), `publishPhase`, the `/api/notes/stream` route, and the `enterDemo` form path (`lib/actions.ts`).

- **Identity:** a buyer is keyed by normalized (lowercased/trimmed) email. `keys.ts` builds all `demoless:`-namespaced keys.
- **Storage** (`store.ts`): profile is a Redis **hash** (`demoless:buyer:{email}`); notes are an append-only Redis **stream** (`demoless:buyer:{email}:notes`). `firstSeen`/`visitCount` are init-only (`HSETNX`); `loadBuyer` bumps `visitCount`/`lastSeen`, so `isReturning` = `visitCount > 1`.
- **Recall** (`recall.ts`): `composeRecall` ranks notes by `importance` then recency for the "welcome back…" line; `buildMemoryContext` formats a compact block for the brain's prompt. Plain ranking — no vector search.
- **Live feed** (`pubsub.ts`): every `remember` also `PUBLISH`es on `demoless:notes`; `createNotesSubscriber` (separate ioredis connection) is the bridge the notes-stream route uses.
- **Contracts** (`types.ts`): `RememberCommand` / `BuyerLoadedEvent` / `NoteAddedEvent` — still provisional pending P1B.1 reconciliation.

### Product knowledge / RAG (`lib/knowledge/`)

A **separate** Redis-backed module for answering questions *about the product being demoed*. It is deliberately distinct from `lib/memory`:

| | P4 buyer memory (`lib/memory/`) | Product knowledge (`lib/knowledge/`) |
|---|---|---|
| Answers | *Who* is this buyer? | *What* does the product do? |
| Data | per-buyer notes (small) | company docs (large corpus) |
| Retrieval | importance + recency ranking | **vector / semantic KNN** |
| Key | normalized email | company slug |

This is why only the knowledge layer uses a vector DB. Public surface: `lib/knowledge/index.ts`.

- **Storage:** each doc is chunked (`chunk.ts`), embedded (`embed.ts`), and stored as a Redis **hash** `demoless:kb:{company}:{chunkId}` with a FLOAT32 `vector` field. One RediSearch index `demoless:kb-idx` (HNSW, cosine) spans all companies; a `company` TAG pre-filters — so this **requires Redis Stack** (RediSearch).
- **Embeddings** (`embed.ts`): OpenAI `text-embedding-3-small` (1536-dim) via raw `fetch`. `EMBED_DIM` must match the model and the index.
- **Ingest/search** (`store.ts` + `source.ts`): `indexDocuments(company, docs)` chunks + embeds + stores; `searchKnowledge(company, query, k)` runs the KNN query; `ensureIndex()` is idempotent. Source-of-record CRUD (`putSourceDoc`/`listSourceDocs`/`reindexFromSource`) in `source.ts` keeps authoritative prose separate from derived vectors — edit source, then reindex.
- **Consumer:** the brain's **`search_knowledge`** tool. `buildAnswerContext(hits)` (`answer.ts`) formats the RAG block for the prompt, with **graceful degradation** if Redis Stack is unavailable. The Browserbase corpus lives in `research/browserbase-kb/`; `knowledge:seed` curates 29 pages from `documents.jsonl` via `BROWSERBASE_ALLOWLIST` + writes the authored nav guide, then rebuilds vectors.

### Google auth → memory (currently deferred)

`auth.ts` (repo root) + `components/Providers.tsx` provide Google sign-in scaffolding (Auth.js / NextAuth v5, JWT session, no DB adapter). **But identity is not yet taken from the session.** The pre-call form collects identity (`FormState` has `name`/`email`/`role`/`size`/`useCase`/`pain`), and the `enterDemo(fields)` server action (`lib/actions.ts`) keys the buyer on the **form email** — calling `upsertProfile` + `loadBuyer` and returning `recallLine` for the returning-buyer chip. The code comment marks "NextAuth/Google sign-in deferred to a later phase." A Redis outage is caught and swallowed so the demo still starts.

### Styling

Tailwind with a custom palette as named tokens in `tailwind.config.ts` (`brand`, `ink`, `night`, `muted`, `paper`, etc.). **State-driven colors are applied as inline `style` hex strings computed in `useDemoState`** (e.g. `bg`, `dotBg`, `intentColor`), because they vary per item/state — don't convert those to Tailwind classes. Path alias `@/*` maps to the repo root (`tsconfig.json`).

## Known placeholders / TODO

- **Knowledge ingestion** uses a curated allowlist: `knowledge:seed` reads `research/browserbase-kb/full-docs/documents.jsonl`, filters by `BROWSERBASE_ALLOWLIST` (29 pages), cleans text, writes source-of-record, then rebuilds vectors. Real-time ingestion (file upload / P3 crawl) is still TODO. `research/page-text/` is competitor research, not a runtime dependency.
- **Google auth is not the identity source** yet — the form email is. Sign-in is scaffolding only.
- **Dashboard data is mock** (`lib/dashboard/data.ts`); the buyer demo's `lib/data.ts` is also mock and largely legacy.
- `getDemoConfig` only knows `"browserbase"`; `server/productFacts.ts` is a placeholder; the `lib/memory/types.ts` message contracts are provisional (pending P1B.1).
- **Design references:** `docs/superpowers/specs/2026-06-20-single-brain-convergence-design.md` (the authoritative architecture), `docs/plans/` (execution roadmaps), and `docs/VOICE_AGENT.md` (the P2 voice spec).
