# Voice Agent Architecture — Reference Spine

> Durable reference for how production voice AI agents are architected, grounded in
> real frameworks, vendor docs, and engineering write-ups. Built to anchor our own
> design for a live voice + browser-driving sales-demo agent.
>
> Date: 2026-06-20. Every claim is cited inline with a URL. Where something is a
> rule of thumb rather than documented vendor practice, it is flagged as such.
> Research note: WebSearch was unreliable during this work, so claims are grounded
> in direct fetches of primary sources (vendor docs + source repos), which are more
> authoritative anyway.

---

## Canonical architecture (one paragraph)

A production voice agent is a **single LLM "brain" wrapped in a real-time audio I/O
membrane**. Speech-to-text (STT) and text-to-speech (TTS) are *transport* — they
convert the audio channel to and from text — while the agent's actual capabilities
(retrieval, navigation, actions, memory) are exposed to the LLM as **function tools
it chooses to call**. The dominant design is a *cascaded pipeline*
(VAD → STT → endpointing/turn-detection → LLM → TTS → playback) tuned so the user
hears first audio in well under a second; the newer alternative is a *speech-to-speech*
model ([OpenAI Realtime](https://developers.openai.com/api/docs/guides/realtime),
Gemini Live) that collapses the cascade into one model. Everything hard about voice
agents is timing: detecting when the user is done (endpointing), starting to speak
before the LLM finishes (sentence-chunked streaming), covering unavoidable tool-call
pauses with filler speech, and yielding instantly when the user interrupts (barge-in).

```
                            ┌─────────────────── the "membrane" (transport / I/O) ───────────────────┐
   user mic ──► [ VAD ] ──► [ STT ] ──► [ endpointing / turn detection ]
                                                      │  (end-of-turn fires)
                                                      ▼
                            ┌──────────────── the "brain" (single agent / LLM) ────────────────┐
                            │   [ LLM ]  ──tool_call?──►  [ TOOLS: retrieve / navigate /        │
                            │     │  ▲                      remember / act ]  ──result──┐        │
                            │     │  └──────────────────────────────────────────────────┘        │
                            │     │  streams text tokens, chunked at sentence boundaries          │
                            └─────┼──────────────────────────────────────────────────────────────┘
                                  ▼
                            [ TTS ] ──► [ playback buffer ] ──► user speaker
                                  ▲
              barge-in: user speech during playback ──► truncate TTS + LLM, re-enter STT
```

Industry split worth holding onto: the cascade above is documented practice for
[LiveKit Agents](https://docs.livekit.io/agents/build/nodes/) and
[Pipecat](https://github.com/pipecat-ai/pipecat); **OpenAI's Realtime API removes the
STT/LLM/TTS seams entirely** with a single speech-to-speech model, trading pipeline
control for lower latency and native interruption
([OpenAI Realtime guide](https://developers.openai.com/api/docs/guides/realtime)).

---

## 1. The canonical pipeline — stages, names, ordering

The stages are consistent across frameworks; only the naming differs.

- **LiveKit Agents** organizes the pipeline as overridable **nodes** inside an
  `AgentSession`: `stt_node` (*"transcribes audio frames into speech events"*),
  `llm_node` (*"may yield plain text or `llm.ChatChunk` objects that can include text
  and optional tool calls"*), and `tts_node` (*"synthesizes audio from text
  segments"*). VAD (Silero) and a turn-detector model sit in front of
  `stt_node`/`llm_node`.
  ([nodes](https://docs.livekit.io/agents/build/nodes/),
  [turns](https://docs.livekit.io/agents/build/turns/))
- **Pipecat** models everything as **frames** flowing through **`FrameProcessor`s**
  composed into a **`Pipeline`**, bounded by a **transport** (Daily / LiveKit WebRTC,
  FastAPI WebSocket, etc.). A voice bot is literally the chain
  *transport input → STT → LLM → TTS → transport output*, described as "Composable
  Pipelines… build complex behavior from modular components," each pipeline being an
  agent. ([Pipecat README](https://github.com/pipecat-ai/pipecat))
- **OpenAI Realtime API** does **not** expose these stages — it is *"direct
  speech-to-speech interaction… eliminating the traditional STT-LLM-TTS pipeline…
  within a single session,"* with built-in server VAD for turn-taking.
  ([OpenAI Realtime guide](https://developers.openai.com/api/docs/guides/realtime))

So the canonical ordering — **VAD → STT → endpointing/turn-detection → LLM (± tools)
→ TTS → playback** — is documented practice for cascaded frameworks; speech-to-speech
models fold STT/LLM/TTS into one box but keep VAD/turn-detection and playback at the
edges.

---

## 2. Streaming vs. batch at the LLM step

Production cascaded agents **stream the LLM token-by-token and speak as they
generate** — they do *not* wait for the full response.

- The mechanism is **sentence-chunking**: tokens accumulate until a sentence/clause
  boundary, then that chunk is handed to TTS so first audio starts before the LLM
  finishes. **Two frameworks document this:**
  - LiveKit's `tts_node`: *"If the TTS implementation doesn't support streaming
    natively, it uses a sentence tokenizer to split text for incremental synthesis."*
    A **`FlushSentinel`** marker acts as an explicit segment boundary — *"when the
    pipeline encounters one… it immediately sends all text produced so far to
    `tts_node` for synthesis without waiting for the node to finish."*
    ([LiveKit nodes](https://docs.livekit.io/agents/build/nodes/))
  - Pipecat makes it the **default**: TTS *"aggregates streaming tokens into complete
    sentences before synthesis (`TextAggregationMode.SENTENCE`)"*; switch to
    `TOKEN` mode *"to stream tokens directly for lower latency."* `SENTENCE` mode
    *"adds latency (~200-300ms per sentence)"*; `TOKEN` *"reduces latency."*
    ([Pipecat TTS](https://docs.pipecat.ai/pipecat/learn/text-to-speech),
    [SentenceAggregator](https://pipecat-docs.readthedocs.io/en/latest/api/pipecat.processors.aggregators.sentence.html),
    [tts_service source](https://reference-server.pipecat.ai/en/latest/_modules/pipecat/services/tts_service.html))
- LiveKit also does **preemptive generation**: *"speculatively starting an LLM
  response before the user's end of turn is confirmed,"* with TTS held back until the
  turn is confirmed — overlapping LLM inference with endpointing.
  ([LiveKit audio](https://docs.livekit.io/agents/build/audio/))
- The streaming overlap is *"what makes competitive latency possible"* — pipelines
  *"feed LLM tokens into the TTS engine as they arrive."*
  ([LiveKit: realtime vs cascade](https://livekit.com/blog/realtime-vs-cascade))

### Latency targets

The vendor-stated end-to-end ("voice-to-voice") numbers:

- **Vapi**: *"Sub-600ms response times with natural turn-taking."*
  ([Vapi](https://docs.vapi.ai/))
- **Twilio ConversationRelay**: *"<0.5 second median latency, <0.725 second at the
  95th percentile"*; launch benchmark targets of 1,115ms (target) / 1,400ms (limit)
  mouth-to-ear.
  ([Twilio latency guide](https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents))

**Flagged as rule-of-thumb, not vendor claim:** the widely-repeated "sub-800ms"
target derives from conversational science (human turn-taking gaps median ~200ms;
gaps over ~800ms feel awkward), yielding a recommendation of *"<800ms first-audio
latency at p50, and <1500ms at p95."*
([Twig 800ms-rule analysis](https://www.twig.so/blog/voice-ai-agents-latency-budget-800ms))
No vendor (Deepgram, LiveKit, Cartesia, ElevenLabs) states "sub-800ms voice-to-voice"
as its own platform goal — Deepgram's own framing is component-level *"sub-300ms,"*
not full voice-to-voice
([Deepgram](https://deepgram.com/learn/low-latency-voice-ai)).

### Per-stage latency budget

| Stage | Target | Limit / notes | Source |
|---|---|---|---|
| End-of-turn detection | 200–300ms p50 | — | [Twig](https://www.twig.so/blog/voice-ai-agents-latency-budget-800ms) |
| STT (final transcript) | 350ms (50–150ms over partials) | 500ms limit; final within 300–500ms of end-of-utterance | [Twilio](https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents) / [Twig](https://www.twig.so/blog/voice-ai-agents-latency-budget-800ms) |
| LLM (time-to-first-token) | 375ms | 750ms limit; TTFT is the LLM's whole contribution since TTS starts on first tokens | [Twilio](https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents) |
| TTS (time-to-first-byte/audio) | 100ms | 250ms limit | [Twilio](https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents) |

Vendor TTS first-audio numbers: Cartesia Sonic ~90ms time-to-first-byte
([Cartesia](https://docs.cartesia.ai/)); Deepgram Aura-2 ~90ms steady-state, drove
TTFB from <200ms to 90ms
([Deepgram engineering](https://deepgram.com/learn/engineering-real-time-low-latency-voice-ai-at-scale));
ElevenLabs Flash ~75ms model inference (internal measurement, excludes network),
100–150ms real WebSocket TTFB in NA/EU
([ElevenLabs latency concepts](https://elevenlabs.io/docs/eleven-api/concepts/latency)).
ElevenLabs also exposes the inverse lever via `chunk_length_schedule` (characters
buffered before generating) and `flush:true` to force immediate audio at end of turn
([ElevenLabs realtime WS](https://elevenlabs.io/docs/eleven-api/guides/how-to/websockets/realtime-tts)).

---

## 3. Thinking silence & tool calls — covering the unavoidable pause

When the LLM must call a tool (DB / RAG / action) before it can answer, there is a
real pause. There is a **spectrum of documented solutions**, from turnkey to
build-it-yourself.

- **Vapi — declarative, turnkey filler.** A tool can carry `messages` with verbatim
  enum types `request-start`, `request-complete`, `request-failed`, and
  `request-response-delayed` (which takes `timingMilliseconds` before it fires).
  `request-start` is spoken when the tool call begins (e.g. *"Checking the weather
  forecast. Please wait…"*); `request-response-delayed` fires if the tool is slow.
  ([Vapi custom tools](https://docs.vapi.ai/tools/custom-tools),
  [API enums](https://docs.vapi.ai/api-reference/tools/create))
  (Note: Vapi's `backgroundSound` (off/office) is separate ambient audio, *not* the
  filler feature. ([Vapi speech config](https://docs.vapi.ai/customization/speech-configuration)))
- **LiveKit — the build-it-yourself pattern.** There is *no* named filler-word
  parameter. Inside a function tool you call `session.say()` or
  `session.generate_reply()` to emit a filler line, and **async tools** let *"the
  agent keep talking while long-running work completes."*
  ([LiveKit tools](https://docs.livekit.io/agents/build/tools/))
- **OpenAI realtime-agents — the chat-supervisor (two-model) pattern.** A fast
  realtime chat model *"converse[s] with the user and handle[s] basic tasks,"* and a
  more intelligent text supervisor (e.g. `gpt-4.1`) is *"used extensively to handle
  tool calls and more challenging responses."* When the chat agent hits something
  hard, it *signals to the user ("Let me think") and forwards the message to the
  supervisor*, then delivers the supervisor's result. The fast model owns the
  socially-required filler; the slow model owns reasoning + tool use.
  ([openai-realtime-agents](https://github.com/openai/openai-realtime-agents))

**Could not verify:** a documented filler feature for Pipecat or Retell (Pipecat docs
404'd). Not cited.

The reconciliation of (often non-streaming, structured) tool calls with low-latency
speech is therefore: the LLM emits a tool call; the framework either (a) speaks a
declarative/`session.say()` filler line while the tool runs, or (b) hands hard tool
work to a stronger supervisor model while a fast model keeps the conversation warm.

---

## 4. Turn-taking & barge-in

**End-of-turn (endpointing)** combines VAD-for-silence with a smarter signal:

- **LiveKit** ships a **turn-detector model** that *"predicts end of turn from the
  meaning of speech, on top of VAD"* (semantic endpointing), backed by **Silero
  VAD**; timing is tuned via `min_delay`/`max_delay` (plus a dynamic mode that adapts
  to the speaker's pause statistics). Alternatives: VAD-only, STT-provider
  endpointing (AssemblyAI / Deepgram), or server-side detection from a realtime
  model. ([LiveKit turns](https://docs.livekit.io/agents/build/turns/))
- **Vapi** exposes a `startSpeakingPlan` with `waitSeconds` **default 0.4s** before
  the assistant speaks, plus pluggable smart-endpointing providers (Krisp acoustic,
  Deepgram Flux audio-text, LiveKit text) — e.g. LiveKit's `waitFunction` default
  `"200 + 8000 * x"`.
  ([Vapi speech config](https://docs.vapi.ai/customization/speech-configuration))
- **OpenAI Realtime** uses **server VAD**, emitting `input_audio_buffer.speech_started`
  on speech onset.
  ([OpenAI Realtime guide](https://developers.openai.com/api/docs/guides/realtime))

**Barge-in (user interrupts the agent):**

- **LiveKit** has **adaptive interruption** that *"distinguishes intentional
  interruptions from conversational backchanneling"* via `interruption.mode`
  (`adaptive` default in Cloud, or `vad`), `min_duration`, and
  `resume_false_interruption`. Crucially, on interrupt it *"truncates its conversation
  history to include only the portion of the speech that the user heard before
  interruption"* — so the LLM's memory matches what was actually spoken.
  ([LiveKit turns](https://docs.livekit.io/agents/build/turns/))
- **Vapi** has a `stopSpeakingPlan`: `numWords` (set 0 for immediate reaction),
  `voiceSeconds` **default 0.2s**, and `backoffSeconds` **default 1s** (how long to
  stay quiet after being interrupted).
  ([Vapi speech config](https://docs.vapi.ai/customization/speech-configuration))
- **OpenAI Realtime** handles interruption natively — users can speak over the model,
  and the session *"manages audio buffer state and response cancellation
  automatically."*
  ([OpenAI Realtime guide](https://developers.openai.com/api/docs/guides/realtime))

---

## 5. The brain/membrane split — confirmed, with one nuance

The mental model holds: **STT/TTS are transport, not tools; retrieve/navigate/
remember/act ARE tools the LLM chooses.**

- In LiveKit, STT and TTS are **pipeline nodes** that exist whether or not the agent
  ever calls a tool — they are the audio↔text boundary. The `llm_node` is where
  intelligence lives, and it *"yields… `llm.ChatChunk` objects that can include text
  and optional tool calls"* — i.e. tools are emitted *by the LLM as part of
  generation*, structurally distinct from the STT/TTS membrane.
  ([LiveKit nodes](https://docs.livekit.io/agents/build/nodes/))
- Capabilities are wired as **function tools** the model selects: LiveKit's
  `@function_tool` / `RunContext`, with subpages for Function tools / Async tools /
  Toolsets / MCP / Forwarding-to-frontend
  ([LiveKit tools](https://docs.livekit.io/agents/build/tools/)); OpenAI Realtime's
  *"function tools, MCP servers, and connectors."*
  ([OpenAI Realtime](https://developers.openai.com/api/docs/guides/realtime))
- **Exact OpenAI Realtime tool-call wiring:** the model emits the call in a
  `response.done` event where `response.output[0].type == "function_call"` (carrying
  `name`, `arguments`, `call_id`); the app returns `conversation.item.create` with
  type `"function_call_output"` + matching `call_id` + `output`; then sends
  `response.create` to continue the turn.
  ([OpenAI Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations))

**The one complication:** in a **speech-to-speech** model (OpenAI Realtime, Gemini
Live), STT and TTS are *internalized* into the model rather than being separate
transport stages — so "STT/TTS = membrane" is a property of *cascaded* designs. The
brain/tools distinction still holds (tools are explicit function calls); the membrane
just moves *inside* the model. Cascaded gives pluggable STT/TTS vendors + full control
of the audio seam; speech-to-speech gives the lowest latency + native interruption.

---

## 6. Voice agents that also drive a browser/UI (prior art)

Strong prior art exists for the *browser-driving* half, and the cleanest
architectural lesson is the **separation of "decide what to do on screen" from
"execute it in the browser,"** which maps onto the voice agent's think→act→speak loop.

- **LaVague** splits a **World Model** (objective + current page state → instructions)
  from an **Action Engine** (compiles instructions into Playwright/Selenium code and
  executes). This is the precise abstraction for sequencing *think → act-on-screen →
  speak*: the LLM reasons, emits a navigation tool call, the action engine drives the
  page, then the agent narrates the result.
  ([LaVague](https://github.com/lavague-ai/LaVague))
- **Browserbase Stagehand** exposes browser control as LLM-callable primitives —
  natural-language `act`, `agent.execute`, and schema'd `extract` — and emphasizes
  caching repeatable actions and self-healing when the page changes. Stable demo
  routes run as deterministic code; buyer-driven detours fall back to AI.
  ([Stagehand](https://github.com/browserbase/stagehand))
- **Browser Use** is the most direct "agent operates a real product in a browser"
  reference (state/click/type/screenshot loop, allowed-domains, custom tools,
  persistent authed profiles).
  ([Browser Use](https://github.com/browser-use/browser-use))

For *voice + screen together*, the documented building blocks are: (a) make
navigation a **function tool** the brain calls; (b) run it as a **LiveKit async tool**
so the agent can say *"let me pull that up"* while the page loads; (c) push the
resulting screen state to the watcher's UI over the realtime **data channel/RPC** the
voice transport already provides. The "voice narration synchronized to a live screen
the buyer watches" product (e.g. 1mind-style live demo agents) is documented at the
*product* level in [`research/competitor-landscape.md`](./competitor-landscape.md),
but **no single open-source framework ships the voice-driving-a-watched-browser loop
end-to-end** — that integration is assembled from a voice framework (LiveKit/Pipecat)
+ a browser-control layer (Stagehand/Browser Use). See also
[`research/open-source-reference-implementations.md`](./open-source-reference-implementations.md)
for fuller profiles of each repo.

---

## What this implies for a single-brain agent that does voice + browser + memory

- **Keep one brain; make voice the membrane.** STT in / TTS out is transport around a
  single LLM. Model `navigate`, `retrieve`, `remember`, and `act` as the tools the
  brain chooses — *not* STT/TTS. (Confirmed by LiveKit's node-vs-tool structure;
  complicated only if we adopt a speech-to-speech model, which internalizes the
  membrane.)
- **Stream and sentence-chunk by default.** First audio must start before the LLM
  finishes. Adopt sentence-tokenized incremental TTS (LiveKit's tokenizer/FlushSentinel,
  Pipecat's `SENTENCE` mode) and, where supported, preemptive generation. Budget to a
  vendor-documented bar (Vapi sub-600ms), with TTS first-audio in the ~90ms class
  (Cartesia/Deepgram). The **LLM time-to-first-token is the squeeze point** (~375ms
  target).
- **Treat every browser action as a latency event to cover with speech.** Navigation
  is slow and structured — wrap it as an async tool and emit a filler line (*"let me
  pull that up"*) the instant the tool starts, then a "still working on it" line if it
  exceeds a threshold. Vapi's `request-start` / `request-response-delayed` model is the
  cleanest mental model to copy; LiveKit's `session.say()` + async-tool pattern is how
  we'd build it ourselves. Do **not** assume a turnkey filler knob exists in every
  framework.
- **Consider a two-tier model split.** A fast model owns conversation / turn-taking /
  filler; a stronger model owns hard tool calls and the browser plan. This is the
  documented chat-supervisor pattern and fits "talk smoothly while occasionally doing
  something expensive on screen."
- **Make barge-in and history-truncation non-negotiable.** When the buyer interrupts,
  stop TTS *and* truncate the agent's memory to only what was actually heard (LiveKit's
  documented behavior), or the brain will reason over words the user never received.
- **We integrate, not adopt, the voice+watched-screen loop.** No OSS framework ships it
  whole. Sequence it as **think (LLM) → act (browser tool, async) → speak (narrate
  result)**, push screen state over the voice transport's data channel, and borrow
  LaVague's World-Model/Action-Engine separation so demo reasoning stays decoupled from
  brittle page execution.
