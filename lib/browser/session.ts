// Server-only. Drives a streamable Browserbase cloud browser.
// Imported only by the API route and the smoke script — never the client.
import Browserbase from "@browserbasehq/sdk";
import { chromium, type Browser, type Page } from "playwright-core";

const API_KEY = process.env.BROWSERBASE_API_KEY;
const PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;
// When set, every demo session reuses a pre-authenticated Browserbase Context
// (seed it once with scripts/seed-context.mjs). The product being demoed then
// loads already logged-in. persist:false so prospects' clicks don't overwrite
// the saved login. Unset => plain sessions (current public-site behavior).
const CONTEXT_ID = process.env.BROWSERBASE_CONTEXT_ID;

/** What the room shows the audience after each move ("screen_is_on"). */
export interface ScreenState {
  sessionId: string;
  url: string;
  title: string;
}

interface LiveSession {
  browser: Browser;
  page: Page;
  liveViewUrl: string;
}

// Persist sessions across Next dev HMR reloads so the CDP connection survives
// between API requests in a single Node process.
const store: Map<string, LiveSession> =
  (globalThis as { __bbSessions?: Map<string, LiveSession> }).__bbSessions ??
  new Map();
(globalThis as { __bbSessions?: Map<string, LiveSession> }).__bbSessions = store;

function client(): Browserbase {
  if (!API_KEY || !PROJECT_ID) {
    throw new Error(
      "Missing BROWSERBASE_API_KEY / BROWSERBASE_PROJECT_ID (set them in .env.local)"
    );
  }
  return new Browserbase({ apiKey: API_KEY });
}

async function screen(sessionId: string, page: Page): Promise<ScreenState> {
  // page.url() is read from the local CDP state (instant). We skip page.title()
  // here because it's a CDP round-trip that queues behind the target page's busy
  // main thread; the address bar only needs the URL on the hot path.
  return { sessionId, url: page.url(), title: "" };
}

// Short, bounded settle after navigation. We intentionally do NOT wait for
// networkidle: live-polling targets (like worldcuparena) never go idle, so it
// would block for the full timeout on every move and make the demo feel frozen.
async function settle(page: Page, ms = 350): Promise<void> {
  await page.waitForTimeout(ms);
}

/** Create a cloud browser, attach Playwright over CDP, land on targetUrl,
 *  and return the embeddable live-view URL the frontend iframes. */
export async function startSession(
  targetUrl: string
): Promise<{ liveViewUrl: string } & ScreenState> {
  const bb = client();
  // Smaller viewport => fewer pixels per screencast frame => smoother live view.
  // keepAlive keeps the session up if our CDP connection blips (e.g. dev HMR);
  // we release it explicitly in stopSession. timeout caps an abandoned session.
  const session = await bb.sessions.create({
    projectId: PROJECT_ID!,
    keepAlive: true,
    timeout: 900,
    // worldcuparena.live (Fly.io) drops Browserbase's datacenter IPs, so the
    // cloud browser hangs on page.goto. Route through residential proxies.
    proxies: true,
    browserSettings: {
      viewport: { width: 1280, height: 720 },
      ...(CONTEXT_ID ? { context: { id: CONTEXT_ID, persist: false } } : {}),
    },
  });
  const debug = await bb.sessions.debug(session.id);
  // navbar=false strips Browserbase's devtools chrome from the embedded view.
  const liveViewUrl = debug.debuggerFullscreenUrl + "&navbar=false";

  const browser = await chromium.connectOverCDP(session.connectUrl);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await settle(page, 1500);

  store.set(session.id, { browser, page, liveViewUrl });
  return { liveViewUrl, ...(await screen(session.id, page)) };
}

/** navigate command. */
export async function navigate(
  sessionId: string,
  url: string
): Promise<ScreenState> {
  const s = store.get(sessionId);
  if (!s) throw new Error("No live session — start one first");
  await s.page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await settle(s.page);
  return screen(sessionId, s.page);
}

/** click_or_type (text-based). Clicks the first element matching visible text.
 *  Stagehand's act() (LLM-driven) plugs in here once an LLM key is available. */
export async function clickText(
  sessionId: string,
  text: string
): Promise<ScreenState> {
  const s = store.get(sessionId);
  if (!s) throw new Error("No live session — start one first");
  // force: true skips Playwright's actionability/stability checks, which can
  // hang for seconds on a page whose chart repaints every frame. Nav links are
  // present and clickable, so this is safe and much faster.
  await s.page
    .getByText(text, { exact: false })
    .first()
    .click({ timeout: 8000, force: true });
  await s.page.waitForTimeout(100);
  return screen(sessionId, s.page);
}

export async function stopSession(sessionId: string): Promise<void> {
  const s = store.get(sessionId);
  if (s) {
    store.delete(sessionId);
    await s.browser.close().catch(() => {});
  }
  // keepAlive sessions persist after the CDP connection closes, so end it explicitly.
  await client()
    .sessions.update(sessionId, { projectId: PROJECT_ID!, status: "REQUEST_RELEASE" })
    .catch(() => {});
}

export interface PageContext {
  url: string;
  title: string;
  links: string[];
  text: string;
}

/** Grounding for the agent brain: current page, clickable labels (so Claude
 *  clicks real elements), and the visible page text (so Claude can ANSWER
 *  questions about what's on screen). */
export async function pageContext(sessionId: string): Promise<PageContext> {
  const s = store.get(sessionId);
  if (!s) throw new Error("No live session — start one first");
  const links = await s.page
    .$$eval("a, button, [role='link'], [role='tab']", (els) =>
      Array.from(
        new Set(
          els
            .map((e) => (e.textContent || "").trim().replace(/\s+/g, " "))
            .filter((t) => t.length > 0 && t.length < 40)
        )
      ).slice(0, 20)
    )
    .catch(() => [] as string[]);
  const text = await s.page
    .evaluate(() => document.body?.innerText || "")
    .catch(() => "");
  return {
    url: s.page.url(),
    title: await s.page.title().catch(() => ""),
    links,
    text: text.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim().slice(0, 2800),
  };
}
