# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Demoless is an AI agent platform that runs live product demos for companies 24/7 (see `BRAINSTORM.txt` for the product vision, which breaks the work into tracks P1–P5). The repo is mostly the **frontend prototype**: a Next.js 15 (App Router) + TypeScript + Tailwind single-page app with four state-driven screens and mock data. There is no app server yet — the only non-frontend code so far is the **P4 memory layer** (`lib/memory/`), a standalone Redis module meant to be imported by P1's future server.

## Commands

```bash
npm install
npm run dev      # dev server at http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # next lint

# P4 memory layer — needs a Redis instance (REDIS_URL, see .env.example)
docker run -d -p 6379:6379 redis:7        # local Redis
REDIS_URL=redis://localhost:6379 npm run memory:smoke   # end-to-end smoke test
```

There is no unit-test runner. The only automated check is `scripts/memory-smoke.ts` (run via `npm run memory:smoke`), which exercises the memory layer against a live Redis.

## Architecture

The whole app is a single client-rendered page with no routing. `app/page.tsx` calls `useDemoState()` once and switches between four screen components based on `vals.screen` (`landing` | `form` | `room` | `dashboard`). `PrototypeNav` (bottom-left) renders on every screen and lets you jump between them.

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

### Styling

Tailwind with a custom palette defined as named tokens in `tailwind.config.ts` (`brand`, `ink`, `night`, `muted`, `paper`, etc.). However, **state-driven colors are applied as inline `style` hex strings computed in `useDemoState`** (e.g. `bg`, `dotBg`, `intentColor`), because they vary per item/state. Don't try to convert those to Tailwind classes — they're dynamic by design.

Path alias `@/*` maps to the repo root (`tsconfig.json`).

## Known placeholders

- The AI rep avatar is a placeholder in `PreCallForm.tsx` and `DemoRoom.tsx` (the design export had no headshot).
- The frontend still runs on mock data (`lib/data.ts`); it is **not** connected to the `lib/memory` layer or any API/auth.
- `lib/memory` has no consumer yet — there's no server importing it, and the message contracts in `lib/memory/types.ts` are provisional pending P1B.1.
