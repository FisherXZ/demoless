# Demoless

**Tagline:** Live product demos, run by an AI rep that can listen, talk, browse, remember, and follow up.

Demoless is an AI-led product demo app. A visitor enters a few details, joins a live call, and talks to an AI product specialist named Messi. Messi listens through the microphone, answers with voice, drives a real browser session that the visitor can watch, remembers useful buyer context, and saves the session for the post-demo dashboard.

The reference demo in this repo is for Browserbase, but the project is structured so the target product, prompt, knowledge base, and browser destination can be changed.

## What This Project Does

Demoless combines a web app, a voice gateway, a browser automation layer, and memory/session storage into one live demo experience.

1. A visitor starts on the landing page.
2. The pre-call form collects name and work email so the demo can be attached to a real buyer record.
3. The demo room opens and automatically starts the voice session.
4. Messi greets the visitor, asks what they want to figure out, and listens for spoken or typed input.
5. The server transcribes speech with Deepgram, sends the conversation to the AI orchestrator, and streams spoken replies back to the browser.
6. When useful, the orchestrator drives a real Browserbase cloud browser session and sends the live view URL to the demo room.
7. Memory and session events are stored so the dashboard can show live activity, past sessions, notes, and recap data.

## Core Functionality

**Live demo room**

The main experience lives in `components/DemoRoom.tsx`. It shows the watched browser, voice status, captions, chat input, language toggle, and call controls. It uses `lib/voice/useVoiceAgent.ts` to connect to the voice WebSocket server.

**Voice agent**

The browser captures microphone audio with `public/worklets/pcm-capture.js`, sends raw PCM to the voice gateway, and plays streamed TTS audio back through the client. The shared message contract is in `lib/voice/messages.ts`.

**Voice gateway**

`server/index.ts` starts the WebSocket server. Each connection creates a `VoiceSession` in `server/session.ts`. A session owns turn-taking, speech-to-text, text-to-speech, barge-in, language switching, buyer identity, browser startup, and session snapshots.

**AI brain and orchestration**

The orchestrator in `server/orchestrator/` decides what to say and what actions to take. It builds prompts from product config, buyer notes, cross-session learnings, and the current page. The lower-level model/tool loop lives in `server/brain/`.

**Browser automation**

The server starts a Browserbase cloud browser through `lib/browser/session`. The live view is embedded in the demo room, so the visitor watches the product being navigated in real time.

**Memory and learnings**

The memory layer in `lib/memory/`, `lib/knowledge/`, `lib/learnings/`, and `lib/sessions/` stores buyer context, product knowledge, session events, replay metadata, and distilled learnings from past demos. Redis is used for this layer.

**Dashboard**

The dashboard components read saved sessions and buyer context so teams can review what happened after the call.

## Tech Stack

**TypeScript**

Used across the app, server, tests, and shared contracts. The frontend and backend share types for voice messages, demo state, sessions, and memory.

**Next.js 15 and React**

Power the web app in `app/` and `components/`. Next.js serves the landing page, pre-call flow, demo room, dashboard, and API routes such as `/api/agent-name`.

**Tailwind CSS**

Provides the design system and utility styling. Theme tokens live in `tailwind.config.ts`.

**Node.js**

Runs the voice gateway, model orchestration, Browserbase session management, memory scripts, smoke tests, and build tooling.

**WebSocket (`ws`)**

Connects the browser to the local voice server for low-latency audio, captions, state updates, live browser URLs, and typed chat messages.

**Deepgram**

Provides speech-to-text and the default text-to-speech voice. The active voice can also determine the agent display name unless `AGENT_NAME` overrides it.

**Anthropic**

Used by the orchestrator for the AI demo brain and tool-use flow.

**Browserbase and Playwright**

Create and control the real cloud browser session that the visitor watches during the demo.

**Redis / Redis Stack**

Stores memory, product knowledge search data, sessions, dashboard state, and learnings. Redis Stack is recommended because product knowledge search uses RediSearch.

**OpenAI**

Used for embeddings in the product-knowledge system and for Mandarin TTS fallback when configured.

**Vitest**

Runs unit tests for the server, orchestration, memory, and session behavior.

## Setup

These steps are written for someone who just wants to run the project locally.

### 1. Install the basics

Install these first:

- Node.js 20 or newer: https://nodejs.org/
- Git: https://git-scm.com/
- A code editor such as VS Code: https://code.visualstudio.com/

Then open a terminal in the project folder.

On Windows PowerShell, this repo is currently at:

```powershell
cd C:\Users\zhenl\Downloads\demoless
```

### 2. Install project packages

```bash
npm install
```

This downloads the libraries listed in `package.json`.

### 3. Create your local settings file

Copy the example environment file:

```powershell
Copy-Item .env.example .env.local
```

On macOS or Linux:

```bash
cp .env.example .env.local
```

Open `.env.local` in your editor and fill in the keys you have.

For the full live voice demo, you usually need:

- `DEEPGRAM_API_KEY`
- `ANTHROPIC_API_KEY`
- `BROWSERBASE_API_KEY`
- `BROWSERBASE_PROJECT_ID`
- `REDIS_URL`
- `OPENAI_API_KEY` if you want product-knowledge embeddings or Mandarin TTS fallback

To force the agent name to Messi, add or keep:

```bash
AGENT_NAME=Messi
```

### 4. Run the web app only

Use this if you just want to see the screens without the voice gateway:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

### 5. Run the full voice demo

Use this when your `.env.local` has the voice, AI, browser, and memory keys:

```bash
npm run dev:all
```

This starts:

- Web app: `http://localhost:3000`
- Voice gateway: `ws://localhost:3001`

Open `http://localhost:3000`, start a demo, allow microphone access, and join the call.

### 6. Optional: Run Redis locally

If you do not already have Redis, you can run Redis Stack with Docker:

```bash
docker run -p 6379:6379 redis/redis-stack:latest
```

Then set this in `.env.local`:

```bash
REDIS_URL=redis://localhost:6379
```

### 7. Useful commands

```bash
npm run dev          # Start the Next.js web app only
npm run dev:voice    # Start the voice gateway only
npm run dev:all      # Start both web app and voice gateway
npm run build        # Create a production build
npm run start        # Run the production web server
npm test             # Run the test suite
npm run smoke        # Run the voice/server smoke test
```

## Project Map

| Path | Purpose |
| --- | --- |
| `app/` | Next.js routes and API endpoints |
| `components/` | Landing page, pre-call form, demo room, dashboard, providers |
| `lib/voice/` | Browser-side voice hook, audio playback, shared message types |
| `server/` | Voice gateway, session lifecycle, orchestration, STT/TTS, model loop |
| `lib/browser/` | Browserbase session helpers |
| `lib/memory/` | Buyer memory and Redis-backed storage |
| `lib/knowledge/` | Product knowledge search and embeddings |
| `lib/learnings/` | Cross-session learning extraction |
| `lib/sessions/` | Session recording, replay metadata, analysis storage |
| `public/worklets/` | Browser AudioWorklet for microphone capture |
| `docs/` | Architecture notes, dogfooding plans, and implementation history |
| `scripts/` | Utility scripts for memory, knowledge, sessions, and learnings |

## Common Problems

**The page opens, but voice does not work.**

Make sure you ran `npm run dev:all`, allowed microphone access, and filled in `DEEPGRAM_API_KEY`.

**The agent cannot think or answer normally.**

Check `ANTHROPIC_API_KEY`.

**The watched browser does not appear.**

Check `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, and `DEMO_TARGET_URL`.

**Memory or dashboard data is missing.**

Check `REDIS_URL`. The demo can still run without some memory features, but saved context and knowledge search may be limited.

**Port 3000 or 3001 is already in use.**

Stop the other process using that port, or change `VOICE_SERVER_PORT` for the voice gateway.

## Customizing The Demo

To demo a different product, update:

- `DEMO_TARGET_URL` in `.env.local`
- product copy and prompt in `lib/demoConfig.ts`
- product knowledge data and seeding scripts if you are using knowledge search
- any UI copy that should mention the new product

The app is currently configured around Browserbase and the AI rep name Messi.
