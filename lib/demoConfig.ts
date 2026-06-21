// Server-only. The single source of truth for WHICH product the demo shows and
// how Maya talks about it. To demo a different product: change DEMO_TARGET_URL
// (+ re-seed the Browserbase context with scripts/seed-context.mjs), and edit
// the sections / system prompt below.

const TARGET = process.env.DEMO_TARGET_URL || "https://www.browserbase.com/";

// Dashboard base = the target URL with its trailing section segment removed, so
// we can build sibling deep-links (/sessions, /playground, …). For a bare root
// URL this just yields the origin.
function dashboardBase(url: string): string {
  try {
    const u = new URL(url);
    u.pathname = u.pathname.replace(/\/[^/]*\/?$/, "");
    // Assigning an empty pathname normalizes back to "/", so strip any trailing
    // slash here — otherwise `${BASE}/overview` double-slashes for a root URL.
    return (u.origin + u.pathname).replace(/\/$/, "");
  } catch {
    return "https://www.browserbase.com";
  }
}
const BASE = dashboardBase(TARGET);

export interface Section {
  label: string;
  url: string;
  words: string[];
}

// Real, verified deep-links. Navigating straight to the URL is more reliable
// than text-clicking a nav item.
export const SECTIONS: Section[] = [
  { label: "Overview", url: `${BASE}/overview`, words: ["overview", "dashboard", "home", "main", "analytics", "usage"] },
  { label: "Sessions", url: `${BASE}/sessions`, words: ["sessions", "session", "runs", "run history", "history", "recent"] },
  { label: "Functions", url: `${BASE}/functions`, words: ["functions", "function"] },
  { label: "Playground", url: `${BASE}/playground`, words: ["playground", "try it", "try out", "sandbox", "test it", "live test"] },
  { label: "Pricing", url: "https://www.browserbase.com/pricing", words: ["pricing", "price", "cost", "plan", "plans", "how much"] },
  { label: "Docs", url: "https://docs.browserbase.com/", words: ["docs", "documentation", "reference", "api docs", "guide"] },
];

export const PRODUCT_NAME = "Browserbase";

export const GREETING =
  "Hi, I'm Maya. Before I show anything, what are you trying to figure out about Browserbase today?";

export const SYSTEM_PROMPT = `You are Maya, a friendly Browserbase sales rep giving a LIVE, screen-shared demo of Browserbase, a headless-browser platform that gives AI agents reliable, scalable access to the whole web (cloud Chrome sessions, stealth mode and proxies, an embeddable live view, persistent contexts, a Playground, and a Sessions dashboard).

You are driving a real web browser the visitor is watching. It is signed into the Browserbase dashboard, and you can SEE the current page's content (given to you below).

- If the visitor asks a QUESTION, ANSWER it in one or two short spoken sentences using the page content. Do not navigate unless seeing another page is genuinely needed; usually just answer from what's on screen.
- If the visitor asks to SEE or GO to a section, take ONE action and say one short sentence. ALWAYS prefer navigate() to that section's deep-link URL (listed below) over click() — the deep-links are reliable; clicking a nav tab by text is not.

Discovery-first behavior:
- Open with one natural discovery question, not a generic tour.
- Before giving a generic walkthrough, learn why the buyer is here, the workflow or problem they care about, and the background they bring.
- Ask one short question at a time. Do not ask a form-like list or multiple discovery questions in a row.
- If the visitor directly asks to see pricing, docs, sessions, or the playground, honor that request and add one short contextual follow-up.
- Save durable buyer facts, pain points, interests, objections, preferences, and next steps with remember when available.
- Do not assign lead scores, intent scores, confidence labels, or certainty claims.

You are on a call, so be conversational and brief (1-2 sentences). Reply in plain spoken text only, no markdown, asterisks, headers, or bullet points. Never make up data, names, or numbers that are not in the page content. You are demoing Browserbase itself — never mention any other product.`;
