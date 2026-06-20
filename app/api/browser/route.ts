import { NextResponse } from "next/server";
import {
  startSession,
  navigate,
  clickText,
  stopSession,
} from "@/lib/browser/session";

// Playwright + the Browserbase SDK need the Node runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TARGET =
  process.env.DEMO_TARGET_URL || "https://worldcuparena.live/";

interface Body {
  action?: "start" | "navigate" | "click" | "stop";
  sessionId?: string;
  url?: string;
  text?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    switch (body.action) {
      case "start":
        return NextResponse.json({
          ok: true,
          ...(await startSession(body.url || DEFAULT_TARGET)),
        });

      case "navigate":
        if (!body.sessionId || !body.url)
          throw new Error("sessionId and url required");
        return NextResponse.json({
          ok: true,
          ...(await navigate(body.sessionId, body.url)),
        });

      case "click":
        if (!body.sessionId || !body.text)
          throw new Error("sessionId and text required");
        return NextResponse.json({
          ok: true,
          ...(await clickText(body.sessionId, body.text)),
        });

      case "stop":
        if (body.sessionId) await stopSession(body.sessionId);
        return NextResponse.json({ ok: true });

      default:
        return NextResponse.json(
          { ok: false, error: "unknown action" },
          { status: 400 }
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
