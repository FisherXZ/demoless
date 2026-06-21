/**
 * Seed the product-knowledge index with Browserbase product facts. This is the
 * "what does the product do" content the AI rep answers buyer questions from.
 *
 *   docker run -p 6379:6379 redis/redis-stack:latest
 *   OPENAI_API_KEY=sk-...  npm run knowledge:seed
 *
 * indexDocuments() is generic, so local files or a P3 crawl can feed it later;
 * this script just provides ready-to-demo content sourced from product/facts.md
 * and product/catalog.ts.
 */
import { indexDocuments, clearKnowledge, closeRedis } from "../lib/knowledge";
import type { KnowledgeDoc } from "../lib/knowledge";

export const SEED_COMPANY = "browserbase";

export const SEED_DOCS: KnowledgeDoc[] = [
  {
    id: "overview",
    title: "Overview",
    source: "browserbase.com",
    text: `Browserbase is the Browser Agent Platform. It gives AI agents and automation systems one API key for cloud browsers, web search, page fetching, agent identity, serverless browser-agent Functions, and model access through the Model Gateway. The core buyer promise: stop building and debugging browser infrastructure, and give agents a reliable browser layer that can browse and interact with the web like a human.

Browserbase runs managed Chromium browser sessions in the cloud for Playwright, Puppeteer, Selenium, Stagehand, and agent frameworks. Builders create, connect to, inspect, and terminate browser sessions through APIs and SDKs. The platform provides Search API for fast, token-efficient web search before launching a browser, and Fetch API for clean markdown retrieval when a full browser session is unnecessary. Functions let browser agents and automations run on Browserbase infrastructure, invoked by API, webhook, schedule, or dashboard deployment. Model Gateway lets teams route model calls through Browserbase with one endpoint, one API key, and unified billing.`,
  },
  {
    id: "sessions-and-contexts",
    title: "Sessions and Contexts",
    source: "browserbase.com/docs/sessions",
    text: `A browser session is a remote Chromium instance created through the Browserbase API or SDK. Sessions connect via Playwright, Puppeteer, Selenium, Stagehand, or the Browserbase SDKs. Session settings include viewport, region, metadata, proxy behavior, logging, recording, downloads, uploads, screenshots, PDFs, browser extensions, and contexts. Long sessions and keep-alive support workflows that need reconnectable browsers or longer-running tasks. When a project exceeds its concurrency limit, new session creation returns HTTP 429 and should be retried with respect for retry headers.

Contexts persist cookies, auth tokens, local storage, and other browser user data across sessions. By default, each session starts with a fresh browser profile. Contexts are used when a workflow needs to stay logged in or avoid repeating authentication. Context data is encrypted at rest and persists until deleted or invalidated. Website authentication can be handled manually through Live View or programmatically. Allowed Domains can restrict where sessions are allowed to navigate.`,
  },
  {
    id: "stagehand",
    title: "Stagehand SDK",
    source: "browserbase.com/docs/stagehand",
    text: `Stagehand is Browserbase's SDK for browser agents. It combines Playwright-style browser automation with AI primitives for acting, observing, and extracting from pages, while still allowing deterministic code where needed. Stagehand supports natural-language actions, extraction, observation, self-healing steps, and caching.

Stagehand addresses selector brittleness and page changes by letting agents mix deterministic Playwright control with higher-level AI actions. Use cases include web data retrieval from dynamic or protected sites, form submission, login, registration, checkout, and other multi-step workflows. Teams can use Playwright, Puppeteer, Selenium, Stagehand, or agent frameworks on top of Browserbase — Browserbase provides the managed browser infrastructure, not a replacement for automation libraries.`,
  },
  {
    id: "security",
    title: "Security and Compliance",
    source: "browserbase.com/security",
    text: `Browserbase is secure infrastructure for browser agents at scale, with zero-trust browser isolation. Enterprise controls include SOC 2 Type II certification, HIPAA support with BAAs, third-party penetration testing, configurable data residency, SSO, RBAC, and audit controls.

Logs and session video recordings can be disabled per session with logSession: false and recordSession: false. Zero Data Retention (ZDR) prevents Browserbase from persisting session logs, recordings, and replay artifacts — replay and recording endpoints return no artifacts after the run, while Live View still works because it streams in real time. Bring Your Own Storage (BYOS) routes remaining artifacts such as downloads, uploads, contexts, and extensions into customer-owned S3 buckets. Agent Identity helps agents access websites that use bot protection and authentication controls. Browser regions let teams run sessions closer to users or data residency requirements, with documented regions including US, Europe, and Asia options.`,
  },
  {
    id: "observability-and-live-view",
    title: "Observability and Live View",
    source: "browserbase.com/docs/live-view",
    text: `Browserbase sessions are inspectable in real time with Live View. Live View can be embedded in an iframe in a frontend — this is critical for demos: the prospect watches the real Browserbase session while the agent talks. Each tab has its own Live View URL; the pages list for a session contains the Live View URLs for all open tabs.

Sessions can produce logs, metrics, screenshots, session recordings, and replay artifacts for debugging. Session Recording captures browser activity for post-run debugging. Session Replay can stream replay media through HLS for embedding playback in an application. Live View still works for zero-data-retention sessions because it streams the session in real time rather than relying on stored replay artifacts. Proxies provide consistent geolocation and network identity. IP allowlisting and VPN-style controls are available for enterprise network access patterns.`,
  },
];

async function main() {
  console.log(`Seeding knowledge for "${SEED_COMPANY}"...`);
  const cleared = await clearKnowledge(SEED_COMPANY);
  if (cleared) console.log(`  cleared ${cleared} existing chunk(s)`);
  const n = await indexDocuments(SEED_COMPANY, SEED_DOCS);
  console.log(`  indexed ${n} chunk(s) from ${SEED_DOCS.length} doc(s)`);
  await closeRedis();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
