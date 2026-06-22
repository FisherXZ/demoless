// Server-only. Drives a streamable Browserbase cloud browser.
// Imported only by the API route and the smoke script — never the client.
import Browserbase from "@browserbasehq/sdk";
import { chromium, type Browser, type Page } from "playwright-core";

// Read env lazily (NOT into module-level consts): the standalone voice server
// loads .env.local AFTER importing this module (esbuild hoists imports above the
// dotenv.config() call), so capturing at import time freezes these as undefined.
// Next.js loads env before any module, so reading at call time is correct there
// too. See the load-order note in server/index.ts.
const apiKey = () => process.env.BROWSERBASE_API_KEY;
const projectId = () => process.env.BROWSERBASE_PROJECT_ID;
// When set, every demo session reuses a pre-authenticated Browserbase Context
// (seed it once with scripts/seed-context.mjs). The product being demoed then
// loads already logged-in. persist:false so prospects' clicks don't overwrite
// the saved login. Unset => plain sessions (current public-site behavior).
const contextId = () => process.env.BROWSERBASE_CONTEXT_ID;

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
  const key = apiKey();
  if (!key || !projectId()) {
    throw new Error(
      "Missing BROWSERBASE_API_KEY / BROWSERBASE_PROJECT_ID (set them in .env.local)"
    );
  }
  return new Browserbase({ apiKey: key });
}

async function screen(sessionId: string, page: Page): Promise<ScreenState> {
  // page.url() is read from the local CDP state (instant). We skip page.title()
  // here because it's a CDP round-trip that queues behind the target page's busy
  // main thread; the address bar only needs the URL on the hot path.
  return { sessionId, url: page.url(), title: "" };
}

// Short, bounded settle after navigation. We intentionally do NOT wait for
// networkidle: some live-polling targets never go idle, so it
// would block for the full timeout on every move and make the demo feel frozen.
async function settle(page: Page, ms = 350): Promise<void> {
  await page.waitForTimeout(ms);
}

/** Create a cloud browser, attach Playwright over CDP, land on targetUrl,
 *  and return the embeddable live-view URL the frontend iframes.
 *  `onLiveView` (optional) fires as soon as the browser is connectable — before
 *  the page has loaded — so the UI can show the live browser navigating instead
 *  of an idle spinner. */
export async function startSession(
  targetUrl: string,
  onLiveView?: (liveViewUrl: string, sessionId: string) => void
): Promise<{ liveViewUrl: string } & ScreenState> {
  const bb = client();
  // Smaller viewport => fewer pixels per screencast frame => smoother live view.
  // keepAlive keeps the session up if our CDP connection blips (e.g. dev HMR);
  // we release it explicitly in stopSession. timeout caps an abandoned session.
  const session = await bb.sessions.create({
    projectId: projectId()!,
    keepAlive: true,
    timeout: 900,
    // Residential proxies are only needed for targets that block Browserbase's
    // datacenter IPs (e.g. worldcuparena.live). They add ~8s to session start,
    // so default OFF; set BROWSERBASE_PROXIES=1 when a target needs them.
    proxies: process.env.BROWSERBASE_PROXIES === "1",
    browserSettings: {
      viewport: { width: 1280, height: 720 },
      ...(contextId() ? { context: { id: contextId()!, persist: false } } : {}),
    },
  });

  // debug (the live-view URL) and the CDP connection both only need the new
  // session id, so run them concurrently instead of one after the other.
  const [debug, browser] = await Promise.all([
    bb.sessions.debug(session.id),
    chromium.connectOverCDP(session.connectUrl),
  ]);
  // navbar=false strips Browserbase's devtools chrome from the embedded view.
  const liveViewUrl = debug.debuggerFullscreenUrl + "&navbar=false";

  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = context.pages()[0] ?? (await context.newPage());

  // Surface the live browser NOW (it will visibly navigate on screen) rather
  // than making the visitor wait for the page-load to finish.
  onLiveView?.(liveViewUrl, session.id);

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

/** type command. Fills text into a field. `into` (optional) identifies the
 *  field by its placeholder, accessible label, or role name; without it we type
 *  into the first visible text field on the page. Demos mostly mean a search box
 *  or the one obvious input, so this stays forgiving. */
export async function typeText(
  sessionId: string,
  text: string,
  into?: string
): Promise<ScreenState> {
  const s = store.get(sessionId);
  if (!s) throw new Error("No live session — start one first");
  const field = into
    ? s.page
        .getByPlaceholder(into, { exact: false })
        .or(s.page.getByLabel(into, { exact: false }))
        .or(s.page.getByRole("textbox", { name: into }))
        .first()
    : s.page.locator("input:visible, textarea:visible, [contenteditable]:visible").first();
  await field.fill(text, { timeout: 8000 });
  await s.page.waitForTimeout(100);
  return screen(sessionId, s.page);
}

/** press command. Presses a single key (e.g. "Enter", "Escape", "Tab") — the
 *  usual way to submit a search box or form after type(). */
export async function pressKey(
  sessionId: string,
  key: string
): Promise<ScreenState> {
  const s = store.get(sessionId);
  if (!s) throw new Error("No live session — start one first");
  await s.page.keyboard.press(key);
  await settle(s.page);
  return screen(sessionId, s.page);
}

/** wait command. Blocks until a long-running action (an extraction, scrape, or
 *  navigation) actually produces output, so the agent reads REAL results instead
 *  of an empty in-progress page. If `until` is given we poll for that text to
 *  appear; otherwise we wait for the visible text to stop changing. Capped at
 *  `seconds` (default 15, max 30) and never throws — on timeout we return
 *  whatever is on screen so the agent can report or retry. */
export async function waitFor(
  sessionId: string,
  until?: string,
  seconds = 15
): Promise<ScreenState> {
  const s = store.get(sessionId);
  if (!s) throw new Error("No live session — start one first");
  const timeout = Math.min(Math.max(seconds, 1), 30) * 1000;
  if (until && until.trim()) {
    await s.page
      .waitForFunction(
        (t: string) => (document.body?.innerText || "").toLowerCase().includes(t),
        until.toLowerCase(),
        { timeout, polling: 500 }
      )
      .catch(() => {}); // timed out — return the current page, don't throw
  } else {
    // No target text: wait for the page text to settle (two equal reads) so we
    // don't read mid-render. Falls through at the timeout regardless.
    const start = Date.now();
    let prev = "";
    while (Date.now() - start < timeout) {
      await s.page.waitForTimeout(600);
      const now = await s.page.evaluate(() => document.body?.innerText || "").catch(() => "");
      if (now && now === prev) break;
      prev = now;
    }
  }
  return screen(sessionId, s.page);
}

/** scroll command. Scrolls the page up or down by roughly one viewport so the
 *  audience sees content below the fold and lazy-loaded sections render. */
export async function scroll(
  sessionId: string,
  direction: "down" | "up"
): Promise<ScreenState> {
  const s = store.get(sessionId);
  if (!s) throw new Error("No live session — start one first");
  const dy = (direction === "up" ? -1 : 1) * 600;
  await s.page.mouse.wheel(0, dy);
  await s.page.waitForTimeout(250);
  return screen(sessionId, s.page);
}

/** Viewport screenshot of the live page as base64 JPEG, for the agent's vision
 *  fallback (an ambiguous layout, an icon-only control, a chart). Viewport-only
 *  + jpeg q60 to bound size/latency on the live loop. */
export async function screenshot(
  sessionId: string
): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const s = store.get(sessionId);
  if (!s) throw new Error("No live session — start one first");
  const buf = await s.page.screenshot({ type: "jpeg", quality: 60 });
  return { base64: buf.toString("base64"), mediaType: "image/jpeg" };
}

export async function stopSession(sessionId: string): Promise<void> {
  const s = store.get(sessionId);
  if (s) {
    store.delete(sessionId);
    await s.browser.close().catch(() => {});
  }
  // keepAlive sessions persist after the CDP connection closes, so end it explicitly.
  await client()
    .sessions.update(sessionId, { projectId: projectId()!, status: "REQUEST_RELEASE" })
    .catch(() => {});
}

export interface PageContext {
  url: string;
  title: string;
  /** Interactive elements from the accessibility tree: `role "name" [state]`. */
  elements: string[];
  text: string;
}

// Roles worth offering the agent as click/type targets. Headings, text, img,
// generic, etc. are dropped — they aren't actionable and just burn tokens.
const INTERACTIVE_ROLES = new Set([
  "button", "link", "textbox", "searchbox", "combobox", "checkbox", "radio",
  "tab", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "switch",
  "slider", "listbox",
]);
// Bracket tokens that are real states (kept). Everything else in the bracket
// group — ref=…, box=…, level=… — is positional metadata, not state, so dropped.
const STATE_TOKENS = new Set([
  "disabled", "checked", "checked=mixed", "expanded", "selected",
  "pressed", "pressed=mixed",
]);
const MAX_ELEMENTS = 30;

/**
 * Parse Playwright `locator.ariaSnapshot()` YAML into a flat, capped list of
 * interactive elements. Pure + exported so it's unit-tested without a live page.
 *
 * Real ariaSnapshot lines look like:
 *   - button "Submit"
 *   - button                      (icon-only, no accessible name — KEPT)
 *   - textbox "Email": user@x.com (value folded in)
 *   - checkbox "Agree" [checked]
 *   - checkbox "Some" [checked=mixed]
 *   - tab "Overview" [selected]
 *   - list:                       (container; children indented below)
 * We keep interactive roles only, fold any trailing value in, keep real state
 * tokens, dedupe, and cap. Nesting is flattened (indentation is ignored).
 */
export function parseAriaElements(yaml: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of (yaml || "").split("\n")) {
    if (!/^\s*-\s+/.test(raw)) continue;
    let rest = raw.replace(/^\s*-\s+/, "").trimEnd();
    // Real ariaSnapshot lines carry MULTIPLE bracket groups, e.g.
    //   checkbox "All condiments" [checked=mixed] [ref=e84] [cursor=pointer]
    // Collect every [..] group, then strip them all (with any leading space) so
    // the remainder is just `role "name"` (+ optional `: value`).
    const brackets = Array.from(rest.matchAll(/\[([^\]]+)\]/g), (m) => m[1]);
    rest = rest.replace(/\s*\[[^\]]+\]/g, "");
    // A trailing `:` with no value is a container marker (children follow on
    // indented lines); a `: value` is a current field value to fold in.
    const m = rest.match(/^([a-z][\w-]*)(?:\s+"((?:[^"\\]|\\.)*)")?(?:\s*:\s*(.*))?$/);
    if (!m) continue;
    const [, role, name, value] = m;
    if (!INTERACTIVE_ROLES.has(role)) continue;
    let line = name ? `${role} "${name}"` : role;
    if (value && value.trim()) line += `: ${value.trim()}`;
    const states = brackets.filter((b) => STATE_TOKENS.has(b)); // drops ref=, cursor=, level=
    if (states.length) line += ` [${states.join(" ")}]`;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= MAX_ELEMENTS) break;
  }
  return out;
}

/** Grounding for the agent brain: current page, interactive elements from the
 *  accessibility tree (so Claude clicks/ types real controls — including
 *  icon-only ones a text scrape misses), and the visible page text (so Claude
 *  can ANSWER questions about what's on screen). */
export async function pageContext(sessionId: string): Promise<PageContext> {
  const s = store.get(sessionId);
  if (!s) throw new Error("No live session — start one first");
  const yaml = await s.page
    .locator("body")
    .ariaSnapshot()
    .catch(() => "");
  const elements = parseAriaElements(yaml);
  const text = await s.page
    .evaluate(() => document.body?.innerText || "")
    .catch(() => "");
  return {
    url: s.page.url(),
    title: await s.page.title().catch(() => ""),
    elements,
    text: text.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim().slice(0, 2800),
  };
}
