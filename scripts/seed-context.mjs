// One-time: create (or reuse) a Browserbase Context and log into your product
// in it ONCE. Cookies persist to the context, so every later demo session boots
// already authenticated. Run:
//   node --env-file=.env.local scripts/seed-context.mjs https://app.yourproduct.com/login
//
// 1. It prints a context id — put it in .env.local as BROWSERBASE_CONTEXT_ID.
// 2. It opens an interactive browser URL — log into your product there.
// 3. Press Enter in this terminal to save + close. Done.
import Browserbase from "@browserbasehq/sdk";
import { chromium } from "playwright-core";

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
const projectId = process.env.BROWSERBASE_PROJECT_ID;
const targetUrl = process.argv[2] || "about:blank";

let contextId = process.env.BROWSERBASE_CONTEXT_ID;
if (!contextId) {
  const ctx = await bb.contexts.create({ projectId });
  contextId = ctx.id;
  console.log("\n  Created context:", contextId);
  console.log("  >> Add this line to .env.local, then re-run for future re-seeds:");
  console.log("     BROWSERBASE_CONTEXT_ID=" + contextId);
} else {
  console.log("\n  Re-seeding existing context:", contextId);
}

// persist:true => whatever you do in this session (the login) is written back
// to the context. proxies:true matches the live demo egress for consistency.
const session = await bb.sessions.create({
  projectId,
  keepAlive: true,
  timeout: 900,
  proxies: true,
  browserSettings: {
    viewport: { width: 1280, height: 720 },
    context: { id: contextId, persist: true },
  },
});

// Best-effort: land the browser on the login page for you.
if (targetUrl !== "about:blank") {
  try {
    const browser = await chromium.connectOverCDP(session.connectUrl);
    const ctx = browser.contexts()[0] ?? (await browser.newContext());
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await browser.close(); // detach CDP; the cloud session stays up (keepAlive)
  } catch (e) {
    console.log("  (couldn't auto-open " + targetUrl + ": " + e.message.split("\n")[0] + ")");
  }
}

const debug = await bb.sessions.debug(session.id);
console.log("\n  Open this, log into your product (it has an address bar):");
console.log("  " + debug.debuggerFullscreenUrl);
console.log("\n  When you're logged in, press Enter here to save + close…");

process.stdin.resume();
await new Promise((r) => process.stdin.once("data", r));

await bb.sessions.update(session.id, { projectId, status: "REQUEST_RELEASE" }).catch(() => {});
console.log("\n  Saved. Login persisted to context " + contextId + ".");
console.log("  Set BROWSERBASE_CONTEXT_ID in .env.local and restart the app — demos now boot logged-in.");
process.exit(0);
