/**
 * Browserbase knowledge-base curation spec: which docs to include and the
 * authored app-navigation guide. Kept here (not in the script) so it can be
 * unit-tested without Redis and reused by an agent-driven curation flow later.
 *
 * The allowlist selects demo-relevant pages from
 * research/browserbase-kb/full-docs/documents.jsonl. The navigation guide is
 * authored prose kept in sync with SECTIONS in lib/demoConfig.ts.
 */
import type { SourceDoc } from "./types";

/** A raw docs-page record as stored in documents.jsonl. */
export interface RawDoc {
  id: string;
  title: string;
  group: string;
  url: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Allowlist — demo-relevant doc IDs from documents.jsonl.
// Excludes: all integrations/* (80+ pages), all reference/api/* (40+ pages),
// reference/sdk/*, account/team/*, internal/*, and long use-case tutorials.
// ---------------------------------------------------------------------------
export const BROWSERBASE_ALLOWLIST: readonly string[] = [
  // Welcome + getting started
  "welcome__what-is-browserbase",
  "welcome__introduction",
  "welcome__getting-started",
  "welcome__quickstarts__stagehand",

  // Browser platform — core
  "platform__browser__getting-started__remote-browser-versus-local-browser",
  "platform__browser__getting-started__create-browser-session",
  "platform__browser__core-features__overview",
  "platform__browser__core-features__contexts",
  "platform__browser__core-features__viewports",
  "platform__browser__files__screenshots",

  // Observability (critical for demo: live view is the centrepiece)
  "platform__browser__observability__observability",
  "platform__browser__observability__session-live-view",
  "platform__browser__observability__session-recording",
  "platform__browser__observability__session-replay",

  // Long sessions
  "platform__browser__long-sessions__overview",

  // Identity
  "platform__identity__overview",
  "platform__identity__proxies",
  "platform__identity__authentication",
  "platform__identity__allowed-domains",

  // Platform capabilities
  "platform__search__overview",
  "platform__fetch__overview",
  "platform__runtime__overview",
  "platform__model-gateway__overview",

  // Billing + enterprise
  "account__billing__plans",
  "account__enterprise__security",
  "account__enterprise__zero-data-retention",

  // Use cases
  "use-cases__agents",
  "use-cases__web-data-retrieval",

  // Optimizations
  "optimizations__concurrency__overview",
];

/**
 * Strip scrape noise so the embedded text is the actual product content, not
 * boilerplate. This is the "curated, not a raw dump" step (issue #8): every
 * source page carries an identical docs-index header and MDX/JSX components that
 * otherwise dilute every embedding. Keeps real prose (incl. the doc tagline).
 */
export function cleanDocText(raw: string): string {
  let t = raw;
  // Remove the docs-index blockquote header present on every page.
  t = t.replace(/>\s*##\s*Documentation Index\s*\n(?:>.*\n?)*/i, "");
  // Drop self-closing media/JSX embeds (carry no useful text).
  t = t.replace(/<(?:iframe|video|img|source|Frame|Icon|br)[^>]*\/?>/gi, "");
  // Strip remaining JSX/HTML tags but keep their inner text.
  t = t.replace(/<\/?[A-Za-z][^>]*>/g, "");
  // Collapse runs of blank lines + trim.
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

/** Map a raw docs-page record to a curated source doc (pure; timestamp injected). */
export function toCuratedDoc(
  raw: RawDoc,
  updatedAt: string = new Date().toISOString()
): SourceDoc {
  return {
    id: raw.id,
    title: raw.title,
    source: raw.url,
    group: raw.group,
    text: cleanDocText(raw.text),
    updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Authored app-navigation guide (kept in sync with lib/demoConfig.ts SECTIONS).
// Its page labels + deep-link URLs must match SECTIONS — see curation.test.ts.
// ---------------------------------------------------------------------------
export const APP_NAVIGATION_DOC: Omit<SourceDoc, "updatedAt"> = {
  id: "app-navigation",
  title: "App Navigation Guide — Browserbase Demo",
  source: "https://www.browserbase.com",
  group: "demo-meta",
  text: `# Browserbase App Navigation Guide

This guide describes the pages and key flows for the Browserbase demo. Use it to answer "where do I find X?" questions.

## Dashboard pages (requires sign-in at www.browserbase.com)

### Overview — https://www.browserbase.com/overview
The main dashboard home. Shows usage analytics, recent activity, session counts, and billing summary. Go here for: overall usage stats, a quick health-check of your project, and an entry point to all other sections. Keywords: overview, dashboard, home, main, analytics, usage.

### Sessions — https://www.browserbase.com/sessions
A list of all browser sessions for your project — both live and completed. Each row shows session ID, status, start time, duration, and links to the Live View, recording, and replay. Go here to: inspect a running session in real time, review past runs, download recordings, or open the session replay. Keywords: sessions, session, runs, run history, history, recent.

### Functions — https://www.browserbase.com/functions
Browse, create, and deploy browser agent Functions. Functions are serverless browser agents that run on Browserbase infrastructure. You can deploy from the Playground, trigger by API/webhook/schedule, and monitor invocations here. Go here to: see deployed functions, review invocation logs, and manage function versions. Keywords: functions, function, serverless, deploy.

### Playground — https://www.browserbase.com/playground
An interactive sandbox to write and run browser automation code directly in the dashboard — no local setup required. Select a framework (Playwright, Puppeteer, Stagehand), write code, click Run, and watch the live browser. You can deploy the result as a Function. Go here to: try Browserbase without writing any local code, prototype automations, and demonstrate the product interactively. Keywords: playground, try it, try out, sandbox, test it, live test.

## Public pages

### Pricing — https://www.browserbase.com/pricing
Browserbase plans and pricing. Plans include Free (limited sessions, no credit card), Developer, Startup, and Scale (enterprise). Pricing is based on browser session usage (minutes or concurrent sessions), not seats. Enterprise plans include SLAs, SSO, RBAC, HIPAA/BAA, and custom data residency. Go here to: check plan costs, understand limits, and compare tiers. Keywords: pricing, price, cost, plan, plans, how much.

### Docs — https://docs.browserbase.com/
Full product documentation. Covers: getting started, browser sessions, contexts, observability, Live View, identity/proxies, Search API, Fetch API, Functions/Runtime, Model Gateway, Stagehand SDK, integrations, API reference, and SDKs. Go here to: find technical details, code samples, and API reference. Keywords: docs, documentation, reference, api docs, guide.

## Key demo flows

1. **Live session demo**: Navigate to Sessions → find a running session → click "Live View" to watch the browser in real time. Or embed the Live View iframe in your own app.
2. **Playground demo**: Navigate to Playground → select Stagehand → paste code → click Run → watch the live browser execute the automation.
3. **Contexts demo**: Explain that Contexts persist cookies and auth state across sessions — log in once, reuse the context forever.
4. **Pricing walkthrough**: Navigate to Pricing → walk through plan tiers → note the session-usage model (not seat-based).
5. **Functions deploy**: Show a Function created in the Playground, deployed, and triggered by API.`,
};
