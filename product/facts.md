# Browserbase

Browserbase is the Browser Agent Platform. It gives AI agents and automation
systems one API key for cloud browsers, web search, page fetching, agent
identity, serverless browser-agent Functions, and model access through the Model
Gateway. The core buyer promise is simple: stop building and debugging browser
infrastructure, and give agents a reliable browser layer that can browse and
interact with the web like a human.

## What Browserbase does

- Runs managed Chromium browser sessions in the cloud for Playwright,
  Puppeteer, Selenium, Stagehand, and agent frameworks.
- Lets builders create, connect to, inspect, and terminate browser sessions
  through APIs and SDKs.
- Provides Stagehand, the browser-agent SDK that combines Playwright control
  with AI primitives such as natural-language actions, extraction, observation,
  self-healing steps, and caching.
- Provides Search API for fast, token-efficient web search before launching a
  browser.
- Provides Fetch API for clean markdown retrieval when a full browser session is
  unnecessary.
- Provides Functions so browser agents and automations can run on Browserbase
  infrastructure, invoked by API, webhook, schedule, or dashboard deployment.
- Provides Model Gateway so teams can route model calls through Browserbase with
  one endpoint, one API key, and unified billing.

## Browser sessions

- A session is a remote browser created through the Browserbase API or SDK.
- Sessions can be connected to with Playwright, Puppeteer, Selenium, Stagehand,
  or the Browserbase SDKs.
- Session settings can include viewport, region, metadata, proxy behavior,
  logging, recording, downloads, uploads, screenshots, PDFs, browser extensions,
  and contexts.
- Long sessions and keep-alive support workflows that need reconnectable
  browsers or longer-running tasks.
- Concurrency is managed at the organization and project level. When a project
  exceeds its concurrency limit, new session creation can return HTTP 429 and
  should be retried with respect for retry headers.

## Contexts and authentication

- Contexts persist cookies, auth tokens, local storage, and other browser user
  data across sessions.
- By default, each Browserbase session starts with a fresh browser profile.
  Contexts are used when a workflow needs to stay logged in or avoid repeating
  authentication.
- Context data is encrypted at rest and persists until deleted or invalidated.
- Website authentication can be handled manually through Live View or
  programmatically.
- Allowed Domains can restrict where sessions are allowed to navigate.

## Live view and observability

- Browserbase sessions are inspectable in real time with Live View.
- Live View can be embedded in an iframe in a frontend, which is critical for
  Demoless: the prospect can watch the real Browserbase session while the agent
  talks.
- Each tab has its own Live View URL. The pages list for a session contains the
  Live View URLs for open tabs.
- Sessions can produce logs, metrics, screenshots, session recordings, and replay
  artifacts for debugging.
- Session Recording captures browser activity for post-run debugging.
- Session Replay can stream replay media through HLS for embedding playback in
  an application.
- Live View still works for zero-data-retention sessions because it streams the
  session in real time rather than relying on stored replay artifacts.

## Agent identity, access, and network controls

- Agent Identity helps agents access websites that use bot protection and
  authentication controls.
- Proxies provide consistent geolocation and network identity.
- Browser regions let teams run browser sessions closer to users or data
  residency requirements. Documented regions include US, Europe, and Asia
  options.
- IP allowlisting and VPN-style controls are available for enterprise network
  access patterns.

## Security and enterprise controls

- Browserbase positions itself as secure infrastructure for browser agents at
  scale, with zero-trust browser isolation.
- Enterprise materials mention SOC 2 Type II, HIPAA support with BAAs, third
  party penetration testing, configurable data residency, SSO, RBAC, and audit
  controls.
- Logs and session video recordings can be disabled per session with
  `logSession: false` and `recordSession: false`.
- Zero Data Retention (ZDR) prevents Browserbase from persisting session logs,
  recordings, and replay artifacts. ZDR keeps the browser session behavior the
  same, but replay and recording endpoints return no artifacts after the run.
- Bring Your Own Storage (BYOS) can route remaining artifacts such as downloads,
  uploads, contexts, and extensions into customer-owned S3 buckets.

## Best use cases

- Browser agents that need real browser interactions, persistent sessions,
  observability, and identity.
- Web data retrieval from dynamic or protected sites using Stagehand or
  Playwright, with session recordings and Live View for debugging.
- Form submission, login, registration, checkout, and other multi-step browser
  automation.
- Automated testing in isolated, scalable browser environments.
- Agent purchasing and other workflows that require a browser, identity, and
  controlled execution.

## Demo narrative for Demoless

- Open with the pain: browser agents break when teams self-host brittle browsers,
  lose login state, hit bot detection, or cannot debug what happened.
- Show session creation: Browserbase starts a real cloud browser that can be
  controlled by Playwright, Stagehand, or another automation layer.
- Show Live View: the buyer can watch the live session move in real time, and the
  product team can inspect it during development.
- Show Contexts: login state can be reused across sessions so agents do not
  constantly re-authenticate.
- Show Stagehand: agents can mix deterministic Playwright-style control with
  higher-level AI actions and extraction.
- Show observability: recordings, replay, logs, and metrics explain what the
  agent did.
- Show security controls: disable logs or recording for sensitive sessions, use
  ZDR/BYOS for regulated workloads, choose regions, and restrict domains.

## Common questions and answers

Q: What is Browserbase?
A: Browserbase is a managed platform for browser agents. It provides cloud
browsers, search, fetch, identity, functions, model access, observability, and
SDKs so agents can browse and interact with the web reliably.

Q: Does Browserbase replace Playwright?
A: No. Browserbase provides the managed browser infrastructure. Teams can still
use Playwright, Puppeteer, Selenium, Stagehand, or agent frameworks on top.

Q: What is Stagehand?
A: Stagehand is Browserbase's SDK for browser agents. It combines browser
automation with AI primitives for acting, observing, and extracting from pages,
while still allowing deterministic code where needed.

Q: How does Browserbase help with login?
A: Contexts persist cookies, auth tokens, and browser storage across sessions.
They let workflows reuse authenticated browser state instead of logging in from
scratch every time.

Q: Can users watch the browser live?
A: Yes. Live View exposes an interactive real-time view of a session, and it can
be embedded in a frontend iframe.

Q: How does Browserbase handle sensitive data?
A: Teams can disable session logs and recordings per session. Enterprise ZDR
prevents persisted logs, recordings, and replay artifacts, while BYOS can route
artifacts to customer-owned storage.

Q: Why use Browserbase instead of self-hosting Chromium?
A: Browserbase adds managed sessions, identity, proxies, regions, observability,
recordings, replay, contexts, concurrency controls, Functions, and SDKs around
the browser layer.

## Source set

Raw scrape and source list live in `research/browserbase-kb/`.
Primary docs used: Browserbase docs index, introduction, What is Browserbase,
browser sessions, contexts, live view, recording, replay, Fetch, Search, Agent
Identity, Functions, Model Gateway, enterprise security, ZDR, regions,
concurrency, Stagehand, Playwright, browser-agent use cases, web data retrieval,
and automated testing.
