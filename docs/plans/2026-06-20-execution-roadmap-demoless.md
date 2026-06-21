# Demoless — Execution Roadmap

Date: 2026-06-20 · UC Berkeley AI Hackathon 2026 · 4-person team
**Hard deadline: Sun Jun 21, 11:00am PDT** (submit on Devpost) · editing until 12:00pm
Milestones: **MVP draft by midnight** → **full product by 8-9am** → 9-11am rehearse + backup + submit

## The one thing that matters
A prospect clicks "start," and a voice agent gives them a live walkthrough of a real product on screen, answering their questions — and the next time they come back, it remembers them. Everything below is subordinate to that loop working live.

## How to read this
- **Workstream** = one owner's lane. 4 lanes, one per person.
- **Subtask** = a chunky unit (~1-3h). Owner breaks it down and implements it themselves — this doc is the *what*, not the schema.
- **MVP / Full** tags = which milestone the subtask belongs to. MVP = happy path works live. Full = polish, edges, resilience.

## Locked stack (decided)
Deepgram (voice) · Browserbase + Stagehand (drive the real product) · Redis (memory) · Claude (brain) · Simular Sai (research/follow-up, off the live path) · Sentry (observability). Single repo: a web app (the demo surface) + a server that holds the live session.

---

## ▶ Start here (first 90 minutes, before splitting up)
1. **Pick the demo-target product** — one real, visually rich web app you have a login to. Everything trains on this one product. (5 min decision, blocks the KB work.)
2. **Grab all keys** — Deepgram, Browserbase, Redis, Sentry; confirm Sai access at the booth (it's gated).
3. **P1 ships the contract stub** — the shared session interface (events + the action schema the brain emits: `say`, `navigate`, `act`, `answer`, `remember`). Stub it so it logs instead of doing real work. **This is the keystone: once it exists, P2/P3/P4 build against it in parallel instead of waiting on each other.**
4. Then everyone takes their lane.

## Dependency map
```
        ┌─────────────────────────────────────────────┐
        │  P1: ORCHESTRATOR + BRAIN (the contract)      │  ← ships stub first
        │  session state machine · Claude · KB          │
        └───────────┬───────────────┬───────────────┬──┘
                    │               │               │
        ┌───────────▼──┐   ┌────────▼───────┐   ┌───▼──────────────┐
        │ P2: VOICE     │   │ P3: CO-BROWSE  │   │ P4: MEMORY + UI  │
        │ (Deepgram)    │   │ (Browserbase)  │   │ (Redis + screen) │
        └───────────────┘   └────────────────┘   └──────────────────┘
                    └───────────────┴───────────────┘
                         INTEGRATION (all four, ~10pm-midnight)
```
The three lanes are independent once the contract exists. The risk is integration, not any single lane — so P1 protects 10pm-midnight for wiring the real implementations into the stub.

---

## P1 — Orchestrator + Brain (integration owner)
The spine. Decides what the agent says, what it does on screen, and what to remember. Owns the demo working end-to-end.

- **MVP** Session state machine + the action contract (the stub from "start here," now real): greet → discovery question → answer/act loop → wrap.
- **MVP** Claude brain: given the transcript + KB + buyer memory, produce the next thing to say and the next action to take.
- **MVP** KB ingestion for the one demo-target product: scrape its site/docs into something the brain can pull from (P4's retrieval, or a flat context to start).
- **MVP** Wire the three lanes together: voice in → brain → action out → screen + spoken reply.
- **Full** Signal extraction: a lightweight parallel pass that pulls objections / interests / sentiment from the transcript and hands them to P4 to store.
- **Full** Own the demo runbook + rehearsal; keep one deterministic happy-path script the agent follows on stage.

## P2 — Voice agent (Deepgram)
The conversation. The prospect talks, the agent talks back, naturally.

- **MVP** Real-time voice loop: mic → transcription → brain → spoken reply, low latency.
- **MVP** Agent answers one real product question out loud (proves the loop).
- **Full** Barge-in / interruption handling so the prospect can cut in mid-sentence.
- **Full** Tighten latency + voice quality; pick a good voice.
- **Stretch** Multilingual toggle (one extra language) if time.

## P3 — Live product co-browse (Browserbase)
The wow. The real product moving on screen while the agent narrates.

- **MVP** Spin up a streamed browser session, navigate + log into the demo-target product.
- **MVP** Embed the live session view in the demo surface so the prospect watches it.
- **MVP** Map each brain action to a real move on the product (scripted happy path through the key flow).
- **Full** One off-script action — agent handles a question that requires navigating somewhere unplanned.
- **Full** Fallback path: a pre-loaded clickable mock or recorded screen the agent narrates over, in case the live drive is flaky on stage.

## P4 — Memory + Frontend (the demo surface)
The differentiator + everything the audience sees.

- **MVP** Redis memory: store per-buyer context and the running conversation signals; read it back into the brain mid-session.
- **MVP** Demo surface: a launch screen ("start a demo"), the live-product view, and a voice indicator. Clean, not fancy.
- **MVP** Buyer-context panel beside the product view that fills in as the conversation happens (visible memory).
- **Full** Cross-session recall: persist the buyer, and on a second session the agent opens with "welcome back, last time you cared about X." This is the kicker — protect time for it.
- **Full** End-of-demo recap screen: what the prospect cared about, objections raised, suggested next step.
- **Full** Polish pass: launch screen, a seeded activity feed for stage flavor, recap layout.

## Shared edges (assign once cores are landing — not before)
- **Sai brackets (Full):** before-demo research dossier on the prospect, and after-demo follow-up draft. Runs off the live path — pre-bake the outputs so the stage never waits on a live Sai run. Natural fit for P3 (also a browser/agent tool).
- **Observability (Full):** Sentry across the server + frontend so errors/traces are captured. ~30-45 min. Natural fit for P2 (touches the whole loop).

---

## Timeline
- **Now → +90 min:** start-here block (target picked, keys grabbed, contract stub shipped). Then split.
- **+90 min → ~10pm:** each lane builds its MVP slice independently against the contract.
- **~10pm → midnight:** P1 leads integration — wire real voice + co-browse + memory into the spine. **MVP gate: the hot path runs end-to-end on the happy path.**
- **Midnight → ~4am:** Full slices — cross-session recall, recap, off-script action, fallback path, UI polish.
- **~4am → 8am:** edges (Sai brackets, Sentry), seeded feed, second polish; everyone converges on bugs.
- **8-9am:** **Full gate: rehearse end-to-end 3×.** Plant the discovery question so the live path is deterministic.
- **9-11am:** record the **backup demo video** (non-negotiable — realtime voice+browser breaks on stage at least once), write the Devpost submission, submit by **11am**.

## Risk + cut rules
- **Integration is the risk, not any one lane.** The contract-stub-first move is what de-risks it; if a lane slips, it slips alone instead of blocking the others.
- **Deterministic over autonomous on stage.** Scripted happy path for the demo; reserve "agent figures it out" for one off-script moment.
- **Backup video always.** If live breaks, you still have a demo.
- **Cut order if behind:** Sai follow-up → Sai research → seeded feed → recap polish → off-script action → live co-browse (fall back to recorded narration).
- **Never cut:** voice answering one real question + the real product visibly moving + memory filling the context panel + the second-session "welcome back." That sequence is the whole product.

## Open decisions (make these tonight)
1. Which product does the agent demo? (blocks KB + co-browse)
2. Does the live session drive the *real* product or a controlled copy/sandbox of it? (affects login + reliability)
3. Cross-session recall: real persistence, or a pre-seeded "returning buyer" for the stage? (either is fine; decide so P4 isn't guessing)
