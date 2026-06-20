# Demoless P2 - Voice Agent

The voice layer for Demoless: it lets a prospect talk to "Maya" (the AI rep) by
voice and hear spoken answers, with barge-in and a language toggle. It is built
as a self-contained, mergeable slice so it drops in alongside P1 (LLM loop),
P3 (browser), P4 (memory), and P5 (frontend).

## What's here (P2A-P2D)

| Spec | Acceptance criteria | Where it lives | Status |
|------|---------------------|----------------|--------|
| P2A.1 | Mic capture + Deepgram STT | `public/worklets/pcm-capture.js`, `lib/voice/useVoiceAgent.ts`, `server/deepgram/stt.ts` | Done |
| P2A.2 | `user_said` emitted on transcript; `final=true` when the user stops | `server/session.ts` (`onTranscript` / `endUtterance`) | Done |
| P2A.3 | A `say` command is spoken aloud, low latency | `server/tts/*`, `lib/voice/audioPlayback.ts` | Done |
| P2B | Voice question -> real loop -> correct spoken answer | `server/orchestrator/stub.ts` + `server/productFacts.ts` | Done (stub loop) |
| P2C | Barge-in mid-sentence; agent stops; latency tuned; good voice | `bargeIn()` in `server/session.ts`, `PcmPlayer.stop()`, Aura-2 voice | Done |
| P2D | One extra language can be toggled | `LANGUAGES` in `lib/voice/messages.ts`, toggle in `DemoRoom.tsx` | Done |

## Architecture

```
Browser (DemoRoom)                         Voice gateway (Node, :3001)            Deepgram / Anthropic
------------------                         ---------------------------            --------------------
mic -> AudioWorklet (linear16 24k) --PCM--> VoiceSession -> DeepgramStt  --------> Listen v1 (nova-3)
                                                  |  user_said (final)
                                                  v
                                            Orchestrator (stub: Claude) ---------> Anthropic messages
                                                  |  say (per sentence)
                                                  v
PcmPlayer (Web Audio queue) <--tts_chunk--- TtsProvider (Aura-2 REST) ----------> Speak v1 (aura-2)
```

- The browser only ever talks to our gateway over one WebSocket. Deepgram and
  Anthropic keys stay server-side.
- Mic audio goes up as binary PCM frames; control + synthesized audio come down
  as JSON (audio is base64 inside `tts_chunk`).

## Files

### Shared contract
- `lib/voice/messages.ts` - the single source of truth for the wire protocol
  (client <-> server) and the orchestrator `Command` shape. Isomorphic: both
  the browser (`@/lib/voice/messages`) and the server import it.

### Server (`server/`, run with `tsx`)
- `index.ts` - WebSocket gateway; one `VoiceSession` per connection.
- `session.ts` - the heart of P2: STT -> orchestrator -> TTS glue, turn-taking,
  and barge-in.
- `deepgram/stt.ts` - Deepgram Listen v1 (nova-3) streaming wrapper. Emits
  interim/final transcripts, `SpeechStarted` (VAD), and `UtteranceEnd`.
- `orchestrator/` - the **P1 boundary**:
  - `types.ts` - the `Orchestrator` interface.
  - `stub.ts` - `StubOrchestrator`, a thin streaming Claude call over the
    product-facts blob. **This is the only thing P1 replaces.**
  - `index.ts` - `createOrchestrator()` (swap point).
- `tts/` - provider-agnostic TTS:
  - `index.ts` - `TtsProvider` interface + `createTts()` factory.
  - `deepgram.ts` - Aura-2 via REST streaming (default).
  - `elevenlabs.ts` - optional ElevenLabs provider (`TTS_PROVIDER=elevenlabs`).
- `productFacts.ts` - placeholder knowledge blob (swappable with P1D).
- `tsconfig.json` - Node typecheck config for the server.

### Client (`lib/voice/`, `public/worklets/`)
- `useVoiceAgent.ts` - React hook: mic capture, the gateway socket, playback,
  and exposed state (`status`, `partialTranscript`, `lastCaption`,
  `agentSpeaking`, `language`, `start`, `stop`, `setLanguage`).
- `audioPlayback.ts` - `PcmPlayer` (gapless Web Audio queue) + base64 helper.
- `public/worklets/pcm-capture.js` - AudioWorklet that downsamples the mic to
  24 kHz mono linear16 off the main thread.

### UI
- `components/DemoRoom.tsx` - the mic button starts/stops the voice loop, the
  caption overlay shows the live prospect transcript + Maya's spoken text, the
  Maya tile pulses only while she's actually speaking, and an EN/ES toggle
  switches languages. Changes are additive: without a voice server the mock
  prototype still runs.

## Running it

1. Copy env and add keys:
   ```bash
   cp .env.example .env.local   # then fill in DEEPGRAM_API_KEY + ANTHROPIC_API_KEY
   ```
   `tsx` loads `.env` via `dotenv/config`; for local dev put keys in `.env`
   (or export them) so the gateway picks them up.
2. Run both the web app and the voice gateway:
   ```bash
   npm run dev:all        # web on :3000, voice gateway on :3001
   ```
   Or separately: `npm run dev` and `npm run dev:voice`.
3. Open http://localhost:3000, start a demo, and click the mic button. Maya
   greets you; ask a product question and you should hear a spoken answer.

Headphones recommended on stage: the mic + speakers in the same room can let
Maya's own voice trigger barge-in.

## The P1 integration boundary

P2 depends only on the `Orchestrator` interface:

```ts
interface Orchestrator {
  runTurn(input: TurnInput, context: TurnContext, signal: AbortSignal): AsyncIterable<Command>;
  greeting?(language: Language): Promise<string> | string;
}
```

- Input: the final user transcript + conversation history + buyer notes.
- Output: a stream of `Command`s. P2 acts on `say`; it forwards `screen_is_on`,
  `remember`, and `buyer_loaded` to the client and tolerates the rest.
- `signal` is aborted on barge-in so the loop can stop generating immediately.

To plug in P1's real loop, implement `Orchestrator` and return it from
`createOrchestrator()` in `server/orchestrator/index.ts`. Nothing else in the
voice layer changes. Likewise, P4 can populate `buyerNotes` / `buyer_loaded`,
and P1D can replace `getProductFacts()`.

## Design decisions

- **Discrete STT + TTS, not Deepgram's unified Voice Agent.** Keeps turn-taking
  and the LLM loop in the team's control, with a clean `user_said` / `say`
  boundary for P1 + P4.
- **Server-side gateway.** API keys never reach the browser; works across
  browsers; matches the "web app + server" skeleton. Standalone on :3001
  (separate from Next on :3000) to avoid Next App Router WebSocket limits and to
  keep the merge clean.
- **Mic format = linear16, 24 kHz, mono.** Resampled in the AudioWorklet so the
  payload is small and Deepgram-ready without a container.
- **TTS over REST per sentence, not the WS-TTS socket.** The installed SDK's
  WS-TTS path `JSON.parse`s every frame, which breaks on binary audio. The
  orchestrator already streams one sentence at a time, so short REST requests
  give low first-audio latency and avoid that bug.
- **Sentence chunking.** `StubOrchestrator` emits complete sentences as Claude
  streams, so TTS (and audio) start before the full answer is generated.

## Latency + voice tuning (P2C)

- STT: `interim_results`, `endpointing: 300ms`, `utterance_end_ms: 1000` for
  snappy turn-taking; keep-alive pings hold the socket warm during silence.
- LLM: streamed, sentence-chunked into TTS.
- TTS: short per-sentence REST requests stream PCM straight to the client.
- Voice: default `aura-2-thalia-en` (override with `DEEPGRAM_TTS_MODEL`).

## Barge-in (P2C)

Two triggers, both cut audio instantly via `PcmPlayer.stop()`:
1. Server-side: Deepgram `SpeechStarted` (VAD) while Maya is speaking ->
   `VoiceSession.bargeIn()` aborts the turn (stops LLM + TTS) and sends a
   `barge_in` event.
2. Client-side: receiving any `user_said` while audio is playing also stops
   playback immediately, so the cut feels instant even before the server round
   trip.

## Out of scope (owned by teammates)

- P1: the real LLM loop (we ship a swappable stub).
- P3: Browserbase/Stagehand. `navigate` / `screen_is_on` are tolerated no-ops.
- P4: Redis memory. `buyer_loaded` notes feed `buyerNotes` when present.
- P5: final frontend polish (we wired into the existing `DemoRoom`).

## Progress log

- Defined the shared `lib/voice/messages.ts` contract.
- Built the Node WS gateway, Deepgram STT wrapper, stub Claude orchestrator,
  and provider-agnostic Aura-2 TTS.
- Built the browser hook, AudioWorklet capture, and Web Audio playback queue.
- Wired the loop into `DemoRoom` (mic, captions, speaking indicator, EN/ES).
- Added barge-in (server VAD + client-side) and latency tuning.
- Verified: server typecheck, full project typecheck, and `next build` all pass.
