import { NextResponse } from "next/server";
import { pageContext, navigate, clickText } from "@/lib/browser/session";
import { decide, hasLLM, type BrowserAction } from "@/lib/agent/brain";
import type { PageContext } from "@/lib/browser/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Each section is a real deep-link: the SPA's viewFromPath() reads the URL path
// on load (/blog, /leaderboard, …), so navigating straight to the URL is far
// more reliable than text-clicking a nav tab (which could miss or hit the wrong
// element). Live is the site root.
const ORIGIN = new URL(process.env.DEMO_TARGET_URL || "https://worldcuparena.live/").origin;

// Fast path: obvious section navigation resolved by simple matching, so it
// skips BOTH the page scan and the Claude round-trip (~2s saved). Claude still
// handles questions and anything that doesn't clearly map to a section.
const SECTIONS: { label: string; path: string; words: string[] }[] = [
  { label: "Leaderboard", path: "/leaderboard", words: ["leaderboard", "rankings", "ranking", "standings", "board"] },
  { label: "Agents", path: "/agents", words: ["agents", "agent", "models", "model", "bots", "players", "competitors"] },
  { label: "Matches", path: "/matches", words: ["matches", "match", "games", "head to head", "head-to-head"] },
  { label: "Blog", path: "/blog", words: ["blog", "posts", "articles", "article", "news", "writeup"] },
  { label: "About", path: "/about", words: ["about", "info", "story", "who made", "what is demoless"] },
  { label: "Live", path: "/", words: ["live", "home", "homepage", "dashboard", "chart", "overview"] },
];

const QUESTION_STARTS = [
  "what", "which", "how", "why", "who", "where", "when",
  "is ", "are ", "do ", "does ", "can ", "could ", "would ", "should ",
  "tell me", "explain",
];

function isQuestion(message: string): boolean {
  const m = message.trim().toLowerCase();
  return m.includes("?") || QUESTION_STARTS.some((q) => m.startsWith(q));
}

function fastRoute(message: string): { reply: string; action: BrowserAction } | null {
  if (isQuestion(message)) return null; // let Claude actually answer
  const m = message.toLowerCase();
  for (const s of SECTIONS) {
    if (s.words.some((w) => m.includes(w))) {
      return {
        reply: `Sure, here's ${s.label.toLowerCase()}.`,
        action: { type: "navigate", url: ORIGIN + s.path },
      };
    }
  }
  return null;
}

// Used only when there is no LLM key and the fast path didn't match.
function keywordFallback(): { reply: string; action: BrowserAction } {
  return {
    reply:
      "I can show you the leaderboard, matches, agents, blog, or about. What would you like to see?",
    action: null,
  };
}

export async function POST(req: Request) {
  try {
    const { sessionId, message } = (await req.json()) as {
      sessionId?: string;
      message?: string;
    };
    if (!sessionId || !message) throw new Error("sessionId and message required");

    const t: Record<string, number> = { context: 0, brain: 0, action: 0 };

    let reply: string;
    let action: BrowserAction;
    let base = { url: "", title: "" };

    const fast = fastRoute(message);
    if (fast) {
      reply = fast.reply;
      action = fast.action;
    } else {
      let s = Date.now();
      const ctx: PageContext = await pageContext(sessionId);
      t.context = Date.now() - s;
      base = { url: ctx.url, title: ctx.title };

      s = Date.now();
      const decision = hasLLM() ? await decide(message, ctx) : keywordFallback();
      t.brain = Date.now() - s;
      reply = decision.reply;
      action = decision.action;
    }

    let screen = { sessionId, ...base };
    const s2 = Date.now();
    if (action?.type === "navigate") {
      screen = await navigate(sessionId, action.url);
    } else if (action?.type === "click") {
      try {
        screen = await clickText(sessionId, action.text);
      } catch {
        reply += " (Hmm, I couldn't find that on the page.)";
      }
    }
    t.action = Date.now() - s2;

    return NextResponse.json({ ok: true, reply, action, ...screen, timings: t });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
