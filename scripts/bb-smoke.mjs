// Standalone validation of the Browserbase path (no Next, no LLM).
// Run: node --env-file=.env.local scripts/bb-smoke.mjs
import Browserbase from "@browserbasehq/sdk";
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";

const apiKey = process.env.BROWSERBASE_API_KEY;
const projectId = process.env.BROWSERBASE_PROJECT_ID;
const target = process.env.DEMO_TARGET_URL || "https://www.browserbase.com/";

if (!apiKey || !projectId) {
  console.error(
    "Missing keys. Run: node --env-file=.env.local scripts/bb-smoke.mjs"
  );
  process.exit(1);
}

const bb = new Browserbase({ apiKey });

console.log("creating session…");
const session = await bb.sessions.create({ projectId });
console.log("  session id :", session.id);

const debug = await bb.sessions.debug(session.id);
console.log("  live view  :", debug.debuggerFullscreenUrl);

console.log("connecting Playwright over CDP…");
const browser = await chromium.connectOverCDP(session.connectUrl);
const ctx = browser.contexts()[0] ?? (await browser.newContext());
const page = ctx.pages()[0] ?? (await ctx.newPage());

console.log("navigating →", target);
await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(3000);
console.log("  title :", await page.title());
console.log("  url   :", page.url());

await mkdir("screenshots", { recursive: true });
const buf = await page.screenshot({ fullPage: false });
await writeFile("screenshots/smoke.png", buf);
console.log("  shot  : screenshots/smoke.png");

await browser.close();
console.log("done — session released.");
