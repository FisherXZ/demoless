# Demoless — Task Breakdown

Date: 2026-06-20 · UC Berkeley AI Hackathon 2026 · 4-person team
**Hard deadline: Sun Jun 21, 11:00am PDT** (submit on Devpost) · editing until 12:00pm
Status: Draft for the team (local md). Supersedes `2026-06-20-execution-roadmap-demoless.md`.
Demo target: **Browserbase** (chosen Jun 20, 2026)

## The one thing that matters
A prospect clicks "start," a voice agent gives them a live walkthrough of a **real product on screen**, answers their questions out loud — and the next time they come back, **it remembers them**. Everything below is subordinate to that loop running live on stage.

## How to read this
- **Cluster** = one of the 5 sections (a person's lane). P1's first two slices (setup + Loop stub) come first; the rest run in parallel.
- **Slice** = a chunk that's demoable on its own. The unit you'd publish as an issue.
- **Task** = a ~1–2hr piece of work inside a slice. The unit you actually grab and do.
- **Blocked by** = what has to exist first. Slices inside a section run top-to-bottom; lanes run in parallel once P1's Loop stub (P1B) ships.

## Locked stack
Deepgram (voice) · Browserbase + Stagehand (drive the real product, built-in live-view URL) · Redis (memory) · an LM (the reasoning) · Simular Sai (research/follow-up, off the live path) · Sentry (errors). Single repo: one web app (what the prospect sees) + one server (runs the loop, holds the live browser).

## The 5 clusters (and who owns them)
| # | Cluster | What it does | Owner note |
|---|---------|--------------|------------|
| **P1** | Orchestrator + Memory Context Layer | The loop: hears the user, assembles context, asks the LM what to do, sends out commands. Also owns kickoff setup. | also integration owner |
| **P2** | Voice Agent | Speech → text, and the agent's text → speech | — |
| **P3** | Live Product Demo Stream Room | Opens the real product in a cloud browser, clicks/types, streams the screen | — |
| **P4** | Memory | Saves what we learn about each buyer to Redis, reads it back | **same owner as P5** |
| **P5** | Frontend | The page: start button, streamed product, "speaking" indicator, memory panel, recap | **same owner as P4** |

> 4 people, 5 clusters: **P4+P5 are one owner** (the memory panel is just part of the page). If you're actually 5, split them.

## The core idea — one loop, one shared message list
The whole product is **one loop** on the server: hear the user → assemble context → ask the LM → run the commands the LM returns → repeat.

```
   1. Prospect says something          (P2: speech → text)
   2. The memory context layer hands the LM everything it knows:
        conversation + product facts + buyer memory
   3. The LM returns a short list of commands:  "say this" + "click into the dashboard"
   4. Run each command:  P2 speaks,  P3 clicks,  P4 saves a note
   5. Back to step 1.
```

The four other lanes never talk to each other — they only talk to the loop, through one shared file listing every message. P1 ships that file first as a fake version that just console.logs. Then everyone builds against it at once.

```ts
// Messages INTO the loop
type Incoming =
  | { kind: 'user_said'; text: string; final: boolean }     // from P2
  | { kind: 'screen_is_on'; url: string; summary: string }  // from P3, after each move
  | { kind: 'buyer_loaded'; buyer: Buyer }                  // from P4, when a demo starts

// Commands OUT of the loop
type Command =
  | { kind: 'say'; text: string }                  // P2 speaks
  | { kind: 'navigate'; target: string }           // P3 goes to a page/url
  | { kind: 'click_or_type'; instruction: string } // P3 does it (Stagehand reads plain English)
  | { kind: 'remember'; note: Note }               // P4 saves it

type Buyer = { id: string; name?: string; lastSeen?: string; notes: Note[] }
type Note  = { type: 'objection'|'interest'|'role'|'question'; value: string; at: string }

interface Loop {
  send(msg: Incoming): void                      // lanes push messages in
  onCommand(cb: (c: Command) => void): void      // lanes listen for their commands
}
```

## Dependency map
```
P1A setup + P1B Loop stub ── unblocks everything
      │
      ├──► P2 Voice ─────┐
      ├──► P3 Room ──────┤
      ├──► P4 Memory ────┼──► P1 wires the real loop ──► full demo
      └──► P5 Frontend ──┘         (needs P2+P3+P4 slices landing)
```

---

# P1 — Orchestrator + Memory Context Layer (integration owner)

## P1A — Target picked, keys in hand, repo runs
Blocked by: none

**What to build:** Decide the one demo-target product, collect every API key, and get the empty repo (web app + server) running locally for everyone. (P1A.1–.2 are a team-wide kickoff; P1 drives them.)

**Acceptance criteria:**
- [x] One demo-target product chosen and written at the top of this doc
- [ ] Deepgram / Browserbase / Redis / Sentry keys in `.env`; Sai access confirmed at the booth
- [ ] `npm run dev` runs the web app + server locally for all four people

**Tasks:**
- [x] P1A.1 Pick the demo-target product (5-min team decision)
- [ ] P1A.2 Grab all keys + `.env.example` (~30m)
- [ ] P1A.3 Repo skeleton: web app + server, runs locally (~1h)

## P1B — The Loop stub + shared message list (the keystone)
Blocked by: P1A

**What to build:** The `Loop` interface and the `Incoming` / `Command` types in a shared file, shipped as a stub that console.logs every message and command. This is what unblocks all four lanes.

**Acceptance criteria:**
- [ ] `Incoming` / `Command` / `Buyer` / `Note` types committed in a shared module every lane imports
- [ ] `Loop.send()` and `Loop.onCommand()` exist; the stub logs everything
- [ ] Firing a fake `user_said` prints a fake `say` + `navigate` command to the console

**Tasks:**
- [ ] P1B.1 Define the shared message types (~45m)
- [ ] P1B.2 `Loop` stub that logs every message/command (~1h)
- [ ] P1B.3 Tiny harness: fire a fake `user_said`, print the commands (~30m)

**KEYSTONE DEMO:** fire a fake "user said X" at the stub, watch it log a "say" + "navigate" command. The spine works; nothing real yet. Now the other lanes split off.

## P1C — Real LM loop
Blocked by: P1B

**What to build:** Replace the stub's fake reply with a real LM call: the memory context layer assembles the context, the LM returns a list of commands, validate them against the contract.

**Acceptance criteria:**
- [ ] A real `user_said` produces real `say` + `navigate`/`click_or_type` commands from the LM
- [ ] Commands validate against the `Command` type before going out
- [ ] A phase flag moves GREET → ASK ONE QUESTION → DEMO → WRAP → DONE

**Tasks:**
- [ ] P1C.1 Memory context layer: assemble conversation + product facts + buyer memory into the prompt (~1.5h)
- [ ] P1C.2 LM call + parse reply into `Command[]` (~1.5h)
- [ ] P1C.3 Phase flag driving the conversation arc (~1h)

## P1D — Product facts (KB)
Blocked by: P1A

**What to build:** Scrape the demo-target's site/docs into a blob of text the LM reads.

**Acceptance criteria:**
- [x] The LM can answer a basic product question from the blob
- [x] The blob is loaded into the memory context layer each turn

**Tasks:**
- [x] P1D.1 Scrape/collect the product's docs into text (~1.5h)
- [x] P1D.2 Load the blob into the memory context layer (~30m)

**Output:** Browserbase raw scrape: `research/browserbase-kb/`; prompt-loaded facts blob: `product/facts.md`; Browserbase walkthrough catalog: `product/catalog.ts`.

## P1E — Wire the real loop (integration)
Blocked by: P1C, and P2A + P3B + P4A landing

**What to build:** Swap the stub for the real `Loop` and connect real voice, browser, and memory.

**Acceptance criteria:**
- [ ] Whole thing runs end-to-end on the happy path: speak → product moves → agent replies
- [ ] One scripted happy path the agent walks every time

**Tasks:**
- [ ] P1E.1 Replace the stub with the real loop (~1h)
- [ ] P1E.2 Connect P2 + P3 + P4 to the loop (~2h)
- [ ] P1E.3 Write the on-stage happy-path script (~1h)

## P1F — Signal spotting
Blocked by: P1C, P4A

**What to build:** A side pass that reads the conversation and fires `remember` for objections / interests / role / questions.

**Acceptance criteria:**
- [ ] A mentioned objection becomes a `remember` command to P4
- [ ] Spotting runs without slowing the main reply

**Tasks:**
- [ ] P1F.1 Extraction pass over the transcript (~1.5h)
- [ ] P1F.2 Fire `remember` with the right note type (~30m)

---

# P2 — Voice Agent (Deepgram)
Listens for `say`; sends in `user_said`.

## P2A — Voice in / out loop
Blocked by: P1B

**What to build:** Mic → Deepgram speech-to-text → `send(user_said)`; on a `say` command, speak it.

**Acceptance criteria:**
- [ ] Speaking a sentence logs a `user_said` message (final=true when they stop)
- [ ] A `say` command is spoken aloud, low latency

**Tasks:**
- [ ] P2A.1 Mic capture + Deepgram STT (~2h)
- [ ] P2A.2 `send(user_said)` on transcript (~30m)
- [ ] P2A.3 Text-to-speech on `say` (~1.5h)

## P2B — One real answer, end-to-end
Blocked by: P2A, P1C

**What to build:** Prove the whole loop with one real product question answered out loud.

**Acceptance criteria:**
- [ ] Ask a product question by voice → hear a correct spoken answer

**Tasks:**
- [ ] P2B.1 Run one question through the real loop and tune it (~1h)

## P2C — Barge-in + voice polish
Blocked by: P2A

**Acceptance criteria:**
- [ ] Prospect can interrupt mid-sentence and the agent stops
- [ ] Latency tuned; a good voice picked

**Tasks:**
- [ ] P2C.1 Barge-in / interruption handling (~2h)
- [ ] P2C.2 Latency tune + voice selection (~1h)

## P2D — Second-language toggle (stretch)
Blocked by: P2A

**Tasks:**
- [ ] P2D.1 One extra language toggle (~1.5h)

---

# P3 — Live Product Demo Stream Room (Browserbase + Stagehand)
Listens for `navigate` + `click_or_type`; sends in `screen_is_on`.

> Don't build streaming yourself — Browserbase gives you a **live-view URL**. P5 embeds it; P3 owns what happens inside the browser.

## P3A — Cloud browser + login
Blocked by: P1A

**Acceptance criteria:**
- [ ] A streamed Browserbase browser opens and logs into the demo-target product

**Tasks:**
- [ ] P3A.1 Open a Browserbase session (~1.5h)
- [ ] P3A.2 Navigate + log into the product (~1.5h)

## P3B — Command handlers
Blocked by: P3A, P1B

**What to build:** Handle `navigate` (go to a page) and `click_or_type` (Stagehand reads the plain-English instruction and figures out the click), and report back.

**Acceptance criteria:**
- [ ] `navigate` and `click_or_type` move the real product through the main flow
- [ ] After each move, `send(screen_is_on)` with the current page

**Tasks:**
- [ ] P3B.1 `navigate` handler (~1h)
- [ ] P3B.2 `click_or_type` via Stagehand (~2h)
- [ ] P3B.3 Emit `screen_is_on` after each move (~45m)

## P3C — Embed the live view
Blocked by: P3A

**Acceptance criteria:**
- [ ] P5 can embed the live-view URL and the prospect watches it move

**Tasks:**
- [ ] P3C.1 Expose the live-view URL to the frontend (~45m)

## P3D — Off-script move
Blocked by: P3B

**Acceptance criteria:**
- [ ] The agent handles one question that needs navigating somewhere not in the script

**Tasks:**
- [ ] P3D.1 Let `click_or_type` go off-script for one flow (~1.5h)

## P3E — Fallback (recorded screen / mock)
Blocked by: P3B

**Acceptance criteria:**
- [ ] A pre-recorded screen or clickable mock the agent narrates over, if the live browser is flaky on stage

**Tasks:**
- [ ] P3E.1 Record/build the fallback + a switch to it (~2h)

---

# P4 — Memory (Redis)
Listens for `remember`; sends in `buyer_loaded` when a demo starts.

## P4A — Store + load buyer
Blocked by: P1B

**What to build:** Redis store for each buyer (info + notes); write on `remember`, and `send(buyer_loaded)` when a demo starts.

**Acceptance criteria:**
- [ ] A `remember` command writes a note to the buyer in Redis
- [ ] On demo start, the buyer is looked up and `buyer_loaded` is sent so the LM can personalize

**Tasks:**
- [ ] P4A.1 Redis buyer store + write on `remember` (~1.5h)
- [ ] P4A.2 Look up buyer + `send(buyer_loaded)` on start (~1h)

## P4B — Read memory mid-demo
Blocked by: P4A, P1C

**Acceptance criteria:**
- [ ] Stored notes are fed back into the memory context layer during the demo

**Tasks:**
- [ ] P4B.1 Wire buyer notes into the loop's context (~1h)

## P4C — Remember across visits (the kicker)
Blocked by: P4A

**Acceptance criteria:**
- [ ] A second session opens with "welcome back, last time you cared about X"

**Tasks:**
- [ ] P4C.1 Persist buyer across sessions + last-seen (~1.5h)
- [ ] P4C.2 Compose the "welcome back" recall into the greeting (~1h)

## P4D — Live notes feed to the panel
Blocked by: P4A

**Tasks:**
- [ ] P4D.1 Push notes to P5 as they're saved (~1h)

---

# P5 — Frontend (what the prospect sees)
Listens for `buyer_loaded`, `screen_is_on`, and the notes stream. Same owner as P4.

## P5A — The page
Blocked by: P1A (P3C for the embed)

**Acceptance criteria:**
- [ ] A start screen with a "start a demo" button
- [ ] The live product embedded (P3's live-view URL) + a "speaking…" indicator

**Tasks:**
- [ ] P5A.1 Start screen + launch (~1h)
- [ ] P5A.2 Embed the live product + speaking indicator (~1.5h)

## P5B — Buyer panel (visible memory)
Blocked by: P5A, P4D

**Acceptance criteria:**
- [ ] A panel beside the product fills in as notes arrive — you can see it remembering

**Tasks:**
- [ ] P5B.1 Buyer panel rendering from the notes stream (~1.5h)

## P5C — Welcome-back UI
Blocked by: P5A, P4C

**Acceptance criteria:**
- [ ] The "welcome back" line shows for a returning buyer

**Tasks:**
- [ ] P5C.1 Returning-buyer state in the UI (~1h)

## P5D — Recap screen
Blocked by: P5A

**Acceptance criteria:**
- [ ] End-of-demo recap: what they cared about, what they pushed back on, suggested next step

**Tasks:**
- [ ] P5D.1 Recap layout from the buyer's notes (~1.5h)

## P5E — Polish
Blocked by: P5A

**Tasks:**
- [ ] P5E.1 Start-screen polish + a fake activity feed for stage flavor (~1.5h)

**FULL DEMO:** a fresh prospect starts a demo, asks questions by voice, watches the real product move, sees the panel fill with what they care about, ends with a recap. Then they "come back" and the agent greets them by what they cared about last time.

---

# Shared edges (assign once the cores work — not before)

## S1 — Sai brackets (pre-baked)
Blocked by: cores landing · Owner: P3

**What to build:** A pre-demo research write-up on the prospect + a post-demo follow-up email. Runs off the live path — **make them ahead of time** so the stage never waits on a live Sai run.

**Tasks:**
- [ ] S1.1 Pre-bake a research dossier (~1h)
- [ ] S1.2 Pre-bake a follow-up email draft (~1h)

## S2 — Sentry
Blocked by: cores landing · Owner: P2

**Tasks:**
- [ ] S2.1 Sentry on server + frontend (~45m)

---

## Timeline
- **Now → +90 min:** P1A + P1B (target, keys, Loop stub). Then split.
- **+90 min → ~10pm:** P2A, P3A/P3B, P4A, P5A in parallel against the stub.
- **~10pm → midnight:** P1E wires the real loop. **Gate: end-to-end on the happy path.**
- **Midnight → ~4am:** P4C (welcome back), P5B/P5C/P5D, P3D, P3E, P1F.
- **~4am → 8am:** S1, S2, P5E, P2C; converge on bugs.
- **8-9am:** **Gate: rehearse end-to-end 3×.** Plant the discovery question.
- **9-11am:** record the **backup demo video** (non-negotiable), write the Devpost submission, **submit by 11am**.

## Cut rules
- **The risk is wiring it together, not any one lane.** The Loop-stub-first move de-risks it — a slipping lane slips alone.
- **Scripted beats improvised on stage.** Save "the agent figures it out live" for the one off-script move (P3D).
- **Backup video always.**
- **Cut order if behind:** S1 → fake feed (P5E) → recap (P5D) → off-script (P3D) → live browser (fall back to P3E recording).
- **Never cut:** voice answering one real question (P2B) + the real product visibly moving (P3B) + the panel filling with memory (P5B) + the second-visit welcome back (P4C/P5C). That sequence is the whole product.

## Counts (rough)
- Clusters: 5 + Shared edges
- Slices: 22
- Tasks: ~45 at ~1–2hr each

## Open decisions (make these tonight — they block work)
1. **Which product does the agent demo?** Blocks P1A, P1D, P3A. (5-min call.)
2. **Real product, or a controlled copy/sandbox?** Affects P3A login + reliability.
3. **Remember-across-visits: really persist it, or fake a returning buyer for the stage?** Either is fine — decide so P4C isn't guessing.
4. **Team of 4 or 5?** Decides whether P4+P5 share an owner.
