import type { NextApiRequest, NextApiResponse } from "next";

const DEFAULT_TARGET =
  process.env.DEMO_TARGET_URL || "https://www.browserbase.com/";

interface Body {
  action?: "start" | "navigate" | "click" | "stop";
  sessionId?: string;
  url?: string;
  text?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ ok: false, error: "not found" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method not allowed" });
  }

  try {
    const body = (req.body ?? {}) as Body;
    const browser = await import("@/lib/browser/session");

    switch (body.action) {
      case "start":
        return res.status(200).json({
          ok: true,
          ...(await browser.startSession(body.url || DEFAULT_TARGET)),
        });

      case "navigate":
        if (!body.sessionId || !body.url)
          throw new Error("sessionId and url required");
        return res.status(200).json({
          ok: true,
          ...(await browser.navigate(body.sessionId, body.url)),
        });

      case "click":
        if (!body.sessionId || !body.text)
          throw new Error("sessionId and text required");
        return res.status(200).json({
          ok: true,
          ...(await browser.clickText(body.sessionId, body.text)),
        });

      case "stop":
        if (body.sessionId) await browser.stopSession(body.sessionId);
        return res.status(200).json({ ok: true });

      default:
        return res.status(400).json({ ok: false, error: "unknown action" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
