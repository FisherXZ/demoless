/**
 * Optional browser warm-up.
 *
 * The slow part of starting a demo is creating + connecting the Browserbase
 * cloud browser (~6s). When `NEXT_PUBLIC_VOICE_PREWARM=1`, the pre-call form
 * asks the voice server — over a short-lived WebSocket — to pre-create that
 * browser while the visitor is still filling the form, so the real session can
 * adopt it and the room opens almost instantly.
 *
 * OFF by default: with the flag unset this is a no-op, so the normal start path
 * is completely unaffected. It is always safe to call (failures are swallowed).
 */
let warmed = false;

export function requestBrowserWarmup(): void {
  if (
    warmed ||
    typeof window === "undefined" ||
    typeof WebSocket === "undefined" ||
    process.env.NEXT_PUBLIC_VOICE_PREWARM !== "1"
  ) {
    return;
  }
  warmed = true;
  try {
    const url = process.env.NEXT_PUBLIC_VOICE_WS_URL ?? "ws://localhost:3001";
    const ws = new WebSocket(url);
    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ t: "prewarm" }));
      } catch {
        /* best-effort */
      }
      // Give the server a moment to kick off the browser, then disconnect; the
      // warmed session is cached server-side for the room to adopt.
      setTimeout(() => {
        try {
          ws.close();
        } catch {
          /* best-effort */
        }
      }, 2500);
    };
    ws.onerror = () => {
      /* best-effort — warm-up never blocks the real start */
    };
  } catch {
    /* best-effort */
  }
}
