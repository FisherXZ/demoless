# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Demoless is an AI agent platform that runs live product demos for companies 24/7 (see `BRAINSTORM.txt` for the product vision, which breaks the work into tracks P1–P5). The repo is mostly the **frontend prototype**: a Next.js 15 (App Router) + TypeScript + Tailwind single-page app with four state-driven screens and mock data. The non-UI code is the **P4 memory layer** (`lib/memory/`), a standalone Redis module, plus **Google auth** (Auth.js) which is the one place the frontend is wired to a real backend: signing in persists the verified buyer into the memory layer via a server action.

## Commands

```bash
npm install
npm run dev      # dev server at http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # next lint

# Redis-backed layers — need a Redis instance (REDIS_URL, see .env.example).
# Vector search (lib/knowledge) needs Redis Stack; it's a superset, so use it for both.
docker run -d -p 6379:6379 redis/redis-stack:latest        # local Redis + Search
REDIS_URL=redis://localhost:6379 npm run memory:smoke      # P4 memory smoke test

# Product-knowledge RAG (lib/knowledge) — also needs OPENAI_API_KEY for embeddings
npm run knowledge:seed     # index the sample product corpus
npm run knowledge:smoke    # end-to-end semantic-retrieval smoke test
```

Google sign-in needs OAuth credentials in `.env.local` (gitignored; placeholders in `.env.example`): `AUTH_SECRET` (`npx auth secret`), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` from a Google Cloud OAuth 2.0 Web client whose redirect URI is `http://localhost:3000/api/auth/callback/google`. Without these, the dev server runs but the sign-in flow fails.

There is no unit-test runner. The automated checks are standalone smoke scripts run against a live Redis: `scripts/memory-smoke.ts` (`npm run memory:smoke`) for the P4 memory layer, and `scripts/knowledge-smoke.ts` (`npm run knowledge:smoke`) for the product-knowledge RAG layer (the latter also needs `OPENAI_API_KEY` and Redis Stack).

## Architecture

The whole app is a single client-rendered page with no routing. `app/page.tsx` calls `useDemoState()` once and switches between four screen components based on `vals.screen` (`landing` | `form` | `room` | `dashboard`). `PrototypeNav` (bottom-left) renders on every screen and lets you jump between them. The only server-side surfaces are the Auth.js route (`app/api/auth/[...nextauth]/`) and the `enterDemo` server action (`lib/actions.ts`); `app/layout.tsx` wraps everything in `components/Providers.tsx` (`<SessionProvider>`).

**Single source of truth: `lib/useDemoState.ts`.** This hook owns all UI state in one `useState` object and returns a single `DemoVals` object — not just raw state, but fully *derived* view values: hex colors, formatted clock/labels, percentage strings, callbacks, and per-item view models (`sectionItems`, `columns`, `sel`). Every screen component receives the entire `vals: DemoVals` object as its only prop and is essentially presentational. This deliberately mirrors the original design export's `renderVals()` pattern.

When changing what a screen displays, the logic almost always belongs in `useDemoState.ts` (compute and add a field to the returned object), not in the component. The component just reads `vals.someField`.

**The typed contract is `lib/types.ts`.** `DemoVals` is the interface every screen depends on. Adding UI that needs new derived data means: add the field to `DemoVals`, compute it in `useDemoState`, then consume it. Keep these in sync.

**Mock data lives in `lib/data.ts`**: `SECTIONS`, `CAPTIONS`, `LEADS`, `PIPELINE`, plus helpers (`STAGE_COLOR`, `scoreColor`, `intentMeta`). Swapping in a real backend means replacing reads of these constants inside `useDemoState`.

### Demo room flow (non-obvious)

The demo room (`components/DemoRoom.tsx`) walks through 8 "moments" (`moment` 0–7). `moment === 7` (`isConvert`) shows the convert overlay. Auto-advance is **driven by CSS animation**, not a JS timer: the progress bar's `onAnimationEnd={vals.advance}` fires when its animation completes, incrementing `moment`. Pausing (`togglePause`) pauses the animation rather than clearing an interval.

### P4 memory layer (`lib/memory/`)

A self-contained Redis module — **not wired into the frontend**. It exists to be imported by P1's server (which doesn't exist yet) and is verified in isolation via the smoke test. Public surface is `lib/memory/index.ts`.

- **Identity**: a buyer is keyed by normalized (lowercased/trimmed) email from the pre-call form. `keys.ts` builds all `demoless:`-namespaced keys.
- **Storage** (`store.ts`): profile is a Redis **hash** (`demoless:buyer:{email}`); notes are an append-only Redis **stream** (`demoless:buyer:{email}:notes`). `firstSeen`/`visitCount` are init-only (`HSETNX`); `loadBuyer` bumps `visitCount`/`lastSeen` on each call, so `isReturning` = `visitCount > 1`.
- **Recall** (`recall.ts`): `composeRecall` ranks notes by `importance` then recency to build the "welcome back…" line; `buildMemoryContext` formats a compact block for P1C's prompt. Plain ranking only — no vector/semantic search.
- **Live feed** (`pubsub.ts`): every `remember` also `PUBLISH`es a `note_added` event on the `demoless:notes` channel. `createNotesSubscriber` (uses a separate ioredis connection, since a subscribed client can't issue commands) is what P1's server bridges to a WebSocket for the P5 panel.
- **Contracts** (`types.ts`): `RememberCommand` / `BuyerLoadedEvent` / `NoteAddedEvent` are the integration seam with other tracks and **must be reconciled with P1B.1's shared message types** once those land.

### Product knowledge / RAG (`lib/knowledge/`)

A second, **separate** Redis-backed module for answering buyers' questions *about the product being demoed* (retrieval-augmented generation). It is deliberately distinct from `lib/memory` — different question, data, retrieval, and key:

| | P4 buyer memory (`lib/memory/`) | Product knowledge (`lib/knowledge/`) |
|---|---|---|
| Answers | *Who* is this buyer? | *What* does the product do? |
| Data | per-buyer notes (small) | company docs (large corpus) |
| Retrieval | importance + recency ranking | **vector / semantic KNN** |
| Key | normalized email | company slug |

This is why only the knowledge layer uses a vector DB: semantic search earns its keep over a large doc corpus, whereas a buyer's handful of notes rank fine without it. Public surface is `lib/knowledge/index.ts`.

- **Storage**: each document is chunked (`chunk.ts`), embedded (`embed.ts`), and stored as a Redis **hash** `demoless:kb:{company}:{chunkId}` with the embedding in a `vector` FLOAT32 field. A single RediSearch index `demoless:kb-idx` (HNSW, cosine) spans all companies; a `company` TAG field pre-filters queries — so this **requires Redis Stack** (RediSearch), not plain `redis:7`.
- **Embeddings** (`embed.ts`): OpenAI `text-embedding-3-small` (1536-dim) via raw `fetch`, no SDK. `EMBED_DIM` must match both the model and the index schema.
- **Ingest/search** (`store.ts`): `indexDocuments(company, docs)` builds the index (seeded by `scripts/knowledge-seed.ts`); `searchKnowledge(company, query, k)` runs the KNN query; `ensureIndex()` is idempotent and throws a clear "needs Redis Stack" error if FT.* is missing.
- **Prompt block** (`answer.ts`): `buildAnswerContext(hits)` is the RAG counterpart to `buildMemoryContext` — P1C injects both into Claude's prompt (one grounds *who*, the other grounds *what*).
- **Ownership**: retrieval arguably belongs to the "brain" (P1C) rather than P4 — coordinate before wiring so it isn't built twice.

### Google auth → memory (the one real backend path)

Auth.js (NextAuth v5) provides Google sign-in and is the only flow that touches a real backend end-to-end. `auth.ts` (repo root) exports `handlers`/`signIn`/`signOut`/`auth`; the route handler re-exports `handlers`. Session is JWT — no DB adapter.

- **Identity is verified, not typed.** The pre-call form no longer has name/email inputs; `FormState` holds only `role`/`size`/`useCase`/`pain`. `useDemoState` calls `useSession()` and exposes `isAuthed`, `authEmail`, `authName`, `signInGoogle`, `signOutGoogle`, `canStart`, and `recallLine` on `DemoVals`. The **Join AI Demo** button is gated on `canStart` (= signed in).
- **`startDemo` is async.** When authed it `await`s `enterDemo({ role, size, useCase })` (the server action in `lib/actions.ts`) before switching to the room. `enterDemo` reads email/name from the **server-verified session** (never client input), calls the P4 layer's `upsertProfile` + `loadBuyer`, and returns `recallLine` for the returning-buyer chip in `DemoRoom`. A Redis outage is caught and swallowed so the demo still starts.
- This is the first consumer of `lib/memory`; the gate lives only on the form's Join button — `PrototypeNav` still jumps straight to any screen (dev shortcut).

### Styling

Tailwind with a custom palette defined as named tokens in `tailwind.config.ts` (`brand`, `ink`, `night`, `muted`, `paper`, etc.). However, **state-driven colors are applied as inline `style` hex strings computed in `useDemoState`** (e.g. `bg`, `dotBg`, `intentColor`), because they vary per item/state. Don't try to convert those to Tailwind classes — they're dynamic by design.

Path alias `@/*` maps to the repo root (`tsconfig.json`).

## Known placeholders

- The AI rep avatar is a placeholder in `PreCallForm.tsx` and `DemoRoom.tsx` (the design export had no headshot).
- The dashboard/demo-room screens still render mock data (`lib/data.ts`); only the sign-in → buyer-profile path is wired to `lib/memory`. Notes (`remember`) and the live feed have no producer/consumer in the UI yet.
- `lib/knowledge` has no consumer yet either — it's verified by `knowledge:smoke` and pre-loaded by `knowledge:seed` (a sample Demoless corpus). Real content ingestion (file upload / P3 crawl) and the P1C question-answering wiring are still to come.
- The message contracts in `lib/memory/types.ts` are still provisional pending P1B.1.
