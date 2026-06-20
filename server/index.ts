import dotenv from "dotenv";
// Prefer .env.local (gitignored, matches Next.js), fall back to .env.
dotenv.config({ path: ".env.local" });
dotenv.config();

import { WebSocketServer } from "ws";
import { VoiceSession } from "./session";

/**
 * Voice WebSocket gateway (P2).
 *
 * Keeps Deepgram/Anthropic keys server-side. The browser connects to
 * NEXT_PUBLIC_VOICE_WS_URL; each connection gets one {@link VoiceSession}.
 */
const port = Number(process.env.VOICE_SERVER_PORT ?? 3001);
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

const wss = new WebSocketServer({ port });

wss.on("connection", (ws) => {
  console.log("[voice] client connected");
  new VoiceSession(ws, deepgramKey);
});

wss.on("listening", () => {
  console.log(`[voice] gateway listening on ws://localhost:${port}`);
});

wss.on("error", (err) => {
  console.error("[voice] server error:", err);
});

const shutdown = () => {
  console.log("[voice] shutting down");
  wss.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
