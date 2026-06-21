import dotenv from "dotenv";
// Prefer .env.local (gitignored, matches Next.js), fall back to .env.
dotenv.config({ path: ".env.local" });
dotenv.config();

import { createServer } from "http";
import { WebSocketServer } from "ws";
import { VoiceSession } from "./session";

/**
 * Voice WebSocket gateway (P2).
 *
 * Keeps Deepgram/Anthropic keys server-side. The browser connects to
 * NEXT_PUBLIC_VOICE_WS_URL; each connection gets one {@link VoiceSession}.
 */
// Prefer VOICE_SERVER_PORT locally (avoids the text-harness PORT clash); fall
// back to the PORT injected by container hosts (Railway), then the dev default.
const port = Number(process.env.VOICE_SERVER_PORT ?? process.env.PORT ?? 3001);
const deepgramKey = process.env.DEEPGRAM_API_KEY ?? "";

if (!deepgramKey) {
  console.warn(
    "[voice] DEEPGRAM_API_KEY is not set - STT/TTS will fail. Copy .env.example to .env.local and add your keys."
  );
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    "[voice] ANTHROPIC_API_KEY is not set - the stub orchestrator will fail to answer."
  );
}

// Share one HTTP server with the WS upgrade so PaaS health checks have a
// route to hit (Railway probes GET /health over HTTP on the same port).
const httpServer = createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

// Backstop: a single session's stray async error must never take down the
// whole gateway (and with it every other live demo). Log loudly, stay up.
process.on("unhandledRejection", (reason) => {
  console.error("[voice] unhandledRejection (kept alive):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[voice] uncaughtException (kept alive):", err);
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  console.log("[voice] client connected");
  new VoiceSession(ws, deepgramKey);
});

wss.on("error", (err) => {
  console.error("[voice] server error:", err);
});

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`[voice] gateway listening on :${port} (ws + GET /health)`);
});

const shutdown = () => {
  console.log("[voice] shutting down");
  wss.close();
  httpServer.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
